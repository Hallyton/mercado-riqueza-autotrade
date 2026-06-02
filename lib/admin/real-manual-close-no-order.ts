import {
  ExecutionStatus,
  InstructionSource,
  OrderLogStatus,
  ProtectionStatus,
  type Prisma,
} from "@prisma/client";
import { z } from "zod";
import { recordAdminAction } from "@/lib/admin/record-action";
import prisma from "@/lib/prisma";
import { redactSensitiveMessage } from "@/lib/risk/redact-message";

export const CLOSE_NO_ORDER_CONFIRM_PHRASE =
  "ENCERRAR INSTRUCTION SEM ORDEM APREGOADA";

export const CLOSE_NO_ORDER_REASON_CODE = "ORDER_NOT_PLACED_EXCHANGE_REJECTED";

export const CLOSE_NO_ORDER_STATUS_EVENT = "CLOSED_NO_ORDER";

/** Status terminais — não permite novo encerramento. */
export const REAL_MANUAL_TERMINAL_INSTRUCTION_STATUSES: OrderLogStatus[] = [
  OrderLogStatus.ORDER_NOT_PLACED,
  OrderLogStatus.IGNORED,
  OrderLogStatus.CANCELLED,
];

export const closeNoOrderSchema = z.object({
  reasonCode: z.literal(CLOSE_NO_ORDER_REASON_CODE),
  operatorNote: z.string().min(10).max(2000),
  adminConfirmation: z.string().min(1),
});

export class RealManualCloseNoOrderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "RealManualCloseNoOrderError";
  }
}

type HeartbeatPayload = {
  open_positions?: Array<{ symbol?: string; magic?: number; magic_number?: number }>;
  pending_orders?: Array<{ symbol?: string; magic?: number; magic_number?: number }>;
};

function parseHeartbeatPayload(payload: unknown): HeartbeatPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }
  return payload as HeartbeatPayload;
}

function magicFromRecord(row: { magic?: number; magic_number?: number }): number | null {
  if (typeof row.magic_number === "number") return row.magic_number;
  if (typeof row.magic === "number") return row.magic;
  return null;
}

export function hasClosedNoOrderInLogs(
  logs: { metadata: Prisma.JsonValue | null; status: OrderLogStatus }[]
): boolean {
  if (logs.some((l) => l.status === OrderLogStatus.ORDER_NOT_PLACED)) {
    return true;
  }
  return logs.some((log) => {
    if (!log.metadata || typeof log.metadata !== "object" || Array.isArray(log.metadata)) {
      return false;
    }
    return (log.metadata as Record<string, unknown>).event === CLOSE_NO_ORDER_STATUS_EVENT;
  });
}

export async function assessLicenseExposureForClose(params: {
  licenseId: string;
  symbol: string;
  magicNumber: number | null;
  excludeInstructionId: string;
}) {
  const hb = await prisma.eaHeartbeat.findFirst({
    where: { licenseId: params.licenseId },
    orderBy: { receivedAt: "desc" },
    select: { reportPayload: true },
  });
  const payload = parseHeartbeatPayload(hb?.reportPayload);
  const symbol = params.symbol.toUpperCase();
  const magic = params.magicNumber;

  const openPositions = (payload.open_positions ?? []).filter((pos) => {
    const posSymbol = (pos.symbol ?? "").toUpperCase();
    if (posSymbol !== symbol) return false;
    if (magic == null) return true;
    const posMagic = magicFromRecord(pos);
    return posMagic == null || posMagic === magic;
  });

  const pendingBrokerOrders = (payload.pending_orders ?? []).filter((ord) => {
    const ordSymbol = (ord.symbol ?? "").toUpperCase();
    if (ordSymbol !== symbol) return false;
    if (magic == null) return true;
    const ordMagic = magicFromRecord(ord);
    return ordMagic == null || ordMagic === magic;
  });

  const armedOther = await prisma.instruction.findFirst({
    where: {
      licenseId: params.licenseId,
      id: { not: params.excludeInstructionId },
      symbol,
      currentStatus: { in: [OrderLogStatus.RECEIVED, OrderLogStatus.SENT] },
      ...(magic != null ? { magicNumber: magic } : {}),
    },
    select: { id: true },
  });

  return {
    hasOpenPosition: openPositions.length > 0,
    hasPendingBrokerOrder: pendingBrokerOrders.length > 0,
    hasOtherArmedInstruction: Boolean(armedOther),
  };
}

