import {
  MasterSignalDispatchStatus,
  MasterSignalStatus,
  OrderLogStatus,
  type MasterSignal,
  type Prisma,
} from "@prisma/client";
import { mapInstructionToEaPayload } from "@/lib/ea/instructions";
import { selectEligibleLicensesForMasterSignal } from "@/lib/master-signals/eligibility";
import { MASTER_SIGNAL_INSTRUCTION_SOURCE } from "@/lib/master-signals/instruction-source";
import prisma from "@/lib/prisma";

/** Quantidade padrão até o MasterSignal carregar volume no servidor (Fase 2.6 v1). */
export const MASTER_SIGNAL_DISPATCH_DEFAULT_QUANTITY = 1;

const DEFAULT_INSTRUCTION_TTL_MS = 60 * 60 * 1000;

export class MasterSignalDispatchError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "MasterSignalDispatchError";
  }
}

export type DispatchMasterSignalResult = {
  ok: true;
  masterSignalId: string;
  status: MasterSignalStatus;
  instructionsCreated: number;
  skipped: number;
  failed: number;
  idempotent: boolean;
  candidatesCount?: number;
  noEligibleLicenses?: boolean;
};

export function buildMasterInstructionIdempotencyKey(
  masterSignalBusinessId: string,
  licenseId: string
): string {
  return `master:${masterSignalBusinessId}:${licenseId}`;
}

export function resolveInstructionExpiresAt(
  signal: Pick<MasterSignal, "expiresAt">,
  now = new Date()
): Date {
  if (signal.expiresAt && signal.expiresAt.getTime() > now.getTime()) {
    return signal.expiresAt;
  }
  return new Date(now.getTime() + DEFAULT_INSTRUCTION_TTL_MS);
}

export function resolveMasterSignalDispatchQuantity(): number {
  const raw = process.env.MASTER_SIGNAL_DISPATCH_QUANTITY?.trim();
  if (!raw) return MASTER_SIGNAL_DISPATCH_DEFAULT_QUANTITY;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return MASTER_SIGNAL_DISPATCH_DEFAULT_QUANTITY;
  }
  return parsed;
}

async function findMasterSignalByKey(
  masterSignalKey: string
): Promise<MasterSignal | null> {
  return (
    (await prisma.masterSignal.findUnique({
      where: { masterSignalId: masterSignalKey },
    })) ??
    (await prisma.masterSignal.findUnique({
      where: { id: masterSignalKey },
    }))
  );
}

function terminalDispatchStatuses(): MasterSignalStatus[] {
  return [
    MasterSignalStatus.DISPATCHED,
    MasterSignalStatus.PARTIALLY_DISPATCHED,
    MasterSignalStatus.FAILED,
  ];
}

async function summarizeExistingDispatch(masterSignalId: string) {
  const rows = await prisma.masterSignalDispatch.findMany({
    where: { masterSignalId },
    select: { status: true, instructionId: true },
  });

  const instructionsCreated = rows.filter(
    (r) => r.status === MasterSignalDispatchStatus.INSTRUCTION_CREATED && r.instructionId
  ).length;
  const skipped = rows.filter((r) => r.status === MasterSignalDispatchStatus.SKIPPED).length;
  const failed = rows.filter((r) => r.status === MasterSignalDispatchStatus.FAILED).length;

  return { instructionsCreated, skipped, failed, total: rows.length };
}

async function recordSkippedDispatch(
  signal: MasterSignal,
  licenseId: string,
  code: string
): Promise<void> {
  await prisma.masterSignalDispatch.upsert({
    where: {
      masterSignalId_licenseId: {
        masterSignalId: signal.id,
        licenseId,
      },
    },
    create: {
      masterSignalId: signal.id,
      licenseId,
      status: MasterSignalDispatchStatus.SKIPPED,
      reason: code,
    },
    update: {
      status: MasterSignalDispatchStatus.SKIPPED,
      reason: code,
      instructionId: null,
    },
  });
}

type FinalizeDispatchInput = {
  created: number;
  failed: number;
  eligibleCount: number;
};

