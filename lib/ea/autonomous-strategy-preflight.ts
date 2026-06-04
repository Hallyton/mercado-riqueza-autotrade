import {
  AutonomousStrategyDecisionResult,
  InstructionOperationalMode,
  InstructionPurpose,
  InstructionSide,
  InstructionSource,
  OrderLogStatus,
  TradeMode,
} from "@prisma/client";
import { randomBytes } from "crypto";
import type { EaAuthContext } from "@/lib/ea/auth";
import {
  estimateStopPointsFromPlan,
  parseEaPlannedManagementPlan,
} from "@/lib/ea/autonomous-strategy-plan";
import {
  deriveLegacyPricesFromPlan,
  validateManagementPlan,
} from "@/lib/admin/real-manual-management-plan";
import { validateRealManualOrderFields } from "@/lib/admin/real-manual-dispatch-validation";
import { evaluateBulkLicenseEligibility } from "@/lib/admin/real-manual-bulk-eligibility";
import prisma from "@/lib/prisma";
import {
  AUTONOMOUS_STRATEGY_REASON_MESSAGES,
  MR_FIBO_D1_GUARD_CODE,
  MR_FIBO_D1_GUARD_VERSION,
} from "@/lib/risk/autonomous-strategy-reasons";
import {
  evaluateDailyFinancialStopForEntry,
  tradeDateKeySaoPaulo,
} from "@/lib/risk/daily-financial-risk";
import { isAutoDispatchEnabled } from "@/lib/risk/real-trading-config";
import { isRealTradingEnabled } from "@/lib/risk/real-trading-guard";

const AUTONOMOUS_PREFLIGHT_MAX_AGE_MS = 2 * 60 * 1000;

export type AutonomousPreflightInput = {
  strategy_code: string;
  strategy_version: string;
  license_id: string;
  device_id: string;
  account_login: string;
  account_server: string;
  symbol: string;
  trade_mode: "DEMO" | "REAL";
  magic_number: number;
  side: "BUY" | "SELL";
  order_type: "MARKET" | "LIMIT" | "STOP";
  order_price?: number | null;
  requested_contracts: number;
  planned_management_plan: unknown;
  signal_reason?: string;
  client_timestamp?: string;
};

export function isAutonomousStrategyServerEnabled(): boolean {
  const raw = process.env.ENABLE_AUTONOMOUS_STRATEGY?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}

async function isStrategyEnabledForLicense(
  licenseId: string,
  strategyCode: string
): Promise<boolean> {
  const instance = await prisma.robotInstance.findFirst({
    where: {
      licenseId,
      autonomousStrategyEnabled: true,
      OR: [
        { autonomousStrategyCode: strategyCode },
        { robotProduct: { strategyCode } },
      ],
    },
    include: { robotProduct: true },
  });
  if (!instance) return false;
  if (instance.robotProduct.strategyCode && instance.robotProduct.strategyCode !== strategyCode) {
    return false;
  }
  return true;
}

async function countAllowedDecisionsToday(
  licenseId: string,
  strategyCode: string
): Promise<number> {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  return prisma.autonomousStrategyDecision.count({
    where: {
      licenseId,
      strategyCode,
      decision: AutonomousStrategyDecisionResult.ALLOWED,
      createdAt: { gte: dayStart },
    },
  });
}

async function hasSideTradedToday(
  licenseId: string,
  strategyCode: string,
  side: "BUY" | "SELL"
): Promise<boolean> {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const row = await prisma.autonomousStrategyDecision.findFirst({
    where: {
      licenseId,
      strategyCode,
      side: side as InstructionSide,
      decision: AutonomousStrategyDecisionResult.ALLOWED,
      createdAt: { gte: dayStart },
    },
  });
  return Boolean(row);
}

function buildIdempotencyKey(licenseId: string, strategyCode: string) {
  return `auto-strat-${licenseId}-${strategyCode}-${Date.now()}-${randomBytes(3).toString("hex")}`;
}

