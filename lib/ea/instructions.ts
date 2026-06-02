import {
  AuditActorType,
  ExecutionStatus,
  InstructionPurpose,
  OrderLogStatus,
  TradeMode,
  type Prisma,
} from "@prisma/client";
import { createAuditLog } from "@/lib/audit/log";
import { assertInstructionAllowed, LicensePolicyError } from "@/lib/licensing/instruction-policy";
import { getLicenseOperationalFlags } from "@/lib/licensing/service";
import prisma from "@/lib/prisma";
import { markProtectionPendingForRealExecution } from "@/lib/risk/execution-protection";
import { redactSensitiveMessage } from "@/lib/risk/redact-message";
import { REAL_TRADING_REASONS } from "@/lib/risk/real-trading-reasons";
import { runRealTradePreflight } from "@/lib/risk/real-trade-preflight";
import {
  evaluateRealTradingGuardAsync,
  type RealTradingGuardDecision,
} from "@/lib/risk/real-trading-guard";
import type { EaAuthContext } from "./auth";

export type EaInstructionPayload = {
  instruction_id: string;
  purpose: InstructionPurpose;
  symbol: string;
  side: string;
  order_type: string;
  order_price?: number;
  quantity: number;
  stop_loss: number | null;
  take_profit: number | null;
  expires_at: string;
  idempotency_key: string;
  magic_number?: number;
  account_login?: string;
  account_server?: string;
  requires_protection_confirmation?: boolean;
  protection_required?: boolean;
  trade_mode?: "REAL" | "DEMO";
  requested_contracts?: number;
  controlled_real_gate?: boolean;
  source?: string;
};

function toNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (value == null) return null;
  return Number(value);
}

const redactOperationalMessage = redactSensitiveMessage;

export function mapInstructionToEaPayload(
  instruction: {
    id: string;
    purpose: InstructionPurpose;
    symbol: string;
    side: string;
    orderType: string;
    orderPrice?: Prisma.Decimal | null;
    quantity: Prisma.Decimal;
    stopLoss: Prisma.Decimal | null;
    takeProfit: Prisma.Decimal | null;
    expiresAt: Date;
    idempotencyKey: string;
    magicNumber?: number | null;
    accountLogin?: string | null;
    accountServer?: string | null;
    requiresProtectionConfirmation?: boolean;
    source?: string | null;
  }
): EaInstructionPayload {
  const payload: EaInstructionPayload = {
    instruction_id: instruction.id,
    purpose: instruction.purpose,
    symbol: instruction.symbol,
    side: instruction.side,
    order_type: instruction.orderType,
    ...(instruction.orderPrice != null
      ? { order_price: Number(instruction.orderPrice) }
      : {}),
    quantity: Number(instruction.quantity),
    stop_loss: toNumber(instruction.stopLoss),
    take_profit: toNumber(instruction.takeProfit),
    expires_at: instruction.expiresAt.toISOString(),
    idempotency_key: instruction.idempotencyKey,
  };
  if (instruction.magicNumber != null) {
    payload.magic_number = instruction.magicNumber;
  }
  if (instruction.accountLogin) {
    payload.account_login = instruction.accountLogin;
  }
  if (instruction.accountServer) {
    payload.account_server = instruction.accountServer;
  }
  if (instruction.requiresProtectionConfirmation) {
    payload.requires_protection_confirmation = true;
    payload.protection_required = true;
  }
  if (instruction.source) {
    payload.source = instruction.source;
  }
  return payload;
}

export function mapInstructionToEaPayloadForReal(
  instruction: Parameters<typeof mapInstructionToEaPayload>[0],
  options: {
    accountLogin: string;
    accountServer: string;
    requestedContracts: number;
  }
): EaInstructionPayload {
  const payload = mapInstructionToEaPayload(instruction);
  payload.trade_mode = "REAL";
  payload.account_login = options.accountLogin;
  payload.account_server = options.accountServer;
  payload.requested_contracts = options.requestedContracts;
  payload.requires_protection_confirmation = true;
  payload.protection_required = true;
  payload.controlled_real_gate = true;
  payload.source = instruction.source ?? "MASTER_SIGNAL";
  return payload;
}

async function appendStatus(
  instructionId: string,
  status: OrderLogStatus,
  message?: string,
  metadata?: Prisma.InputJsonValue
) {
  const safeMessage = redactOperationalMessage(message);
  await prisma.$transaction([
    prisma.instruction.update({
      where: { id: instructionId },
      data: { currentStatus: status },
    }),
    prisma.instructionStatusLog.create({
      data: {
        instructionId,
        status,
        message: safeMessage,
        metadata,
      },
    }),
  ]);
}

