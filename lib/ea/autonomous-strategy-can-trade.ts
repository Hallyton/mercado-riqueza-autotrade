import {
  AutonomousStrategyDecisionResult,
  InstructionOrderType,
  InstructionSide,
  LicenseStatus,
  TradeMode,
} from "@prisma/client";
import type { EaAuthContext } from "@/lib/ea/auth";
import { isEaOffline } from "@/lib/ea/status";
import { isAutonomousStrategyServerEnabled } from "@/lib/ea/autonomous-strategy-preflight";
import { getPublishedStrategyConfigForEa } from "@/lib/admin/strategy-runtime-config";
import prisma from "@/lib/prisma";
import { ACTIVE_DEVICE_WHERE } from "@/lib/licensing/device-lifecycle";
import {
  CAN_TRADE_ACTION_HINTS,
  CAN_TRADE_REASON_MESSAGES,
  type CanTradeReasonCode,
  MR_FIBO_D1_GUARD_CODE,
  MR_FIBO_D1_GUARD_VERSION,
} from "@/lib/risk/autonomous-strategy-reasons";
import { evaluateDailyFinancialStopForEntry } from "@/lib/risk/daily-financial-risk";
import { isRealTradingEnabled } from "@/lib/risk/real-trading-guard";
import {
  findActiveRealTradingApproval,
  hasPreMarketSnapshotToday,
} from "@/lib/risk/real-trade-preflight";

export type CanTradeInput = {
  strategy_code: string;
  license_id: string;
  device_id: string;
  account_login: string;
  account_server: string;
  symbol: string;
  trade_mode: "DEMO" | "REAL";
  magic_number: number;
  side: "BUY" | "SELL";
  action: "ENTRY" | "REVERSAL";
  requested_contracts: number;
  estimated_stop_points: number;
  strategy_config_hash?: string | null;
  client_timestamp?: string | null;
  ea_ready?: Record<string, unknown> | null;
};

export type CanTradeResult =
  | {
      allowed: true;
      decision: "STRATEGY_CAN_TRADE";
      reason_code: "OK";
      detail?: string;
    }
  | {
      allowed: false;
      decision: "STRATEGY_BLOCKED";
      reason_code: CanTradeReasonCode;
      detail: string;
      action_hint?: string;
    };

function block(
  reasonCode: CanTradeReasonCode,
  detail?: string
): CanTradeResult {
  return {
    allowed: false,
    decision: "STRATEGY_BLOCKED",
    reason_code: reasonCode,
    detail: detail ?? CAN_TRADE_REASON_MESSAGES[reasonCode] ?? reasonCode,
    action_hint: CAN_TRADE_ACTION_HINTS[reasonCode],
  };
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
  if (
    instance.robotProduct.strategyCode &&
    instance.robotProduct.strategyCode !== strategyCode
  ) {
    return false;
  }
  return true;
}

async function recordCanTradeDecision(
  ctx: EaAuthContext,
  body: CanTradeInput,
  result: CanTradeResult
) {
  await prisma.autonomousStrategyDecision.create({
    data: {
      licenseId: ctx.license.id,
      deviceId: body.device_id,
      userId: ctx.license.userId,
      strategyCode: body.strategy_code,
      strategyVersion: MR_FIBO_D1_GUARD_VERSION,
      accountLogin: body.account_login.trim(),
      accountServer: body.account_server.trim(),
      symbol: body.symbol.trim().toUpperCase(),
      magicNumber: body.magic_number,
      side: body.side as InstructionSide,
      orderType: InstructionOrderType.LIMIT,
      requestedContracts: body.requested_contracts,
      plannedManagementPlan: (body.ea_ready ?? {}) as object,
      decision: result.allowed
        ? AutonomousStrategyDecisionResult.ALLOWED
        : AutonomousStrategyDecisionResult.BLOCKED,
      reasonCode: result.reason_code,
      detail: "detail" in result ? result.detail : null,
      signalReason: body.action,
      instructionId: null,
    },
  });
}

