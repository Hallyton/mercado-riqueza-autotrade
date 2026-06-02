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

export const operatorAttestationSchema = z.object({
  noPendingOrder: z.literal(true),
  noOpenPosition: z.literal(true),
  noRiskExposure: z.literal(true),
  requiresNewPreflight: z.literal(true),
});

export type OperatorAttestation = z.infer<typeof operatorAttestationSchema>;

/** Status terminais — não permite novo encerramento. */
export const REAL_MANUAL_TERMINAL_INSTRUCTION_STATUSES: OrderLogStatus[] = [
  OrderLogStatus.ORDER_NOT_PLACED,
  OrderLogStatus.IGNORED,
  OrderLogStatus.CANCELLED,
];

export const closeNoOrderSchema = z.object({
  reasonCode: z.literal(CLOSE_NO_ORDER_REASON_CODE),
  operatorNote: z.string().min(10).max(2000),
  operatorAttestation: operatorAttestationSchema,
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

export function hasProtectionStatus(
  reports: { protectionStatus: ProtectionStatus }[],
  status: ProtectionStatus
): boolean {
  return reports.some((r) => r.protectionStatus === status);
}

export type CloseNoOrderExecutionInput = {
  status: ExecutionStatus;
  brokerTicket?: string | null;
  errorCode?: string | null;
};

/** Apenas a execução mais recente — evita bloquear por tentativa antiga FILLED. */
export function hasSuccessfulBrokerFill(
  executions: CloseNoOrderExecutionInput[]
): boolean {
  const latest = executions[0];
  if (!latest) return false;
  return (
    (latest.status === ExecutionStatus.FILLED ||
      latest.status === ExecutionStatus.PARTIAL) &&
    Boolean(latest.brokerTicket?.trim())
  );
}

export function executionIndicatesOrderNotPlaced(
  executions: CloseNoOrderExecutionInput[],
  currentStatus: OrderLogStatus
): boolean {
  const latest = executions[0];
  if (!latest) {
    return (
      currentStatus === OrderLogStatus.EXECUTED ||
      currentStatus === OrderLogStatus.REJECTED ||
      currentStatus === OrderLogStatus.SENT
    );
  }
  if (
    latest.status === ExecutionStatus.REJECTED ||
    latest.status === ExecutionStatus.EXPIRED
  ) {
    return true;
  }
  if (latest.errorCode?.trim()) {
    return true;
  }
  if (currentStatus === OrderLogStatus.EXECUTED && !latest.brokerTicket?.trim()) {
    return true;
  }
  return !hasSuccessfulBrokerFill(executions);
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
    heartbeatAvailable: Boolean(hb),
  };
}

export type CloseNoOrderEligibility = {
  /** Card “Ações administrativas” visível na página de detalhe. */
  showAdminActionsCard: boolean;
  /** Botão/formulário de encerramento habilitado. */
  canShowClosePanel: boolean;
  canCloseNoOrder: boolean;
  heartbeatWarning: string | null;
  blockReason: string | null;
};

export function evaluateCloseNoOrderEligibility(input: {
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
}): CloseNoOrderEligibility {
  const hideCard = (blockReason: string): CloseNoOrderEligibility => ({
    showAdminActionsCard: false,
    canShowClosePanel: false,
    canCloseNoOrder: false,
    heartbeatWarning: null,
    blockReason,
  });

  const showCardOnly = (blockReason: string): CloseNoOrderEligibility => ({
    showAdminActionsCard: true,
    canShowClosePanel: false,
    canCloseNoOrder: false,
    heartbeatWarning: null,
    blockReason,
  });
  if (input.source !== InstructionSource.REAL_MANUAL) {
    return hideCard("Apenas instructions REAL_MANUAL.");
  }

  if (hasClosedNoOrderInLogs(input.statusLogs)) {
    return hideCard("Instruction já encerrada sem ordem apregoada.");
  }

  if (input.currentStatus === OrderLogStatus.ORDER_NOT_PLACED) {
    return hideCard("Instruction já está ORDER_NOT_PLACED.");
  }

  if (
    REAL_MANUAL_TERMINAL_INSTRUCTION_STATUSES.includes(input.currentStatus) &&
    input.currentStatus !== OrderLogStatus.EXECUTED
  ) {
    return hideCard("Instruction em status final.");
  }

  if (hasProtectionStatus(input.protectionReports, ProtectionStatus.PROTECTION_CONFIRMED)) {
    return showCardOnly("Proteção já confirmada — encerramento não aplicável.");
  }

  if (hasProtectionStatus(input.protectionReports, ProtectionStatus.PROTECTION_FAILED)) {
    return showCardOnly("Proteção em falha — use o fluxo de proteção antes de encerrar.");
  }

  const protectionPending =
    hasProtectionStatus(input.protectionReports, ProtectionStatus.PROTECTION_PENDING) ||
    (input.requiresProtectionConfirmation === true &&
      !hasProtectionStatus(input.protectionReports, ProtectionStatus.PROTECTION_CONFIRMED) &&
      !hasProtectionStatus(input.protectionReports, ProtectionStatus.PROTECTION_FAILED));

  if (!protectionPending) {
    return showCardOnly(
      "Encerramento disponível quando há proteção pendente ou confirmação de proteção ainda não resolvida."
    );
  }

  const orderNotPlaced = executionIndicatesOrderNotPlaced(
    input.executions,
    input.currentStatus
  );

  if (!orderNotPlaced) {
    return showCardOnly(
      "Estado operacional indica execução preenchida no broker — encerramento não aplicável."
    );
  }

  const warnings: string[] = [];
  if (input.exposure.hasOpenPosition) {
    warnings.push(
      "O último heartbeat reportou posição aberta para este símbolo/magic. Confirme no MT5 antes de atestar."
    );
  }
  if (input.exposure.hasPendingBrokerOrder) {
    warnings.push(
      "O último heartbeat reportou ordem pendente no broker. Confirme no MT5 antes de atestar."
    );
  }
  if (input.exposure.hasOtherArmedInstruction) {
    warnings.push(
      "Há outra instruction RECEIVED/SENT para o mesmo símbolo — verifique conflito operacional."
    );
  }
  if (!input.exposure.heartbeatAvailable) {
    warnings.push(
      "Sem heartbeat recente no sistema — use a atestação manual após verificar o MT5."
    );
  }

  return {
    showAdminActionsCard: true,
    canShowClosePanel: true,
    canCloseNoOrder: true,
    heartbeatWarning: warnings.length > 0 ? warnings.join(" ") : null,
    blockReason: null,
  };
}

export type InstructionForCloseNoOrderUi = {
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
};

export async function buildCloseNoOrderUiForInstruction(
  instruction: InstructionForCloseNoOrderUi
): Promise<CloseNoOrderEligibility> {
  if (instruction.source !== InstructionSource.REAL_MANUAL) {
    return {
      showAdminActionsCard: false,
      canShowClosePanel: false,
      canCloseNoOrder: false,
      heartbeatWarning: null,
      blockReason: "Apenas instructions REAL_MANUAL.",
    };
  }

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
    executions: instruction.executions,
    protectionReports: instruction.executionProtectionReports,
    requiresProtectionConfirmation: instruction.requiresProtectionConfirmation,
    exposure,
  });
}