/** Candidatas ao EA: RECEIVED ou SENT ainda sem registro de execução, não expiradas. */
export function deliverableInstructionWhere(
  licenseId: string,
  now: Date
): Prisma.InstructionWhereInput {
  return {
    licenseId,
    expiresAt: { gt: now },
    OR: [
      { currentStatus: OrderLogStatus.RECEIVED },
      {
        currentStatus: OrderLogStatus.SENT,
        executions: { none: {} },
      },
    ],
  };
}

type InstructionRow = {
  id: string;
  purpose: InstructionPurpose;
  symbol: string;
  side: string;
  orderType: string;
  orderPrice: Prisma.Decimal | null;
  quantity: Prisma.Decimal;
  stopLoss: Prisma.Decimal | null;
  takeProfit: Prisma.Decimal | null;
  expiresAt: Date;
  idempotencyKey: string;
  currentStatus: OrderLogStatus;
  magicNumber: number | null;
  accountLogin: string | null;
  accountServer: string | null;
  requiresProtectionConfirmation: boolean;
  protectionBlocked: boolean;
  source: string | null;
};

async function listDeliverableInstructionCandidates(
  licenseId: string,
  now = new Date()
): Promise<InstructionRow[]> {
  return prisma.instruction.findMany({
    where: deliverableInstructionWhere(licenseId, now),
    orderBy: { createdAt: "asc" },
    take: 20,
  });
}

async function loadLatestTradeMode(licenseId: string): Promise<TradeMode | null> {
  const heartbeat = await prisma.eaHeartbeat.findFirst({
    where: { licenseId },
    orderBy: { receivedAt: "desc" },
    select: { tradeMode: true },
  });
  return heartbeat?.tradeMode ?? null;
}

export async function evaluateEaRealTradingGuard(
  licenseId: string
): Promise<RealTradingGuardDecision> {
  const tradeMode = await loadLatestTradeMode(licenseId);
  const license = await prisma.license.findUnique({
    where: { id: licenseId },
    select: { userId: true },
  });
  return evaluateRealTradingGuardAsync({
    tradeMode,
    licenseId,
    userId: license?.userId,
  });
}

async function evaluateInstructionDeliverability(
  licenseId: string,
  instruction: InstructionRow,
  options?: { tradeMode?: TradeMode | null; userId?: string }
): Promise<
  | { deliver: true; gateCode?: string; preflightId?: string }
  | { deliver: false; reason: string; code?: string }
> {
  if (instruction.protectionBlocked) {
    return {
      deliver: false,
      reason: "Stop/take não confirmados. Operação bloqueada.",
      code: REAL_TRADING_REASONS.PROTECTION_NOT_CONFIRMED,
    };
  }

  try {
    await assertInstructionAllowed(licenseId, instruction.purpose);
  } catch (e) {
    if (e instanceof LicensePolicyError) {
      return { deliver: false, reason: e.message, code: e.code };
    }
    throw e;
  }

  const tradeMode = options?.tradeMode ?? null;
  if (tradeMode !== TradeMode.REAL) {
    return { deliver: true };
  }

  if (instruction.source === "TEST") {
    return {
      deliver: false,
      reason: "Instruction TEST nao permitida para device REAL.",
      code: "TEST_INSTRUCTION_NOT_ALLOWED_IN_REAL",
    };
  }
  if (instruction.source === "HOMOLOGATION") {
    return {
      deliver: false,
      reason: "Instruction HOMOLOGATION nao permitida para device REAL.",
      code: "HOMOLOGATION_INSTRUCTION_NOT_ALLOWED_IN_REAL",
    };
  }
  if (
    instruction.source !== "REAL_MANUAL" &&
    instruction.source !== "MASTER_SIGNAL"
  ) {
    return {
      deliver: false,
      reason: "Source de instruction invalida para tradeMode REAL.",
      code: "REAL_SOURCE_NOT_ALLOWED",
    };
  }

  if (instruction.magicNumber == null) {
    return {
      deliver: false,
      reason: "MagicNumber obrigatório para conta real.",
      code: REAL_TRADING_REASONS.MAGIC_MISMATCH,
    };
  }

  const login =
    instruction.accountLogin ??
    (
      await prisma.license.findUnique({
        where: { id: licenseId },
        include: { mt5Account: true },
      })
    )?.mt5Account?.login;
  const server =
    instruction.accountServer ??
    (
      await prisma.license.findUnique({
        where: { id: licenseId },
        include: { mt5Account: true },
      })
    )?.mt5Account?.server;

  if (!login || !server) {
    return {
      deliver: false,
      reason: "Conta MT5 não vinculada para operação real.",
      code: REAL_TRADING_REASONS.ACCOUNT_MISMATCH,
    };
  }

  const userId =
    options?.userId ??
    (
      await prisma.license.findUnique({
        where: { id: licenseId },
        select: { userId: true },
      })
    )?.userId;

  if (!userId) {
    return {
      deliver: false,
      reason: "Licença inválida.",
      code: REAL_TRADING_REASONS.LICENSE_NOT_ACTIVE,
    };
  }

  const preflight = await runRealTradePreflight({
    userId,
    licenseId,
    instructionId: instruction.id,
    accountLogin: login,
    accountServer: server,
    symbol: instruction.symbol,
    magicNumber: instruction.magicNumber,
    requestedContracts: Math.max(1, Math.ceil(Number(instruction.quantity))),
    environment: TradeMode.REAL,
  });

  if (!preflight.passed) {
    return {
      deliver: false,
      reason: preflight.reason ?? "Preflight de conta real falhou.",
      code: preflight.reasonCode ?? REAL_TRADING_REASONS.PREFLIGHT_FAILED,
    };
  }

  return {
    deliver: true,
    gateCode: REAL_TRADING_REASONS.ALLOWED_BY_CONTROLLED_GATE,
    preflightId: preflight.preflightId,
  };
}

