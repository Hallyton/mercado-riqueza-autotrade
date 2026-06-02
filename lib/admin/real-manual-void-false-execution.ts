import {
  ExecutionStatus,
  InstructionSource,
  OrderLogStatus,
  ProtectionStatus,
  type Prisma,
} from "@prisma/client";
import { z } from "zod";
import { recordAdminAction } from "@/lib/admin/record-action";
import {
  assessLicenseExposureForClose,
  hasProtectionStatus,
  type CloseNoOrderExecutionInput,
} from "@/lib/admin/real-manual-close-no-order";
import prisma from "@/lib/prisma";
import { redactSensitiveMessage } from "@/lib/risk/redact-message";

export const VOID_FALSE_EXECUTION_CONFIRM_PHRASE =
  "ANULAR FALSO POSITIVO DE EXECUCAO";

export const VOID_FALSE_EXECUTION_REASON_CODE = "BROKER_EXECUTION_FALSE_POSITIVE";

export const VOID_FALSE_EXECUTION_STATUS_EVENT = "VOIDED_FALSE_EXECUTION";

export const voidFalseExecutionAttestationSchema = z.object({
  checkedMt5: z.literal(true),
  noPendingOrder: z.literal(true),
  noOpenPosition: z.literal(true),
  noRiskExposure: z.literal(true),
  brokerExecutionWasFalsePositive: z.literal(true),
  requiresNewPreflight: z.literal(true),
});

export type VoidFalseExecutionAttestation = z.infer<
  typeof voidFalseExecutionAttestationSchema
>;

export const voidFalseExecutionSchema = z.object({
  reasonCode: z.literal(VOID_FALSE_EXECUTION_REASON_CODE),
  operatorNote: z.string().min(10).max(2000),
  operatorAttestation: voidFalseExecutionAttestationSchema,
  adminConfirmation: z.string().min(1),
});

export class RealManualVoidFalseExecutionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "RealManualVoidFalseExecutionError";
  }
}

export function hasVoidedFalseExecutionInLogs(
  logs: { metadata: Prisma.JsonValue | null; status: OrderLogStatus }[]
): boolean {
  if (logs.some((l) => l.status === OrderLogStatus.VOIDED_FALSE_EXECUTION)) {
    return true;
  }
  return logs.some((log) => {
    if (!log.metadata || typeof log.metadata !== "object" || Array.isArray(log.metadata)) {
      return false;
    }
    return (
      (log.metadata as Record<string, unknown>).event === VOID_FALSE_EXECUTION_STATUS_EVENT
    );
  });
}

export function latestExecutionLooksFilled(
  executions: CloseNoOrderExecutionInput[]
): boolean {
  const latest = executions[0];
  if (!latest) return false;
  return (
    latest.status === ExecutionStatus.FILLED ||
    latest.status === ExecutionStatus.PARTIAL
  );
}

export type VoidFalseExecutionEligibility = {
  showAdminActionsCard: boolean;
  canVoidFalseExecution: boolean;
  heartbeatWarning: string | null;
  blockReason: string | null;
};