async function finalizeMasterSignalStatus(
  masterSignalId: string,
  input: FinalizeDispatchInput
): Promise<MasterSignalStatus> {
  const { created, failed, eligibleCount } = input;

  if (created === 0 && failed === 0 && eligibleCount === 0) {
    await prisma.masterSignal.update({
      where: { id: masterSignalId },
      data: {
        status: MasterSignalStatus.VALIDATED,
        rejectedReason: "NO_ELIGIBLE_LICENSES",
        dispatchedAt: null,
      },
    });
    return MasterSignalStatus.VALIDATED;
  }

  const status =
    failed > 0 && created > 0
      ? MasterSignalStatus.PARTIALLY_DISPATCHED
      : failed > 0 && created === 0
        ? MasterSignalStatus.FAILED
        : MasterSignalStatus.DISPATCHED;

  await prisma.masterSignal.update({
    where: { id: masterSignalId },
    data:
      status === MasterSignalStatus.FAILED
        ? {
            status,
            failedAt: new Date(),
            rejectedReason: "DISPATCH_FAILED",
          }
        : {
            status,
            rejectedReason: null,
            dispatchedAt: new Date(),
            failedAt: null,
          },
  });

  return status;
}

async function resetEmptyDispatchedSignal(signal: MasterSignal): Promise<MasterSignal> {
  const summary = await summarizeExistingDispatch(signal.id);
  if (summary.instructionsCreated > 0 || summary.total > 0) {
    return signal;
  }

  return prisma.masterSignal.update({
    where: { id: signal.id },
    data: {
      status: MasterSignalStatus.VALIDATED,
      rejectedReason: null,
      dispatchedAt: null,
      failedAt: null,
    },
  });
}

type CreateInstructionForLicenseResult =
  | { ok: true; instructionId: string; idempotent: boolean }
  | { ok: false };

async function createInstructionForLicense(
  signal: MasterSignal,
  licenseId: string,
  quantity: number,
  expiresAt: Date
): Promise<CreateInstructionForLicenseResult> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingDispatch = await tx.masterSignalDispatch.findUnique({
        where: {
          masterSignalId_licenseId: {
            masterSignalId: signal.id,
            licenseId,
          },
        },
      });

      if (existingDispatch?.instructionId) {
        return {
          instructionId: existingDispatch.instructionId,
          idempotent: true,
        };
      }

      const instruction = await tx.instruction.create({
        data: {
          licenseId,
          purpose: signal.purpose,
          symbol: signal.symbol,
          side: signal.side,
          orderType: signal.orderType,
          quantity,
          idempotencyKey: buildMasterInstructionIdempotencyKey(
            signal.masterSignalId,
            licenseId
          ),
          requestId: `master-dispatch-${signal.masterSignalId}`,
          expiresAt,
          source: MASTER_SIGNAL_INSTRUCTION_SOURCE,
          currentStatus: OrderLogStatus.RECEIVED,
        },
      });

      await tx.instructionStatusLog.create({
        data: {
          instructionId: instruction.id,
          status: OrderLogStatus.RECEIVED,
          message: "Instrução criada pelo dispatch do sinal mestre",
          metadata: {
            master_signal_id: signal.masterSignalId,
            master_signal_row_id: signal.id,
          } satisfies Prisma.InputJsonValue,
        },
      });

      await tx.masterSignalDispatch.upsert({
        where: {
          masterSignalId_licenseId: {
            masterSignalId: signal.id,
            licenseId,
          },
        },
        create: {
          masterSignalId: signal.id,
          licenseId,
          instructionId: instruction.id,
          status: MasterSignalDispatchStatus.INSTRUCTION_CREATED,
        },
        update: {
          instructionId: instruction.id,
          status: MasterSignalDispatchStatus.INSTRUCTION_CREATED,
          reason: null,
        },
      });

      return { instructionId: instruction.id, idempotent: false };
    });

    return { ok: true, ...result };
  } catch {
    await prisma.masterSignalDispatch.upsert({
      where: {
        masterSignalId_licenseId: {
          masterSignalId: signal.id,
          licenseId,
        },
      },
      create: {
        masterSignalId: signal.id,
        licenseId,
        status: MasterSignalDispatchStatus.FAILED,
        reason: "INSTRUCTION_CREATE_FAILED",
      },
      update: {
        status: MasterSignalDispatchStatus.FAILED,
        reason: "INSTRUCTION_CREATE_FAILED",
      },
    });
    return { ok: false };
  }
}