export async function runAutonomousStrategyCanTrade(
  ctx: EaAuthContext,
  body: CanTradeInput
): Promise<CanTradeResult> {
  let result: CanTradeResult;

  if (body.strategy_code !== MR_FIBO_D1_GUARD_CODE) {
    result = block("UNKNOWN_BLOCK", "Código de estratégia não suportado.");
    await recordCanTradeDecision(ctx, body, result);
    return result;
  }

  if (!isAutonomousStrategyServerEnabled()) {
    result = block("AUTONOMOUS_STRATEGY_DISABLED");
    await recordCanTradeDecision(ctx, body, result);
    return result;
  }

  if (body.trade_mode === "REAL" && !isRealTradingEnabled()) {
    result = block("REAL_TRADING_NOT_ENABLED");
    await recordCanTradeDecision(ctx, body, result);
    return result;
  }

  if (ctx.license.status !== LicenseStatus.ACTIVE) {
    result = block("LICENSE_NOT_ACTIVE");
    await recordCanTradeDecision(ctx, body, result);
    return result;
  }

  const subscription = ctx.license.subscription;
  if (
    !subscription ||
    !["ACTIVE", "TRIALING"].includes(subscription.status)
  ) {
    result = block("SUBSCRIPTION_NOT_ACTIVE");
    await recordCanTradeDecision(ctx, body, result);
    return result;
  }

  if (subscription.adminPaymentStatus !== "CONFIRMED") {
    result = block("PAYMENT_NOT_CONFIRMED");
    await recordCanTradeDecision(ctx, body, result);
    return result;
  }

  const strategyEnabled = await isStrategyEnabledForLicense(
    ctx.license.id,
    body.strategy_code
  );
  if (!strategyEnabled) {
    result = block("STRATEGY_NOT_ENABLED_FOR_LICENSE");
    await recordCanTradeDecision(ctx, body, result);
    return result;
  }

  if (ctx.device.deviceId !== body.device_id) {
    result = block("DEVICE_NOT_ACTIVE");
    await recordCanTradeDecision(ctx, body, result);
    return result;
  }

  const login = body.account_login.trim();
  const server = body.account_server.trim();
  const mt5 = ctx.license.mt5Account;
  if (!mt5 || mt5.login !== login || mt5.server.trim() !== server) {
    result = block("DEVICE_ACCOUNT_MISMATCH");
    await recordCanTradeDecision(ctx, body, result);
    return result;
  }

  if (
    body.trade_mode === "REAL" &&
    ctx.license.expectedTradeMode !== TradeMode.REAL
  ) {
    result = block("TRADE_MODE_NOT_ALLOWED");
    await recordCanTradeDecision(ctx, body, result);
    return result;
  }

  const robot = await prisma.robotInstance.findFirst({
    where: { licenseId: ctx.license.id },
    include: { robotProduct: true },
  });

  const expectedSymbol = robot?.symbol ?? ctx.license.expectedSymbol;
  if (
    expectedSymbol &&
    expectedSymbol.toUpperCase() !== body.symbol.trim().toUpperCase()
  ) {
    result = block("SYMBOL_MISMATCH");
    await recordCanTradeDecision(ctx, body, result);
    return result;
  }

  const expectedMagic = robot?.magicNumber ?? ctx.license.expectedMagicNumber;
  if (expectedMagic != null && expectedMagic !== body.magic_number) {
    result = block("MAGIC_MISMATCH");
    await recordCanTradeDecision(ctx, body, result);
    return result;
  }

  if (
    !robot ||
    robot.status === "BLOCKED" ||
    robot.status === "AWAITING_PAYMENT"
  ) {
    result = block("ROBOT_INSTANCE_NOT_ACTIVE");
    await recordCanTradeDecision(ctx, body, result);
    return result;
  }

  const published = await getPublishedStrategyConfigForEa(ctx.license.id);
  if (!published) {
    result = block("STRATEGY_CONFIG_MISSING");
    await recordCanTradeDecision(ctx, body, result);
    return result;
  }

  if (
    body.strategy_config_hash &&
    body.strategy_config_hash !== published.configHash
  ) {
    result = block("STRATEGY_CONFIG_HASH_MISMATCH");
    await recordCanTradeDecision(ctx, body, result);
    return result;
  }

  const eaReady = body.ea_ready ?? {};
  if (eaReady.auto_trading_allowed === false) {
    result = block("EA_AUTOTRADING_DISABLED");
    await recordCanTradeDecision(ctx, body, result);
    return result;
  }
  if (eaReady.real_orders_enabled === false) {
    result = block("EA_REAL_ORDERS_DISABLED");
    await recordCanTradeDecision(ctx, body, result);
    return result;
  }
  if (eaReady.terminal_connected === false) {
    result = block("EA_TERMINAL_DISCONNECTED");
    await recordCanTradeDecision(ctx, body, result);
    return result;
  }

  if (robot.robotProduct.requiresDailyFinancialStop) {
    const dailyCheck = await evaluateDailyFinancialStopForEntry({
      licenseId: ctx.license.id,
      accountLogin: login,
      accountServer: server,
      strategyCode: MR_FIBO_D1_GUARD_CODE,
      symbol: body.symbol.trim().toUpperCase(),
      requestedContracts: body.requested_contracts,
      stopPoints: body.estimated_stop_points,
      requiresDailyStop: true,
    });

    if (!dailyCheck.ok) {
      const code = dailyCheck.reasonCode as CanTradeReasonCode;
      result =
        code in CAN_TRADE_REASON_MESSAGES
          ? block(code, dailyCheck.detail)
          : block("DAILY_FINANCIAL_STOP_WOULD_BE_EXCEEDED", dailyCheck.detail);
      await recordCanTradeDecision(ctx, body, result);
      return result;
    }
  }

  if (
    robot.robotProduct.requiresRealTradingApproval &&
    body.trade_mode === "REAL"
  ) {
    const approval = await findActiveRealTradingApproval(
      ctx.license.id,
      ctx.license.userId,
      body.account_login,
      body.account_server,
      body.symbol,
      body.magic_number
    );
    if (!approval) {
      result = block("REAL_TRADING_NOT_ENABLED", "Aprovação REAL ausente.");
      await recordCanTradeDecision(ctx, body, result);
      return result;
    }
    if (body.requested_contracts > approval.maxContracts) {
      result = block(
        "DAILY_FINANCIAL_STOP_WOULD_BE_EXCEEDED",
        `Contratos (${body.requested_contracts}) excedem maxContracts (${approval.maxContracts}).`
      );
      await recordCanTradeDecision(ctx, body, result);
      return result;
    }
  }

  if (robot.robotProduct.requiresPreMarket && body.trade_mode === "REAL") {
    const preMarket = await hasPreMarketSnapshotToday(
      ctx.license.id,
      body.account_login,
      body.account_server
    );
    if (!preMarket.ok) {
      result = block("UNKNOWN_BLOCK", "Snapshot PRE_MARKET ausente.");
      await recordCanTradeDecision(ctx, body, result);
      return result;
    }
  }

  const device = await prisma.device.findFirst({
    where: {
      licenseId: ctx.license.id,
      deviceId: body.device_id,
      ...ACTIVE_DEVICE_WHERE,
    },
  });
  if (!device) {
    result = block("DEVICE_NOT_ACTIVE");
    await recordCanTradeDecision(ctx, body, result);
    return result;
  }

  if (isEaOffline(device.lastSeenAt)) {
    result = block("EA_OFFLINE");
    await recordCanTradeDecision(ctx, body, result);
    return result;
  }

  result = {
    allowed: true,
    decision: "STRATEGY_CAN_TRADE",
    reason_code: "OK",
  };
  await recordCanTradeDecision(ctx, body, result);
  return result;
}