export type CloseNoOrderEligibility = {
  canShowClosePanel: boolean;
  canSubmitClose: boolean;
  blockReason: string | null;
};

export function evaluateCloseNoOrderEligibility(input: {
  source: InstructionSource | null;
  currentStatus: OrderLogStatus;
  statusLogs: { metadata: Prisma.JsonValue | null; status: OrderLogStatus }[];
  latestExecutionStatus: ExecutionStatus | null;
  latestExecutionFilled: boolean;
  latestProtectionStatus: ProtectionStatus | null;
  exposure: {
    hasOpenPosition: boolean;
    hasPendingBrokerOrder: boolean;
    hasOtherArmedInstruction: boolean;
  };
}): CloseNoOrderEligibility {
  if (input.source !== InstructionSource.REAL_MANUAL) {
    return {
      canShowClosePanel: false,
      canSubmitClose: false,
      blockReason: "Apenas instructions REAL_MANUAL.",
    };
  }

  if (hasClosedNoOrderInLogs(input.statusLogs)) {
    return {
      canShowClosePanel: false,
      canSubmitClose: false,
      blockReason: "Instruction já encerrada sem ordem apregoada.",
    };
  }

  if (REAL_MANUAL_TERMINAL_INSTRUCTION_STATUSES.includes(input.currentStatus)) {
    return {
      canShowClosePanel: false,
      canSubmitClose: false,
      blockReason: "Instruction em status final.",
    };
  }

  const protectionPending =
    input.latestProtectionStatus === ProtectionStatus.PROTECTION_PENDING;
  const executionRejected =
    input.latestExecutionStatus === ExecutionStatus.REJECTED ||
    input.latestExecutionStatus === ExecutionStatus.EXPIRED;
  const noFill =
    !input.latestExecutionFilled &&
    (executionRejected ||
      input.currentStatus === OrderLogStatus.REJECTED ||
      input.currentStatus === OrderLogStatus.EXECUTED);

  const operationalMismatch =
    input.currentStatus === OrderLogStatus.EXECUTED &&
    executionRejected &&
    protectionPending;

  const showPanel =
    protectionPending &&
    noFill &&
    (executionRejected || operationalMismatch || input.currentStatus === OrderLogStatus.SENT);

  if (!showPanel) {
    return {
      canShowClosePanel: false,
      canSubmitClose: false,
      blockReason:
        "Encerramento disponível apenas quando proteção está pendente e a ordem não foi apregoada.",
    };
  }

  if (input.exposure.hasOpenPosition) {
    return {
      canShowClosePanel: true,
      canSubmitClose: false,
      blockReason: "Há posição aberta reportada pelo EA para este símbolo/magic.",
    };
  }
  if (input.exposure.hasPendingBrokerOrder) {
    return {
      canShowClosePanel: true,
      canSubmitClose: false,
      blockReason: "Há ordem pendente ativa no broker para este símbolo/magic.",
    };
  }
  if (input.exposure.hasOtherArmedInstruction) {
    return {
      canShowClosePanel: true,
      canSubmitClose: false,
      blockReason: "Há outra instruction armada (RECEIVED/SENT) para o mesmo símbolo.",
    };
  }

  return {
    canShowClosePanel: true,
    canSubmitClose: true,
    blockReason: null,
  };
}