export async function dispatchValidatedMasterSignal(
  masterSignalKey: string
): Promise<DispatchMasterSignalResult> {
  let signal = await findMasterSignalByKey(masterSignalKey);
  if (!signal) {
    throw new MasterSignalDispatchError(
      "Sinal mestre não encontrado",
      "MASTER_SIGNAL_NOT_FOUND"
    );
  }

  const now = new Date();
  if (signal.expiresAt && signal.expiresAt.getTime() <= now.getTime()) {
    throw new MasterSignalDispatchError(
      "Sinal mestre expirado",
      "MASTER_SIGNAL_EXPIRED"
    );
  }

  if (terminalDispatchStatuses().includes(signal.status)) {
    const summary = await summarizeExistingDispatch(signal.id);
    if (summary.instructionsCreated === 0 && summary.total === 0) {
      signal = await resetEmptyDispatchedSignal(signal);
    } else {
      return {
        ok: true,
        masterSignalId: signal.masterSignalId,
        status: signal.status,
        instructionsCreated: summary.instructionsCreated,
        skipped: summary.skipped,
        failed: summary.failed,
        idempotent: true,
      };
    }
  }

  if (signal.status === MasterSignalStatus.DISPATCHING) {
    const summary = await summarizeExistingDispatch(signal.id);
    if (summary.total > 0) {
      const status = await finalizeMasterSignalStatus(signal.id, {
        created: summary.instructionsCreated,
        failed: summary.failed,
        eligibleCount: summary.instructionsCreated,
      });
      return {
        ok: true,
        masterSignalId: signal.masterSignalId,
        status,
        instructionsCreated: summary.instructionsCreated,
        skipped: summary.skipped,
        failed: summary.failed,
        idempotent: true,
      };
    }
    throw new MasterSignalDispatchError(
      "Dispatch já em andamento",
      "MASTER_SIGNAL_DISPATCH_IN_PROGRESS"
    );
  }

  if (signal.status !== MasterSignalStatus.VALIDATED) {
    throw new MasterSignalDispatchError(
      `Status ${signal.status} não permite dispatch`,
      "MASTER_SIGNAL_NOT_DISPATCHABLE"
    );
  }

  const lock = await prisma.masterSignal.updateMany({
    where: { id: signal.id, status: MasterSignalStatus.VALIDATED },
    data: { status: MasterSignalStatus.DISPATCHING },
  });

  if (lock.count === 0) {
    const refreshed = await prisma.masterSignal.findUniqueOrThrow({
      where: { id: signal.id },
    });
    return dispatchValidatedMasterSignal(refreshed.masterSignalId);
  }

  const quantity = resolveMasterSignalDispatchQuantity();
  const expiresAt = resolveInstructionExpiresAt(signal, now);
  const selection = await selectEligibleLicensesForMasterSignal(signal);

  for (const skip of selection.skipped) {
    await recordSkippedDispatch(signal, skip.licenseId, skip.code);
  }

  let created = 0;
  let failed = 0;

  for (const license of selection.eligible) {
    const outcome = await createInstructionForLicense(
      signal,
      license.id,
      quantity,
      expiresAt
    );
    if (outcome.ok) {
      if (!outcome.idempotent) created++;
    } else {
      failed++;
    }
  }

  const status = await finalizeMasterSignalStatus(signal.id, {
    created,
    failed,
    eligibleCount: selection.eligible.length,
  });

  const noEligibleLicenses =
    selection.eligible.length === 0 && created === 0 && failed === 0;

  return {
    ok: true,
    masterSignalId: signal.masterSignalId,
    status,
    instructionsCreated: created,
    skipped: selection.skipped.length,
    failed,
    idempotent: false,
    candidatesCount: selection.candidatesCount,
    noEligibleLicenses,
  };
}

/** Expõe payload EA para testes de contrato (sem alterar rota pública). */
export async function mapDispatchedInstructionToEaPayload(instructionId: string) {
  const instruction = await prisma.instruction.findUniqueOrThrow({
    where: { id: instructionId },
  });
  return mapInstructionToEaPayload(instruction);
}