export async function getRealManualCloseNoOrderEligibility(instructionId: string) {
  const instruction = await prisma.instruction.findUnique({
    where: { id: instructionId },
    include: {
      statusLogs: { orderBy: { createdAt: "asc" } },
      executions: { orderBy: { executedAt: "desc" } },
      executionProtectionReports: { orderBy: { reportedAt: "desc" } },
    },
  });
  if (!instruction || instruction.source !== InstructionSource.REAL_MANUAL) {
    return null;
  }

  return buildCloseNoOrderUiForInstruction({
    id: instruction.id,
    source: instruction.source,
    licenseId: instruction.licenseId,
    symbol: instruction.symbol,
    magicNumber: instruction.magicNumber,
    currentStatus: instruction.currentStatus,
    requiresProtectionConfirmation: instruction.requiresProtectionConfirmation,
    statusLogs: instruction.statusLogs,
    executions: instruction.executions.map((ex) => ({
      status: ex.status,
      brokerTicket: ex.brokerTicket,
      errorCode: ex.errorCode,
    })),
    executionProtectionReports: instruction.executionProtectionReports,
  });
}

function validateOperatorAttestation(attestation: OperatorAttestation) {
  if (
    !attestation.noPendingOrder ||
    !attestation.noOpenPosition ||
    !attestation.noRiskExposure ||
    !attestation.requiresNewPreflight
  ) {
    throw new RealManualCloseNoOrderError(
      "Todas as atestações operacionais são obrigatórias.",
      "OPERATOR_ATTESTATION_INCOMPLETE",
      400
    );
  }
}