export type EaDeliverableInstructionsAudit = {
  candidateCount: number;
  deliverableCount: number;
  skipped: Array<{
    instructionId: string;
    currentStatus: OrderLogStatus;
    reason: string;
    code?: string;
  }>;
};

/** Mesma definição de entregável usada no pull e no heartbeat (sem efeitos colaterais). */
export async function auditDeliverableInstructionsForEa(
  licenseId: string,
  now = new Date(),
  userIdHint?: string
): Promise<EaDeliverableInstructionsAudit> {
  const realTradingGuard = await evaluateEaRealTradingGuard(licenseId);
  const tradeMode = await loadLatestTradeMode(licenseId);
  if (!realTradingGuard.allowed) {
    return {
      candidateCount: 0,
      deliverableCount: 0,
      skipped: [],
    };
  }

  const userId =
    userIdHint ??
    (
      await prisma.license.findUnique({
        where: { id: licenseId },
        select: { userId: true },
      })
    )?.userId;

  const candidates = await listDeliverableInstructionCandidates(licenseId, now);
  const skipped: EaDeliverableInstructionsAudit["skipped"] = [];
  let deliverableCount = 0;

  for (const instruction of candidates) {
    const check = await evaluateInstructionDeliverability(licenseId, instruction, {
      tradeMode,
      userId,
    });
    if (check.deliver) {
      deliverableCount++;
    } else {
      skipped.push({
        instructionId: instruction.id,
        currentStatus: instruction.currentStatus,
        reason: check.reason,
        code: check.code,
      });
    }
  }

  return {
    candidateCount: candidates.length,
    deliverableCount,
    skipped,
  };
}

/** Contagem alinhada com GET /api/v1/ea/instructions (política + fila entregável). */
export async function countDeliverableInstructionsForEa(
  licenseId: string,
  now = new Date(),
  userIdHint?: string
): Promise<number> {
  const audit = await auditDeliverableInstructionsForEa(licenseId, now, userIdHint);
  return audit.deliverableCount;
}

