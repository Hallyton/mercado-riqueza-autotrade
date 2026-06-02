import {
  InstructionSource,
  OrderLogStatus,
  RealTradePreflightSource,
  type Prisma,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { redactSensitiveMessage } from "@/lib/risk/redact-message";
import {
  buildCloseNoOrderUiForInstruction,
  type CloseNoOrderEligibility,
} from "@/lib/admin/real-manual-close-no-order";
import {
  buildVoidFalseExecutionUiForInstruction,
  VOID_FALSE_EXECUTION_REASON_CODE,
  type VoidFalseExecutionEligibility,
} from "@/lib/admin/real-manual-void-false-execution";
import { CLOSE_NO_ORDER_REASON_CODE } from "@/lib/admin/real-manual-close-no-order";
import {
  extractManagementEventsFromLogs,
  formatManagementPlanListSummary,
  parseManagementPlanFromJson,
} from "@/lib/admin/real-manual-management-plan";

/** Origens exibidas em Conta real / Instruções reais. */
export const REAL_TRADING_INSTRUCTION_SOURCES: InstructionSource[] = [
  InstructionSource.REAL_MANUAL,
];

export type ListRealTradingInstructionsFilters = {
  licenseId?: string;
  accountLogin?: string;
  symbol?: string;
  magicNumber?: number;
  source?: InstructionSource;
  status?: OrderLogStatus;
  bulkBatchId?: string;
  clientEmail?: string;
  dateFrom?: Date;
  dateTo?: Date;
  take?: number;
};

function buildWhere(
  filters: ListRealTradingInstructionsFilters
): Prisma.InstructionWhereInput {
  const sources = filters.source
    ? REAL_TRADING_INSTRUCTION_SOURCES.includes(filters.source)
      ? [filters.source]
      : []
    : REAL_TRADING_INSTRUCTION_SOURCES;

  return {
    source: { in: sources.length > 0 ? sources : [InstructionSource.REAL_MANUAL] },
    ...(filters.licenseId ? { licenseId: filters.licenseId } : {}),
    ...(filters.accountLogin
      ? { accountLogin: filters.accountLogin.trim() }
      : {}),
    ...(filters.symbol
      ? { symbol: filters.symbol.trim().toUpperCase() }
      : {}),
    ...(filters.magicNumber != null ? { magicNumber: filters.magicNumber } : {}),
    ...(filters.bulkBatchId ? { bulkBatchId: filters.bulkBatchId.trim() } : {}),
    ...(filters.clientEmail
      ? {
          license: {
            user: {
              email: { contains: filters.clientEmail.trim(), mode: "insensitive" },
            },
          },
        }
      : {}),
    ...(filters.status ? { currentStatus: filters.status } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          createdAt: {
            ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
            ...(filters.dateTo ? { lte: filters.dateTo } : {}),
          },
        }
      : {}),
  };
}

export async function listRealTradingInstructionsAdmin(
  filters: ListRealTradingInstructionsFilters = {}
) {
  const rows = await prisma.instruction.findMany({
    where: buildWhere(filters),
    orderBy: { createdAt: "desc" },
    take: filters.take ?? 100,
    include: {
      license: {
        include: {
          user: { select: { email: true } },
        },
      },
      executions: {
        orderBy: { executedAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          executedAt: true,
          brokerTicket: true,
          errorCode: true,
          errorMessage: true,
        },
      },
      executionProtectionReports: {
        orderBy: { reportedAt: "desc" },
        take: 1,
        select: {
          id: true,
          protectionStatus: true,
          reportedAt: true,
          stopLossPresent: true,
          takeProfitPresent: true,
        },
      },
      realTradePreflights: {
        where: { source: RealTradePreflightSource.DRY_RUN },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true, createdAt: true },
      },
    },
  });

  const licenseIds = [...new Set(rows.map((r) => r.licenseId))];
  const heartbeats = await Promise.all(
    licenseIds.map(async (licenseId) => {
      const hb = await prisma.eaHeartbeat.findFirst({
        where: { licenseId },
        orderBy: { receivedAt: "desc" },
        select: { eaStatus: true, receivedAt: true, tradeMode: true },
      });
      return [licenseId, hb] as const;
    })
  );
  const hbByLicense = new Map(heartbeats);

  const instructionIds = rows.map((r) => r.id);
  const closeLogs =
    instructionIds.length > 0
      ? await prisma.instructionStatusLog.findMany({
          where: { instructionId: { in: instructionIds } },
          orderBy: { createdAt: "asc" },
          select: { instructionId: true, status: true, metadata: true },
        })
      : [];
  const closeReasonByInstruction = new Map<string, string | null>();
  for (const id of instructionIds) {
    const logs = closeLogs.filter((l) => l.instructionId === id);
    closeReasonByInstruction.set(id, extractAdminResolutionReasonFromLogs(logs));
  }

  return rows.map((row) => ({
    ...row,
    eaHeartbeat: hbByLicense.get(row.licenseId) ?? null,
    preflightId: row.realTradePreflights[0]?.id ?? null,
    latestExecution: row.executions[0] ?? null,
    latestProtection: row.executionProtectionReports[0] ?? null,
    closeReasonCode: closeReasonByInstruction.get(row.id) ?? null,
    managementPlanSummary: formatManagementPlanListSummary(
      parseManagementPlanFromJson(row.managementPlan)
    ),
  }));
}