async function createAuditInstruction(input: {
  licenseId: string;
  symbol: string;
  side: "BUY" | "SELL";
  orderType: "MARKET" | "LIMIT" | "STOP";
  orderPrice?: number;
  requestedContracts: number;
  magicNumber: number;
  accountLogin: string;
  accountServer: string;
  managementPlan: ReturnType<typeof parseEaPlannedManagementPlan>;
  decisionId: string;
}) {
  if (!input.managementPlan) return null;
  const { stopLossPrice, takeProfitPrice } = deriveLegacyPricesFromPlan(
    input.managementPlan
  );
  const now = new Date();
  const instruction = await prisma.instruction.create({
    data: {
      licenseId: input.licenseId,
      purpose: InstructionPurpose.ENTRY,
      symbol: input.symbol.trim().toUpperCase(),
      side: input.side as InstructionSide,
      orderType: input.orderType,
      orderPrice: input.orderPrice,
      stopLoss: stopLossPrice,
      takeProfit: takeProfitPrice,
      quantity: input.requestedContracts,
      idempotencyKey: buildIdempotencyKey(input.licenseId, MR_FIBO_D1_GUARD_CODE),
      requestId: `auto-${input.decisionId.slice(0, 8)}`,
      expiresAt: new Date(now.getTime() + AUTONOMOUS_PREFLIGHT_MAX_AGE_MS),
      source: InstructionSource.AUTONOMOUS_STRATEGY,
      operationalMode: InstructionOperationalMode.AUTONOMOUS_STRATEGY,
      currentStatus: OrderLogStatus.RECEIVED,
      magicNumber: input.magicNumber,
      accountLogin: input.accountLogin,
      accountServer: input.accountServer,
      requiresProtectionConfirmation: true,
      protectionBlocked: false,
      managementPlan: input.managementPlan,
    },
  });
  await prisma.instructionStatusLog.create({
    data: {
      instructionId: instruction.id,
      status: OrderLogStatus.RECEIVED,
      message: "Instruction AUTONOMOUS_STRATEGY autorizada via preflight EA.",
      metadata: {
        autonomousStrategyDecisionId: input.decisionId,
        strategyCode: MR_FIBO_D1_GUARD_CODE,
      },
    },
  });
  return instruction.id;
}