export async function pullInstructionsForEa(
  ctx: EaAuthContext,
  options?: { realTradingGuard?: RealTradingGuardDecision }
) {
  const now = new Date();
  const realTradingGuard =
    options?.realTradingGuard ?? (await evaluateEaRealTradingGuard(ctx.license.id));

  if (!realTradingGuard.allowed) {
    await createAuditLog({
      actorType: AuditActorType.EA,
      actorId: ctx.license.userId,
      action: "ea.instructions_blocked_real_trading",
      entityType: "license",
      entityId: ctx.license.id,
      requestId: ctx.requestId,
      metadata: {
        code: realTradingGuard.code,
        reason: realTradingGuard.reason,
        licenseId: ctx.license.id,
      },
    });
    return [];
  }

  const tradeMode = await loadLatestTradeMode(ctx.license.id);
  const pending = await listDeliverableInstructionCandidates(ctx.license.id, now);

  const deliverable: EaInstructionPayload[] = [];

  for (const instruction of pending) {
    const check = await evaluateInstructionDeliverability(
      ctx.license.id,
      instruction,
      { tradeMode, userId: ctx.license.userId }
    );
    if (!check.deliver) {
      await appendStatus(
        instruction.id,
        OrderLogStatus.IGNORED,
        check.reason,
        check.code ? { code: check.code } : undefined
      );
      await createAuditLog({
        actorType: AuditActorType.EA,
        actorId: ctx.license.userId,
        action: "instruction.ignored",
        entityType: "instruction",
        entityId: instruction.id,
        requestId: ctx.requestId,
        metadata: { code: check.code, licenseId: ctx.license.id },
      });
      continue;
    }

    if (instruction.currentStatus === OrderLogStatus.RECEIVED) {
      await appendStatus(instruction.id, OrderLogStatus.SENT, "Despachada ao EA");
    }

    const login =
      instruction.accountLogin ?? ctx.license.mt5Account?.login ?? "";
    const server =
      instruction.accountServer ?? ctx.license.mt5Account?.server ?? "";

    if (tradeMode === TradeMode.REAL && check.deliver && "gateCode" in check) {
      deliverable.push(
        mapInstructionToEaPayloadForReal(instruction, {
          accountLogin: login,
          accountServer: server,
          requestedContracts: Math.max(1, Math.ceil(Number(instruction.quantity))),
        })
      );
      await createAuditLog({
        actorType: AuditActorType.EA,
        actorId: ctx.license.userId,
        action: "ea.instructions_real_controlled_gate_allowed",
        entityType: "instruction",
        entityId: instruction.id,
        requestId: ctx.requestId,
        metadata: {
          gateCode: check.gateCode,
          preflightId: check.preflightId,
          magicNumber: instruction.magicNumber,
        },
      });
    } else {
      deliverable.push(mapInstructionToEaPayload(instruction));
    }
  }

  if (deliverable.length > 0) {
    await createAuditLog({
      actorType: AuditActorType.EA,
      actorId: ctx.license.userId,
      action: "ea.instructions_pulled",
      entityType: "license",
      entityId: ctx.license.id,
      requestId: ctx.requestId,
      metadata: { count: deliverable.length },
    });
  }

  return deliverable;
}

const TERMINAL_EXECUTION_STATUSES: ExecutionStatus[] = [
  ExecutionStatus.FILLED,
  ExecutionStatus.PARTIAL,
  ExecutionStatus.REJECTED,
  ExecutionStatus.EXPIRED,
];

function orderStatusFromExecutionStatus(
  status: ExecutionStatus
): OrderLogStatus {
  return status === ExecutionStatus.FILLED ||
    status === ExecutionStatus.PARTIAL
    ? OrderLogStatus.EXECUTED
    : OrderLogStatus.REJECTED;
}