export async function findRealManualInstructionByPreflightId(preflightId: string) {
  const preflight = await prisma.realTradePreflight.findUnique({
    where: { id: preflightId },
    select: { instructionId: true },
  });
  if (!preflight?.instructionId) return null;

  return prisma.instruction.findFirst({
    where: {
      id: preflight.instructionId,
      source: InstructionSource.REAL_MANUAL,
    },
    select: { id: true, currentStatus: true, source: true },
  });
}

export async function getRealTradingInstructionAdminDetail(instructionId: string) {
  const instruction = await prisma.instruction.findFirst({
    where: {
      id: instructionId,
      source: { in: REAL_TRADING_INSTRUCTION_SOURCES },
    },
    include: {
      license: {
        include: {
          user: { select: { email: true, id: true } },
        },
      },
      statusLogs: { orderBy: { createdAt: "asc" } },
      executions: { orderBy: { executedAt: "desc" } },
      executionProtectionReports: { orderBy: { reportedAt: "desc" } },
      realTradePreflights: {
        where: { source: RealTradePreflightSource.DRY_RUN },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!instruction) return null;

  const heartbeat = await prisma.eaHeartbeat.findFirst({
    where: { licenseId: instruction.licenseId },
    orderBy: { receivedAt: "desc" },
    select: {
      eaStatus: true,
      receivedAt: true,
      tradeMode: true,
    },
  });

  const preflightId =
    instruction.realTradePreflights[0]?.id ??
    extractPreflightIdFromStatusLogs(instruction.statusLogs);

  const instructionForAdmin = {
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
  };

  const [closeEligibility, voidEligibility] = await Promise.all([
    buildCloseNoOrderUiForInstruction(instructionForAdmin),
    buildVoidFalseExecutionUiForInstruction(instructionForAdmin),
  ]);
  const resolutionReasonCode = extractAdminResolutionReasonFromLogs(
    instruction.statusLogs
  );

  const redactedPayload = {
    source: instruction.source,
    purpose: instruction.purpose,
    symbol: instruction.symbol,
    side: instruction.side,
    orderType: instruction.orderType,
    orderPrice: instruction.orderPrice ? Number(instruction.orderPrice) : null,
    stopLoss: instruction.stopLoss ? Number(instruction.stopLoss) : null,
    takeProfit: instruction.takeProfit ? Number(instruction.takeProfit) : null,
    quantity: Number(instruction.quantity),
    magicNumber: instruction.magicNumber,
    accountLogin: instruction.accountLogin,
    accountServer: instruction.accountServer,
    currentStatus: instruction.currentStatus,
    requiresProtectionConfirmation: instruction.requiresProtectionConfirmation,
    protectionBlocked: instruction.protectionBlocked,
  };

  const managementPlan = parseManagementPlanFromJson(instruction.managementPlan);
  const managementEvents = extractManagementEventsFromLogs(instruction.statusLogs);

  return {
    instruction,
    preflightId,
    eaHeartbeat: heartbeat,
    redactedPayload,
    managementPlan,
    managementEvents,
    closeEligibility,
    voidEligibility,
    resolutionReasonCode,
    statusHistory: instruction.statusLogs.map((log) => {
      const metadata = sanitizeStatusMetadata(log.metadata);
      const event =
        metadata &&
        typeof metadata === "object" &&
        !Array.isArray(metadata) &&
        typeof (metadata as Record<string, unknown>).event === "string"
          ? ((metadata as Record<string, unknown>).event as string)
          : null;
      return {
        status: log.status,
        event,
        message: log.message ? redactSensitiveMessage(log.message) : null,
        createdAt: log.createdAt,
        metadata,
      };
    }),
    executions: instruction.executions.map((ex) => ({
      id: ex.id,
      status: ex.status,
      executedAt: ex.executedAt,
      brokerTicket: ex.brokerTicket,
      fillPrice: ex.fillPrice ? Number(ex.fillPrice) : null,
      errorCode: ex.errorCode,
      errorMessage: ex.errorMessage
        ? redactSensitiveMessage(ex.errorMessage)
        : null,
    })),
    protectionReports: instruction.executionProtectionReports.map((r) => ({
      id: r.id,
      protectionStatus: r.protectionStatus,
      reportedAt: r.reportedAt,
      stopLossPresent: r.stopLossPresent,
      takeProfitPresent: r.takeProfitPresent,
      errorCode: r.errorCode,
      errorMessage: r.errorMessageRedacted,
    })),
  };
}

function extractPreflightIdFromStatusLogs(
  logs: { metadata: Prisma.JsonValue | null }[]
): string | null {
  for (const log of logs) {
    if (!log.metadata || typeof log.metadata !== "object" || Array.isArray(log.metadata)) {
      continue;
    }
    const preflightId = (log.metadata as Record<string, unknown>).preflightId;
    if (typeof preflightId === "string" && preflightId.length > 0) {
      return preflightId;
    }
  }
  return null;
}

function sanitizeStatusMetadata(metadata: Prisma.JsonValue | null) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return metadata;
  }
  const obj = metadata as Record<string, unknown>;
  const allowed = [
    "preflightId",
    "source",
    "orderType",
    "orderPrice",
    "stopLossPrice",
    "takeProfitPrice",
    "requestedContracts",
    "code",
    "event",
    "reasonCode",
    "operatorNote",
    "closedByAdminId",
    "closedAt",
    "operatorAttestation",
    "voidedByAdminId",
    "voidedAt",
    "previousInstructionStatus",
    "previousExecutionStatus",
    "previousProtectionStatus",
    "managementEvent",
  ];
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in obj) out[key] = obj[key];
  }
  return out;
}