export function evaluateVoidFalseExecutionEligibility(input: {
  source: InstructionSource | null;
  currentStatus: OrderLogStatus;
  statusLogs: { metadata: Prisma.JsonValue | null; status: OrderLogStatus }[];
  executions: CloseNoOrderExecutionInput[];
  protectionReports: { protectionStatus: ProtectionStatus }[];
  requiresProtectionConfirmation?: boolean;
  exposure: {
    hasOpenPosition: boolean;
    hasPendingBrokerOrder: boolean;
    hasOtherArmedInstruction: boolean;
    heartbeatAvailable: boolean;
  };
}): VoidFalseExecutionEligibility {
  const hide = (blockReason: string): VoidFalseExecutionEligibility => ({
    showAdminActionsCard: false,
    canVoidFalseExecution: false,
    heartbeatWarning: null,
    blockReason,
  });

  const showBlocked = (blockReason: string): VoidFalseExecutionEligibility => ({
    showAdminActionsCard: true,
    canVoidFalseExecution: false,
    heartbeatWarning: null,
    blockReason,
  });

  if (input.source !== InstructionSource.REAL_MANUAL) {
    return hide("Apenas instructions REAL_MANUAL.");
  }

  if (hasVoidedFalseExecutionInLogs(input.statusLogs)) {
    return hide("Instruction já anulada por falso positivo de execução.");
  }

  if (input.currentStatus === OrderLogStatus.VOIDED_FALSE_EXECUTION) {
    return hide("Instruction já está VOIDED_FALSE_EXECUTION.");
  }

  if (hasProtectionStatus(input.protectionReports, ProtectionStatus.PROTECTION_CONFIRMED)) {
    return showBlocked("Proteção confirmada — anulação não aplicável.");
  }

  if (hasProtectionStatus(input.protectionReports, ProtectionStatus.PROTECTION_FAILED)) {
    return showBlocked("Proteção em falha — resolva antes de anular.");
  }

  const protectionPending =
    hasProtectionStatus(input.protectionReports, ProtectionStatus.PROTECTION_PENDING) ||
    (input.requiresProtectionConfirmation === true &&
      !hasProtectionStatus(input.protectionReports, ProtectionStatus.PROTECTION_CONFIRMED) &&
      !hasProtectionStatus(input.protectionReports, ProtectionStatus.PROTECTION_FAILED));

  if (!protectionPending) {
    return showBlocked(
      "Anulação disponível quando há proteção pendente ou confirmação não resolvida."
    );
  }

  const falsePositiveCase =
    latestExecutionLooksFilled(input.executions) ||
    input.currentStatus === OrderLogStatus.EXECUTED;

  if (!falsePositiveCase) {
    return showBlocked(
      "Anulação aplicável quando o sistema registrou execução preenchida (falso positivo)."
    );
  }

  const warnings: string[] = [];
  if (input.exposure.hasOpenPosition) {
    return showBlocked(
      "Há posição aberta reportada pelo EA — não é possível anular como falso positivo."
    );
  }
  if (input.exposure.hasPendingBrokerOrder) {
    warnings.push(
      "Heartbeat reportou ordem pendente — confirme no MT5 antes de atestar falso positivo."
    );
  }
  if (input.exposure.hasOtherArmedInstruction) {
    warnings.push("Há outra instruction RECEIVED/SENT para o mesmo símbolo.");
  }
  if (!input.exposure.heartbeatAvailable) {
    warnings.push("Sem heartbeat recente — ateste manualmente no MT5.");
  }

  return {
    showAdminActionsCard: true,
    canVoidFalseExecution: true,
    heartbeatWarning: warnings.length > 0 ? warnings.join(" ") : null,
    blockReason: null,
  };
}

export async function buildVoidFalseExecutionUiForInstruction(
  instruction: {
    id: string;
    source: InstructionSource | null;
    licenseId: string;
    symbol: string;
    magicNumber: number | null;
    currentStatus: OrderLogStatus;
    requiresProtectionConfirmation: boolean;
    statusLogs: { metadata: Prisma.JsonValue | null; status: OrderLogStatus }[];
    executions: CloseNoOrderExecutionInput[];
    executionProtectionReports: { protectionStatus: ProtectionStatus }[];
  }
): Promise<VoidFalseExecutionEligibility> {
  const exposure = await assessLicenseExposureForClose({
    licenseId: instruction.licenseId,
    symbol: instruction.symbol,
    magicNumber: instruction.magicNumber,
    excludeInstructionId: instruction.id,
  });

  return evaluateVoidFalseExecutionEligibility({
    source: instruction.source,
    currentStatus: instruction.currentStatus,
    statusLogs: instruction.statusLogs,
    executions: instruction.executions,
    protectionReports: instruction.executionProtectionReports,
    requiresProtectionConfirmation: instruction.requiresProtectionConfirmation,
    exposure,
  });
}

function validateAttestation(attestation: VoidFalseExecutionAttestation) {
  if (
    !attestation.checkedMt5 ||
    !attestation.noPendingOrder ||
    !attestation.noOpenPosition ||
    !attestation.noRiskExposure ||
    !attestation.brokerExecutionWasFalsePositive ||
    !attestation.requiresNewPreflight
  ) {
    throw new RealManualVoidFalseExecutionError(
      "Todas as atestações operacionais são obrigatórias.",
      "OPERATOR_ATTESTATION_INCOMPLETE",
      400
    );
  }
}