export async function reportExecution(
  ctx: EaAuthContext,
  body: {
    instruction_id: string;
    status: "FILLED" | "PARTIAL" | "REJECTED" | "EXPIRED";
    broker_ticket?: string;
    fill_price?: number;
    fill_quantity?: number;
    slippage?: number;
    error_code?: string;
    error_message?: string;
    executed_at?: string;
    magic_number?: number;
    account_login?: string;
    account_server?: string;
    symbol?: string;
  }
) {
  const instruction = await prisma.instruction.findFirst({
    where: {
      id: body.instruction_id,
      licenseId: ctx.license.id,
    },
  });

  if (!instruction) {
    return { ok: false as const, code: "INSTRUCTION_NOT_FOUND" };
  }

  const existingTerminal = await prisma.execution.findFirst({
    where: {
      instructionId: instruction.id,
      status: { in: TERMINAL_EXECUTION_STATUSES },
    },
    orderBy: { executedAt: "desc" },
  });

  if (existingTerminal) {
    const orderStatus = orderStatusFromExecutionStatus(existingTerminal.status);
    const terminalInstructionStatuses: OrderLogStatus[] = [
      OrderLogStatus.EXECUTED,
      OrderLogStatus.REJECTED,
      OrderLogStatus.IGNORED,
      OrderLogStatus.CANCELLED,
    ];
    if (!terminalInstructionStatuses.includes(instruction.currentStatus)) {
      await appendStatus(
        instruction.id,
        orderStatus,
        `Execução idempotente (${existingTerminal.status})`
      );
    }
    return { ok: true as const, orderStatus, idempotent: true };
  }

  if (body.status === "FILLED" || body.status === "PARTIAL") {
    if (instruction.purpose === InstructionPurpose.ENTRY) {
      await assertInstructionAllowed(ctx.license.id, InstructionPurpose.ENTRY);
    } else {
      await assertInstructionAllowed(ctx.license.id, instruction.purpose);
    }
  }

  const tradeMode = await loadLatestTradeMode(ctx.license.id);
  const isReal = tradeMode === TradeMode.REAL;

  if (isReal) {
    if (!body.magic_number) {
      return { ok: false as const, code: "MAGIC_NUMBER_REQUIRED" };
    }
    if (!body.account_login || !body.account_server) {
      return { ok: false as const, code: "ACCOUNT_CONTEXT_REQUIRED" };
    }
    if (instruction.magicNumber != null && body.magic_number !== instruction.magicNumber) {
      return { ok: false as const, code: "MAGIC_NUMBER_MISMATCH" };
    }
    if (instruction.protectionBlocked) {
      return { ok: false as const, code: "PROTECTION_BLOCKED" };
    }
  }

  const orderStatus =
    body.status === "FILLED" || body.status === "PARTIAL"
      ? OrderLogStatus.EXECUTED
      : OrderLogStatus.REJECTED;
  const safeErrorMessage = redactOperationalMessage(body.error_message);

  await prisma.execution.create({
    data: {
      instructionId: instruction.id,
      licenseId: ctx.license.id,
      status: body.status as ExecutionStatus,
      brokerTicket: body.broker_ticket,
      fillPrice: body.fill_price,
      fillQuantity: body.fill_quantity,
      slippage: body.slippage,
      errorCode: body.error_code,
      errorMessage: safeErrorMessage,
      executedAt: body.executed_at ? new Date(body.executed_at) : new Date(),
      magicNumber: body.magic_number,
      accountLogin: body.account_login,
      accountServer: body.account_server,
      symbol: body.symbol ?? instruction.symbol,
    },
  });

  if (
    isReal &&
    (body.status === "FILLED" || body.status === "PARTIAL") &&
    instruction.requiresProtectionConfirmation
  ) {
    await markProtectionPendingForRealExecution(
      instruction.id,
      ctx.license.id,
      body.magic_number ?? instruction.magicNumber
    );
  }

  await appendStatus(
    instruction.id,
    orderStatus,
    safeErrorMessage ?? `Execução ${body.status}`
  );

  await createAuditLog({
    actorType: AuditActorType.EA,
    actorId: ctx.license.userId,
    action: "ea.execution_reported",
    entityType: "instruction",
    entityId: instruction.id,
    requestId: ctx.requestId,
    metadata: {
      status: body.status,
      brokerTicket: body.broker_ticket,
    },
  });

  return { ok: true as const, orderStatus };
}

export async function reportIgnored(
  ctx: EaAuthContext,
  instructionId: string,
  reason?: string
) {
  const instruction = await prisma.instruction.findFirst({
    where: { id: instructionId, licenseId: ctx.license.id },
  });
  if (!instruction) return { ok: false as const, code: "INSTRUCTION_NOT_FOUND" };

  await appendStatus(instruction.id, OrderLogStatus.IGNORED, reason);

  await createAuditLog({
    actorType: AuditActorType.EA,
    actorId: ctx.license.userId,
    action: "ea.instruction_ignored",
    entityType: "instruction",
    entityId: instruction.id,
    requestId: ctx.requestId,
    metadata: { reason },
  });

  return { ok: true as const };
}

export async function seedInstructionForLicense(
  licenseId: string,
  data: Partial<{
    purpose: InstructionPurpose;
    symbol: string;
    side: "BUY" | "SELL";
    quantity: number;
    status: OrderLogStatus;
  }>
) {
  const instruction = await prisma.instruction.create({
    data: {
      licenseId,
      purpose: data.purpose ?? InstructionPurpose.ENTRY,
      symbol: data.symbol ?? "PETR4",
      side: data.side ?? "BUY",
      orderType: "MARKET",
      quantity: data.quantity ?? 100,
      idempotencyKey: `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      expiresAt: new Date(Date.now() + 3600_000),
      currentStatus: data.status ?? OrderLogStatus.RECEIVED,
    },
  });

  await prisma.instructionStatusLog.create({
    data: {
      instructionId: instruction.id,
      status: instruction.currentStatus,
    },
  });

  return instruction;
}

export { getLicenseOperationalFlags };