export async function runAutonomousStrategyPreflight(
  ctx: EaAuthContext,
  input: AutonomousPreflightInput
) {
  const strategyCode = input.strategy_code.trim().toUpperCase();
  const symbol = input.symbol.trim().toUpperCase();
  const accountLogin = input.account_login.trim();
  const accountServer = input.account_server.trim();

  const block = async (
    reasonCode: string,
    detail?: string,
    dailyRiskSnapshot?: object
  ) => {
    const decision = await prisma.autonomousStrategyDecision.create({
      data: {
        licenseId: ctx.license.id,
        deviceId: ctx.device.deviceId,
        userId: ctx.license.userId,
        strategyCode,
        strategyVersion: input.strategy_version,
        accountLogin,
        accountServer,
        symbol,
        magicNumber: input.magic_number,
        side: input.side as InstructionSide,
        orderType: input.order_type,
        orderPrice: input.order_price ?? undefined,
        requestedContracts: input.requested_contracts,
        plannedManagementPlan: input.planned_management_plan as object,
        decision: AutonomousStrategyDecisionResult.BLOCKED,
        reasonCode,
        detail:
          detail ??
          (AUTONOMOUS_STRATEGY_REASON_MESSAGES[
            reasonCode as keyof typeof AUTONOMOUS_STRATEGY_REASON_MESSAGES
          ] ?? reasonCode),
        signalReason: input.signal_reason,
        dailyRiskSnapshot: dailyRiskSnapshot ?? undefined,
        riskSessionId: `risk-${ctx.license.id}-${Date.now()}`,
      },
    });
    return {
      allowed: false as const,
      decision: reasonCode,
      reason_code: reasonCode,
      detail: decision.detail,
      strategy_execution_id: decision.id,
    };
  };

  if (ctx.license.id !== input.license_id) {
    return block("AUTONOMOUS_STRATEGY_SITE_AUTH_REQUIRED", "license_id diverge do token.");
  }
  if (ctx.device.deviceId !== input.device_id) {
    return block("AUTONOMOUS_STRATEGY_SITE_AUTH_REQUIRED", "device_id diverge do token.");
  }

  if (strategyCode !== MR_FIBO_D1_GUARD_CODE) {
    return block("STRATEGY_NOT_ENABLED_FOR_LICENSE", "Código de estratégia não suportado.");
  }

  if (!isAutonomousStrategyServerEnabled()) {
    return block("AUTONOMOUS_STRATEGY_DISABLED");
  }

  if (isAutoDispatchEnabled()) {
    return block("AUTONOMOUS_STRATEGY_DISABLED", "Dispatch automático deve permanecer desativado.");
  }

  if (input.trade_mode === "REAL" && !isRealTradingEnabled()) {
    return block("AUTONOMOUS_STRATEGY_DISABLED", "ENABLE_REAL_TRADING=false.");
  }

  const strategyEnabled = await isStrategyEnabledForLicense(ctx.license.id, strategyCode);
  if (!strategyEnabled) {
    return block("STRATEGY_NOT_ENABLED_FOR_LICENSE");
  }

  const plan = parseEaPlannedManagementPlan(input.planned_management_plan);
  if (!plan) {
    return block("STRATEGY_MANAGEMENT_PLAN_INVALID");
  }

  const planValidation = validateManagementPlan({
    plan,
    requestedContracts: input.requested_contracts,
    side: input.side,
    entryPrice: input.order_price ?? null,
  });
  if (planValidation) {
    return block("STRATEGY_MANAGEMENT_PLAN_INVALID", planValidation.message);
  }

  const { stopLossPrice, takeProfitPrice } = deriveLegacyPricesFromPlan(plan);
  const orderValidation = validateRealManualOrderFields({
    orderType: input.order_type,
    orderPrice: input.order_price ?? null,
    stopLossPrice,
    takeProfitPrice,
  });
  if (orderValidation) {
    return block("STRATEGY_MANAGEMENT_PLAN_INVALID", orderValidation.message);
  }

  const eligibility = await evaluateBulkLicenseEligibility({
    licenseId: ctx.license.id,
    order: {
      symbol,
      side: input.side,
      orderType: input.order_type,
      orderPrice: input.order_price ?? undefined,
      requestedContracts: input.requested_contracts,
      managementPlan: plan,
    },
  });

  if (!eligibility.eligible) {
    return block(eligibility.reasonCode, eligibility.reasonDetail);
  }

  const tradesToday = await countAllowedDecisionsToday(ctx.license.id, strategyCode);
  if (tradesToday >= 2) {
    return block("STRATEGY_DAILY_TRADE_LIMIT_REACHED");
  }

  const sideTraded = await hasSideTradedToday(ctx.license.id, strategyCode, input.side);
  if (sideTraded) {
    return block("STRATEGY_DAILY_SIDE_ALREADY_TRADED");
  }

  const product = await prisma.robotProduct.findFirst({
    where: { strategyCode: MR_FIBO_D1_GUARD_CODE },
  });

  const stopPoints = estimateStopPointsFromPlan({
    side: input.side,
    entryPrice: input.order_price ?? null,
    initialStopLoss: plan.initialStopLoss,
  });

  const dailyCheck = await evaluateDailyFinancialStopForEntry({
    licenseId: ctx.license.id,
    accountLogin,
    accountServer,
    strategyCode,
    symbol,
    requestedContracts: input.requested_contracts,
    stopPoints,
    requiresDailyStop: product?.requiresDailyFinancialStop ?? true,
  });

  if (!dailyCheck.ok) {
    return block(dailyCheck.reasonCode, dailyCheck.detail, dailyCheck.snapshot);
  }

  const riskSessionId = `risk-${ctx.license.id}-${tradeDateKeySaoPaulo()}`;

  const decisionRecord = await prisma.autonomousStrategyDecision.create({
    data: {
      licenseId: ctx.license.id,
      deviceId: ctx.device.deviceId,
      userId: ctx.license.userId,
      strategyCode,
      strategyVersion: input.strategy_version || MR_FIBO_D1_GUARD_VERSION,
      accountLogin,
      accountServer,
      symbol,
      magicNumber: input.magic_number,
      side: input.side as InstructionSide,
      orderType: input.order_type,
      orderPrice: input.order_price ?? undefined,
      requestedContracts: input.requested_contracts,
      plannedManagementPlan: input.planned_management_plan as object,
      approvedManagementPlan: plan,
      decision: AutonomousStrategyDecisionResult.ALLOWED,
      signalReason: input.signal_reason,
      dailyRiskSnapshot: dailyCheck.snapshot,
      riskSessionId,
    },
  });

  const instructionId = await createAuditInstruction({
    licenseId: ctx.license.id,
    symbol,
    side: input.side,
    orderType: input.order_type,
    orderPrice: input.order_price ?? undefined,
    requestedContracts: input.requested_contracts,
    magicNumber: input.magic_number,
    accountLogin,
    accountServer,
    managementPlan: plan,
    decisionId: decisionRecord.id,
  });

  if (instructionId) {
    await prisma.autonomousStrategyDecision.update({
      where: { id: decisionRecord.id },
      data: { instructionId },
    });
  }

  return {
    allowed: true as const,
    decision: "AUTONOMOUS_STRATEGY_ALLOWED",
    strategy_execution_id: decisionRecord.id,
    instruction_id: instructionId,
    risk_session_id: riskSessionId,
    daily_financial_stop: {
      enabled: dailyCheck.snapshot.enabled,
      limit: dailyCheck.snapshot.limitCents / 100,
      current_realized_pnl: dailyCheck.snapshot.currentRealizedPnlCents / 100,
      remaining_loss: dailyCheck.snapshot.remainingLossCents / 100,
      status: dailyCheck.snapshot.status,
    },
    approved_management_plan: plan,
  };
}