export function serializeRealTradingInstructionListItem(
  row: Awaited<ReturnType<typeof listRealTradingInstructionsAdmin>>[number]
) {
  return {
    instructionId: row.id,
    createdAt: row.createdAt.toISOString(),
    clientEmail: row.license.user.email,
    licenseId: row.licenseId,
    accountLogin: row.accountLogin,
    accountServer: row.accountServer,
    symbol: row.symbol,
    side: row.side,
    orderType: row.orderType,
    orderPrice: row.orderPrice != null ? Number(row.orderPrice) : null,
    stopLoss: row.stopLoss != null ? Number(row.stopLoss) : null,
    takeProfit: row.takeProfit != null ? Number(row.takeProfit) : null,
    contracts: Number(row.quantity),
    magicNumber: row.magicNumber,
    source: row.source,
    status: row.currentStatus,
    eaStatus: row.eaHeartbeat?.eaStatus ?? null,
    eaTradeMode: row.eaHeartbeat?.tradeMode ?? null,
    executionId: row.latestExecution?.id ?? null,
    executionStatus: row.latestExecution?.status ?? null,
    protectionStatus: row.latestProtection?.protectionStatus ?? null,
    preflightId: row.preflightId,
    closeReasonCode: row.closeReasonCode,
    managementPlanSummary: row.managementPlanSummary,
  };
}

export function extractAdminResolutionReasonFromLogs(
  logs: { metadata: Prisma.JsonValue | null; status: OrderLogStatus }[]
): string | null {
  for (let i = logs.length - 1; i >= 0; i--) {
    const log = logs[i];
    if (!log.metadata || typeof log.metadata !== "object" || Array.isArray(log.metadata)) {
      continue;
    }
    const meta = log.metadata as Record<string, unknown>;
    if (typeof meta.reasonCode === "string" && meta.reasonCode.length > 0) {
      return meta.reasonCode;
    }
  }
  if (logs.some((l) => l.status === OrderLogStatus.VOIDED_FALSE_EXECUTION)) {
    return VOID_FALSE_EXECUTION_REASON_CODE;
  }
  if (logs.some((l) => l.status === OrderLogStatus.ORDER_NOT_PLACED)) {
    return CLOSE_NO_ORDER_REASON_CODE;
  }
  return null;
}

export type { CloseNoOrderEligibility, VoidFalseExecutionEligibility };