export async function getRealManualCloseNoOrderEligibility(instructionId: string) {
  const instruction = await prisma.instruction.findUnique({
    where: { id: instructionId },
    include: {
      statusLogs: { orderBy: { createdAt: "asc" } },
      executions: { orderBy: { executedAt: "desc" }, take: 1 },
      executionProtectionReports: { orderBy: { reportedAt: "desc" }, take: 1 },
    },
  });
  if (!instruction || instruction.source !== InstructionSource.REAL_MANUAL) {
    return null;
  }

  const latestEx = instruction.executions[0] ?? null;
  const exposure = await assessLicenseExposureForClose({
    licenseId: instruction.licenseId,
    symbol: instruction.symbol,
    magicNumber: instruction.magicNumber,
    excludeInstructionId: instruction.id,
  });

  return evaluateCloseNoOrderEligibility({
    source: instruction.source,
    currentStatus: instruction.currentStatus,
    statusLogs: instruction.statusLogs,
    latestExecutionStatus: latestEx?.status ?? null,
    latestExecutionFilled:
      latestEx?.status === ExecutionStatus.FILLED ||
      latestEx?.status === ExecutionStatus.PARTIAL,
    latestProtectionStatus:
      instruction.executionProtectionReports[0]?.protectionStatus ?? null,
    exposure,
  });
}