export async function closeRealManualInstructionNoOrder(input: {
  instructionId: string;
  actorId: string;
  reasonCode: typeof CLOSE_NO_ORDER_REASON_CODE;
  operatorNote: string;
  operatorAttestation: OperatorAttestation;
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

  validateOperatorAttestation(input.operatorAttestation);

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

  const previousStatus = instruction.currentStatus;

  if (instruction.source !== InstructionSource.REAL_MANUAL) {
    throw new RealManualCloseNoOrderError(
      "Apenas instructions REAL_MANUAL podem ser encerradas por este fluxo.",
      "SOURCE_NOT_REAL_MANUAL",
      400
    );
  }

  if (hasProtectionStatus(instruction.executionProtectionReports, ProtectionStatus.PROTECTION_CONFIRMED)) {
    throw new RealManualCloseNoOrderError(
      "Não é permitido encerrar instruction com proteção confirmada.",
      "PROTECTION_ALREADY_CONFIRMED",
      409
    );
  }

  if (hasClosedNoOrderInLogs(instruction.statusLogs)) {
    throw new RealManualCloseNoOrderError(
      "Instruction já foi encerrada sem ordem apregoada.",
      "REAL_MANUAL_ALREADY_CLOSED",
      409
    );
  }

  if (instruction.currentStatus === OrderLogStatus.ORDER_NOT_PLACED) {
    throw new RealManualCloseNoOrderError(
      "Instruction já está ORDER_NOT_PLACED.",
      "REAL_MANUAL_ALREADY_CLOSED",
      409
    );
  }

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
    executions: instruction.executions.map((ex) => ({
      status: ex.status,
      brokerTicket: ex.brokerTicket,
      errorCode: ex.errorCode,
    })),
    protectionReports: instruction.executionProtectionReports,
    requiresProtectionConfirmation: instruction.requiresProtectionConfirmation,
    exposure,
  });

  if (!eligibility.canCloseNoOrder) {
    throw new RealManualCloseNoOrderError(
      eligibility.blockReason ??
        "Instruction não elegível para encerramento sem ordem apregoada.",
      "INSTRUCTION_NOT_ELIGIBLE_FOR_CLOSE_NO_ORDER",
      400
    );
  }

  if (exposure.hasOtherArmedInstruction) {
    throw new RealManualCloseNoOrderError(
      "Há outra instruction armada (RECEIVED/SENT) para o mesmo símbolo.",
      "OTHER_ARMED_INSTRUCTION",
      409
    );
  }

  const operatorNoteRedacted = redactSensitiveMessage(input.operatorNote.trim());
  const now = new Date();
  const latestEx = instruction.executions[0] ?? null;

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
          operatorAttestation: input.operatorAttestation,
          closedByAdminId: input.actorId,
          closedAt: now.toISOString(),
        },
      },
    });

    if (latestEx) {
      const nextExecutionStatus =
        latestEx.status === ExecutionStatus.REJECTED ||
        latestEx.status === ExecutionStatus.EXPIRED
          ? latestEx.status
          : ExecutionStatus.REJECTED;

      await tx.execution.update({
        where: { id: latestEx.id },
        data: {
          status: nextExecutionStatus,
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
      executionStatus: latestEx?.status ?? null,
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
      operatorAttestation: input.operatorAttestation,
      previousStatus,
      newStatus: OrderLogStatus.ORDER_NOT_PLACED,
      closedAt: now.toISOString(),
      licenseId: instruction.licenseId,
      symbol: instruction.symbol,
      magicNumber: instruction.magicNumber,
    },
  });

  return {
    ok: true as const,
    instructionId: instruction.id,
    status: result.instructionStatus,
    executionStatus: result.executionStatus,
    protectionStatus: result.protectionStatus,
    reasonCode: input.reasonCode,
    message:
      "Instruction encerrada sem ordem apregoada. Nenhuma posição aberta, nenhuma ordem pendente e nenhuma exposição de risco foram atestadas pelo operador.",
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