export async function voidRealManualFalseExecution(input: {
  instructionId: string;
  actorId: string;
  reasonCode: typeof VOID_FALSE_EXECUTION_REASON_CODE;
  operatorNote: string;
  operatorAttestation: VoidFalseExecutionAttestation;
  adminConfirmation: string;
  ipAddress?: string | null;
}) {
  if (input.adminConfirmation.trim() !== VOID_FALSE_EXECUTION_CONFIRM_PHRASE) {
    throw new RealManualVoidFalseExecutionError(
      `Confirmação inválida. Digite: ${VOID_FALSE_EXECUTION_CONFIRM_PHRASE}`,
      "CONFIRMATION_MISMATCH",
      400
    );
  }

  if (!input.operatorNote.trim()) {
    throw new RealManualVoidFalseExecutionError(
      "Nota operacional é obrigatória.",
      "OPERATOR_NOTE_REQUIRED",
      400
    );
  }

  validateAttestation(input.operatorAttestation);

  const instruction = await prisma.instruction.findUnique({
    where: { id: input.instructionId },
    include: {
      statusLogs: { orderBy: { createdAt: "asc" } },
      executions: { orderBy: { executedAt: "desc" } },
      executionProtectionReports: { orderBy: { reportedAt: "desc" } },
    },
  });

  if (!instruction) {
    throw new RealManualVoidFalseExecutionError(
      "Instruction não encontrada.",
      "INSTRUCTION_NOT_FOUND",
      404
    );
  }

  const previousInstructionStatus = instruction.currentStatus;
  const previousExecutionStatus = instruction.executions[0]?.status ?? null;
  const previousProtectionStatus =
    instruction.executionProtectionReports[0]?.protectionStatus ?? null;

  if (instruction.source !== InstructionSource.REAL_MANUAL) {
    throw new RealManualVoidFalseExecutionError(
      "Apenas instructions REAL_MANUAL.",
      "SOURCE_NOT_REAL_MANUAL",
      400
    );
  }

  if (hasVoidedFalseExecutionInLogs(instruction.statusLogs)) {
    throw new RealManualVoidFalseExecutionError(
      "Instruction já anulada.",
      "REAL_MANUAL_ALREADY_VOIDED",
      409
    );
  }

  const exposure = await assessLicenseExposureForClose({
    licenseId: instruction.licenseId,
    symbol: instruction.symbol,
    magicNumber: instruction.magicNumber,
    excludeInstructionId: instruction.id,
  });

  if (exposure.hasOpenPosition) {
    throw new RealManualVoidFalseExecutionError(
      "Posição aberta reportada — anulação bloqueada.",
      "OPEN_POSITION_DETECTED",
      409
    );
  }

  const eligibility = evaluateVoidFalseExecutionEligibility({
    source: instruction.source,
    currentStatus: instruction.currentStatus,
    statusLogs: instruction.statusLogs,
    executions: instruction.executions.map((ex) => ({
      status: ex.status,
      brokerTicket: ex.brokerTicket,
      errorCode: ex.errorCode,
    })),
    protectionReports: instruction.executionProtectionReports,
    requiresProtectionConfirmation: instruction.requiresProtectionConfirmation,
    exposure,
  });

  if (!eligibility.canVoidFalseExecution) {
    throw new RealManualVoidFalseExecutionError(
      eligibility.blockReason ?? "Instruction não elegível para anulação.",
      "INSTRUCTION_NOT_ELIGIBLE_FOR_VOID",
      400
    );
  }

  const operatorNoteRedacted = redactSensitiveMessage(input.operatorNote.trim());
  const now = new Date();
  const latestEx = instruction.executions[0] ?? null;

  const result = await prisma.$transaction(async (tx) => {
    await tx.instruction.update({
      where: { id: instruction.id },
      data: {
        currentStatus: OrderLogStatus.VOIDED_FALSE_EXECUTION,
        requiresProtectionConfirmation: false,
        protectionBlocked: false,
      },
    });

    await tx.instructionStatusLog.create({
      data: {
        instructionId: instruction.id,
        status: OrderLogStatus.VOIDED_FALSE_EXECUTION,
        message:
          "Instruction anulada administrativamente por falso positivo de execução no broker.",
        metadata: {
          event: VOID_FALSE_EXECUTION_STATUS_EVENT,
          reasonCode: input.reasonCode,
          operatorNote: operatorNoteRedacted,
          operatorAttestation: input.operatorAttestation,
          previousInstructionStatus,
          previousExecutionStatus,
          previousProtectionStatus,
          voidedByAdminId: input.actorId,
          voidedAt: now.toISOString(),
        },
      },
    });

    if (latestEx) {
      await tx.execution.update({
        where: { id: latestEx.id },
        data: {
          status: ExecutionStatus.VOIDED,
          errorCode: input.reasonCode,
          errorMessage: operatorNoteRedacted,
          executedAt: latestEx.executedAt ?? now,
        },
      });
    }

    for (const report of instruction.executionProtectionReports.filter(
      (r) => r.protectionStatus === ProtectionStatus.PROTECTION_PENDING
    )) {
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

    return {
      instructionStatus: OrderLogStatus.VOIDED_FALSE_EXECUTION,
      executionStatus: ExecutionStatus.VOIDED,
      protectionStatus: ProtectionStatus.SKIPPED_NO_POSITION,
    };
  });

  await recordAdminAction({
    actorId: input.actorId,
    action: "real_trading.instruction.void_false_execution",
    targetType: "instruction",
    targetId: instruction.id,
    ipAddress: input.ipAddress,
    metadata: {
      instructionId: instruction.id,
      reasonCode: input.reasonCode,
      operatorNote: operatorNoteRedacted,
      operatorAttestation: input.operatorAttestation,
      previousInstructionStatus,
      previousExecutionStatus,
      previousProtectionStatus,
      newStatus: result.instructionStatus,
      voidedAt: now.toISOString(),
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
      "Instruction anulada por falso positivo de execução. Nenhuma ordem pendente, nenhuma posição aberta e nenhuma exposição de risco foram atestadas pelo operador.",
  };
}