export async function closeRealManualInstructionNoOrder(input: {
  instructionId: string;
  actorId: string;
  reasonCode: typeof CLOSE_NO_ORDER_REASON_CODE;
  operatorNote: string;
  adminConfirmation: string;
  ipAddress?: string | null;
}) {
  if (input.adminConfirmation.trim() !== CLOSE_NO_ORDER_CONFIRM_PHRASE) {
    throw new RealManualCloseNoOrderError(
      `Confirmação inválida. Digite: ${CLOSE_NO_ORDER_CONFIRM_PHRASE}`,
      "CONFIRMATION_MISMATCH",
      400
    );
  }

  const instruction = await prisma.instruction.findUnique({
    where: { id: input.instructionId },
    include: {
      statusLogs: { orderBy: { createdAt: "asc" } },
      executions: { orderBy: { executedAt: "desc" } },
      executionProtectionReports: { orderBy: { reportedAt: "desc" } },
    },
  });

  if (!instruction) {
    throw new RealManualCloseNoOrderError(
      "Instruction não encontrada.",
      "INSTRUCTION_NOT_FOUND",
      404
    );
  }

  if (instruction.source !== InstructionSource.REAL_MANUAL) {
    throw new RealManualCloseNoOrderError(
      "Apenas instructions REAL_MANUAL podem ser encerradas por este fluxo.",
      "SOURCE_NOT_REAL_MANUAL",
      400
    );
  }

  if (hasClosedNoOrderInLogs(instruction.statusLogs)) {
    throw new RealManualCloseNoOrderError(
      "Instruction já foi encerrada sem ordem apregoada.",
      "REAL_MANUAL_ALREADY_CLOSED",
      409
    );
  }

  if (REAL_MANUAL_TERMINAL_INSTRUCTION_STATUSES.includes(instruction.currentStatus)) {
    throw new RealManualCloseNoOrderError(
      "Instruction em status final e não pode ser encerrada novamente.",
      "REAL_MANUAL_ALREADY_CLOSED",
      409
    );
  }

  const latestEx = instruction.executions[0] ?? null;
  const exposure = await assessLicenseExposureForClose({
    licenseId: instruction.licenseId,
    symbol: instruction.symbol,
    magicNumber: instruction.magicNumber,
    excludeInstructionId: instruction.id,
  });

  const eligibility = evaluateCloseNoOrderEligibility({
    source: instruction.source,
    currentStatus: instruction.currentStatus,
    statusLogs: instruction.statusLogs,
    latestExecutionStatus: latestEx?.status ?? null,
    latestExecutionFilled:
      latestEx?.status === ExecutionStatus.FILLED ||
      latestEx?.status === ExecutionStatus.PARTIAL,
    latestProtectionStatus:
      instruction.executionProtectionReports[0]?.protectionStatus ?? null,
    exposure,
  });

  if (!eligibility.canSubmitClose) {
    throw new RealManualCloseNoOrderError(
      eligibility.blockReason ??
        "Instruction não elegível para encerramento sem ordem apregoada.",
      "CLOSE_NOT_ELIGIBLE",
      400
    );
  }

  const operatorNoteRedacted = redactSensitiveMessage(input.operatorNote.trim());
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    await tx.instruction.update({
      where: { id: instruction.id },
      data: {
        currentStatus: OrderLogStatus.ORDER_NOT_PLACED,
        requiresProtectionConfirmation: false,
        protectionBlocked: false,
      },
    });

    await tx.instructionStatusLog.create({
      data: {
        instructionId: instruction.id,
        status: OrderLogStatus.ORDER_NOT_PLACED,
        message: "Instruction encerrada administrativamente sem ordem apregoada.",
        metadata: {
          event: CLOSE_NO_ORDER_STATUS_EVENT,
          reasonCode: input.reasonCode,
          operatorNote: operatorNoteRedacted,
          closedByAdminId: input.actorId,
          closedAt: now.toISOString(),
        },
      },
    });

    if (latestEx) {
      await tx.execution.update({
        where: { id: latestEx.id },
        data: {
          status: ExecutionStatus.REJECTED,
          errorCode: input.reasonCode,
          errorMessage: operatorNoteRedacted,
          executedAt: latestEx.executedAt ?? now,
        },
      });
    }

    const pendingReports = instruction.executionProtectionReports.filter(
      (r) => r.protectionStatus === ProtectionStatus.PROTECTION_PENDING
    );

    for (const report of pendingReports) {
      await tx.executionProtectionReport.update({
        where: { id: report.id },
        data: {
          protectionStatus: ProtectionStatus.SKIPPED_NO_POSITION,
          errorCode: input.reasonCode,
          errorMessageRedacted: operatorNoteRedacted,
          reportedAt: now,
        },
      });
    }

    if (
      pendingReports.length === 0 &&
      instruction.executionProtectionReports.length === 0 &&
      instruction.magicNumber != null &&
      instruction.accountLogin &&
      instruction.accountServer
    ) {
      await tx.executionProtectionReport.create({
        data: {
          instructionId: instruction.id,
          executionId: latestEx?.id ?? null,
          licenseId: instruction.licenseId,
          accountLogin: instruction.accountLogin,
          accountServer: instruction.accountServer,
          symbol: instruction.symbol,
          magicNumber: instruction.magicNumber,
          stopLossPresent: false,
          takeProfitPresent: false,
          protectionMode: "UNKNOWN",
          protectionStatus: ProtectionStatus.NOT_APPLICABLE,
          errorCode: input.reasonCode,
          errorMessageRedacted: operatorNoteRedacted,
          reportedAt: now,
        },
      });
    }

    return {
      instructionStatus: OrderLogStatus.ORDER_NOT_PLACED,
      executionStatus: ExecutionStatus.REJECTED,
      protectionStatus: ProtectionStatus.SKIPPED_NO_POSITION,
    };
  });

  await recordAdminAction({
    actorId: input.actorId,
    action: "real_trading.instruction.close_no_order",
    targetType: "instruction",
    targetId: instruction.id,
    ipAddress: input.ipAddress,
    metadata: {
      instructionId: instruction.id,
      reasonCode: input.reasonCode,
      operatorNote: operatorNoteRedacted,
      licenseId: instruction.licenseId,
      symbol: instruction.symbol,
      magicNumber: instruction.magicNumber,
    },
  });

  return {
    ok: true as const,
    instructionId: instruction.id,
    status: result.instructionStatus,
    executionStatus: latestEx ? result.executionStatus : null,
    protectionStatus: result.protectionStatus,
    reasonCode: input.reasonCode,
    message:
      "Instruction encerrada sem ordem apregoada. Nenhuma posição aberta e nenhuma exposição de risco registrada.",
  };
}

export function extractCloseReasonFromLogs(
  logs: { metadata: Prisma.JsonValue | null; status: OrderLogStatus }[]
): string | null {
  for (let i = logs.length - 1; i >= 0; i--) {
    const log = logs[i];
    if (!log.metadata || typeof log.metadata !== "object" || Array.isArray(log.metadata)) {
      continue;
    }
    const meta = log.metadata as Record<string, unknown>;
    if (meta.event === CLOSE_NO_ORDER_STATUS_EVENT && typeof meta.reasonCode === "string") {
      return meta.reasonCode;
    }
  }
  if (logs.some((l) => l.status === OrderLogStatus.ORDER_NOT_PLACED)) {
    return CLOSE_NO_ORDER_REASON_CODE;
  }
  return null;
}
