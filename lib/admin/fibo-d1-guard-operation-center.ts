import { LicenseStatus, RealTradingApprovalStatus, StrategyRuntimeConfigStatus } from "@prisma/client";
import { getPublishedStrategyConfigForEa } from "@/lib/admin/strategy-runtime-config";
import { isAutonomousStrategyServerEnabled } from "@/lib/ea/autonomous-strategy-preflight";
import { isEaOffline } from "@/lib/ea/status";
import prisma from "@/lib/prisma";
import { ACTIVE_DEVICE_WHERE } from "@/lib/licensing/device-lifecycle";
import {
  CAN_TRADE_ACTION_HINTS,
  CAN_TRADE_REASON_MESSAGES,
  type CanTradeReasonCode,
  MR_FIBO_D1_GUARD_CODE,
} from "@/lib/risk/autonomous-strategy-reasons";
import { evaluateDailyFinancialStopForEntry } from "@/lib/risk/daily-financial-risk";
import { isRealTradingEnabled } from "@/lib/risk/real-trading-guard";
import { buildDefaultMrFiboD1GuardConfig, mrFiboD1GuardConfigSchema } from "@/lib/strategy/mr-fibo-d1-guard-config";
import { LOT_TOTAL_EXCEEDS_MAX_CONTRACTS } from "@/lib/strategy/mr-fibo-d1-guard-readiness";

export type FiboGuardClientBucket = "READY" | "EA_NOT_READY" | "PLATFORM_BLOCKED";

export type FiboGuardClientRow = {
  bucket: FiboGuardClientBucket;
  licenseId: string;
  userEmail: string;
  userName: string | null;
  accountLogin: string | null;
  accountServer: string | null;
  symbol: string | null;
  magicNumber: number | null;
  configuredContracts: number | null;
  estimatedRiskBrl: number | null;
  dailyStopLimitBrl: number | null;
  dailyStopStatus: string | null;
  eaOnline: boolean;
  configHash: string | null;
  configVersion: number | null;
  reasonCodes: string[];
  actionHints: string[];
  lastEaError: string | null;
  licenseHref: string;
  strategyConfigHref: string;
  approvalHref: string;
  dailyRiskHref: string;
};

type EaReadySnapshot = {
  terminal_connected?: boolean;
  auto_trading_allowed?: boolean;
  real_orders_enabled?: boolean;
  strategy_config_hash?: string;
  has_open_position?: boolean;
  has_pending_orders?: boolean;
  last_strategy_decision_reason?: string;
};

function parseEaReady(payload: unknown): EaReadySnapshot | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const snap = root.autonomous_strategy;
  if (!snap || typeof snap !== "object") return null;
  return snap as EaReadySnapshot;
}

function hintFor(code: string): string {
  return (
    CAN_TRADE_ACTION_HINTS[code as CanTradeReasonCode] ??
    CAN_TRADE_REASON_MESSAGES[code as CanTradeReasonCode] ??
    code
  );
}

export async function getFiboD1GuardOperationCenterView() {
  const licenses = await prisma.license.findMany({
    where: {
      robotInstances: { some: {} },
    },
    include: {
      user: { select: { email: true, name: true } },
      mt5Account: { select: { login: true, server: true } },
      robotInstances: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { robotProduct: true },
      },
      realTradingApprovals: {
        where: { status: RealTradingApprovalStatus.APPROVED },
        orderBy: { approvedAt: "desc" },
        take: 1,
      },
    },
    take: 200,
  });

  const rows: FiboGuardClientRow[] = [];

  for (const license of licenses) {
    const robot = license.robotInstances[0];
    if (!robot) continue;

    const reasonCodes: string[] = [];
    const actionHints: string[] = [];
    let bucket: FiboGuardClientBucket = "READY";

    const published = await getPublishedStrategyConfigForEa(license.id);
    const draftRow = await prisma.strategyRuntimeConfig.findFirst({
      where: {
        licenseId: license.id,
        strategyCode: MR_FIBO_D1_GUARD_CODE,
        status: StrategyRuntimeConfigStatus.DRAFT,
      },
      orderBy: { updatedAt: "desc" },
    });

    const approval = license.realTradingApprovals[0] ?? null;
    const maxContracts = approval?.maxContracts ?? 1;
    const approvalHref = approval
      ? `/admin/real-trading/approvals/${approval.id}`
      : `/admin/real-trading/approvals?licenseId=${license.id}`;

    let loteTotal = published?.strategyConfig.risk.lote_total ?? null;
    let stopPoints = published?.strategyConfig.risk.stop_pontos ?? null;

    if (loteTotal == null && draftRow?.config != null) {
      const parsedDraft = mrFiboD1GuardConfigSchema.safeParse(draftRow.config);
      if (parsedDraft.success) {
        loteTotal = parsedDraft.data.risk.loteTotal;
        stopPoints = parsedDraft.data.risk.stopPontos;
      }
    }

    if (loteTotal == null) {
      const defaults = buildDefaultMrFiboD1GuardConfig();
      loteTotal = defaults.risk.loteTotal;
      stopPoints = defaults.risk.stopPontos;
    }

    if (loteTotal > maxContracts) {
      reasonCodes.push(LOT_TOTAL_EXCEEDS_MAX_CONTRACTS);
      bucket = "PLATFORM_BLOCKED";
    }

    let estimatedRiskBrl: number | null = null;
    const symbol = robot.symbol ?? license.expectedSymbol;
    if (symbol && loteTotal && stopPoints) {
      const pointValue = await prisma.instrumentPointValue.findFirst({
        where: { symbol: symbol.toUpperCase() },
      });
      if (pointValue) {
        estimatedRiskBrl =
          (loteTotal * stopPoints * pointValue.centsPerPointPerContract) / 100;
      }
    }

    const dailyLimit = await prisma.dailyFinancialRiskLimit.findFirst({
      where: { licenseId: license.id, strategyCode: MR_FIBO_D1_GUARD_CODE },
      orderBy: { updatedAt: "desc" },
    });

    if (license.status !== LicenseStatus.ACTIVE) {
      reasonCodes.push("LICENSE_NOT_ACTIVE");
      bucket = "PLATFORM_BLOCKED";
    }
    if (!robot.autonomousStrategyEnabled) {
      reasonCodes.push("STRATEGY_NOT_ENABLED_FOR_LICENSE");
      bucket = "PLATFORM_BLOCKED";
    }
    if (!published) {
      reasonCodes.push("STRATEGY_CONFIG_MISSING");
      bucket = "PLATFORM_BLOCKED";
    }
    if (robot.robotProduct.requiresDailyFinancialStop && !dailyLimit?.enabled) {
      reasonCodes.push("DAILY_FINANCIAL_STOP_NOT_CONFIGURED");
      bucket = "PLATFORM_BLOCKED";
    }

    if (loteTotal && stopPoints && dailyLimit?.enabled) {
      const dailyCheck = await evaluateDailyFinancialStopForEntry({
        licenseId: license.id,
        accountLogin: license.mt5Account?.login ?? "",
        accountServer: license.mt5Account?.server ?? "",
        strategyCode: MR_FIBO_D1_GUARD_CODE,
        symbol: symbol ?? "WDO",
        requestedContracts: loteTotal,
        stopPoints,
        requiresDailyStop: true,
      });
      if (!dailyCheck.ok) {
        reasonCodes.push(dailyCheck.reasonCode);
        bucket = "PLATFORM_BLOCKED";
      }
    }

    const device = await prisma.device.findFirst({
      where: { licenseId: license.id, ...ACTIVE_DEVICE_WHERE },
      orderBy: { lastSeenAt: "desc" },
    });
    const eaOnline = device ? !isEaOffline(device.lastSeenAt) : false;
    if (!eaOnline) {
      reasonCodes.push("EA_OFFLINE");
      if (bucket === "READY") bucket = "EA_NOT_READY";
    }

    const heartbeat = await prisma.eaHeartbeat.findFirst({
      where: { licenseId: license.id },
      orderBy: { receivedAt: "desc" },
    });
    const eaReady = parseEaReady(heartbeat?.reportPayload);
    if (eaReady?.auto_trading_allowed === false) {
      reasonCodes.push("EA_AUTOTRADING_DISABLED");
      if (bucket === "READY") bucket = "EA_NOT_READY";
    }
    if (eaReady?.real_orders_enabled === false) {
      reasonCodes.push("EA_REAL_ORDERS_DISABLED");
      if (bucket === "READY") bucket = "EA_NOT_READY";
    }
    if (eaReady?.terminal_connected === false) {
      reasonCodes.push("EA_TERMINAL_DISCONNECTED");
      if (bucket === "READY") bucket = "EA_NOT_READY";
    }
    if (
      published &&
      eaReady?.strategy_config_hash &&
      eaReady.strategy_config_hash !== published.configHash
    ) {
      reasonCodes.push("STRATEGY_CONFIG_HASH_MISMATCH");
      if (bucket === "READY") bucket = "EA_NOT_READY";
    }

    const lastError = await prisma.eaErrorReport.findFirst({
      where: { licenseId: license.id },
      orderBy: { createdAt: "desc" },
    });

    for (const code of [...new Set(reasonCodes)]) {
      actionHints.push(hintFor(code));
    }

    rows.push({
      bucket,
      licenseId: license.id,
      userEmail: license.user.email,
      userName: license.user.name,
      accountLogin: license.mt5Account?.login ?? license.expectedAccountLogin,
      accountServer: license.mt5Account?.server ?? license.expectedAccountServer,
      symbol,
      magicNumber: robot.magicNumber ?? license.expectedMagicNumber,
      configuredContracts: loteTotal,
      estimatedRiskBrl,
      dailyStopLimitBrl: dailyLimit
        ? dailyLimit.dailyLossLimitCents / 100
        : null,
      dailyStopStatus: dailyLimit?.enabled ? "CONFIGURED" : "MISSING",
      eaOnline,
      configHash: published?.configHash ?? null,
      configVersion: published?.version ?? null,
      reasonCodes: [...new Set(reasonCodes)],
      actionHints: [...new Set(actionHints)],
      lastEaError: lastError?.errorMessage ?? null,
      licenseHref: `/admin/licenses/${license.id}`,
      strategyConfigHref: `/admin/licenses/${license.id}/strategy-config`,
      approvalHref,
      dailyRiskHref: `/admin/real-trading/daily-risk?licenseId=${license.id}`,
    });
  }

  const decisions = await prisma.autonomousStrategyDecision.findMany({
    where: { strategyCode: MR_FIBO_D1_GUARD_CODE },
    orderBy: { createdAt: "desc" },
    take: 80,
    include: {
      license: {
        select: {
          user: { select: { email: true, name: true } },
        },
      },
    },
  });

  return {
    generatedAt: new Date().toISOString(),
    global: {
      autonomousStrategyServerEnabled: isAutonomousStrategyServerEnabled(),
      realTradingEnabled: isRealTradingEnabled(),
      totalAnalyzed: rows.length,
      readyCount: rows.filter((r) => r.bucket === "READY").length,
      eaNotReadyCount: rows.filter((r) => r.bucket === "EA_NOT_READY").length,
      blockedCount: rows.filter((r) => r.bucket === "PLATFORM_BLOCKED").length,
    },
    defaultConfig: buildDefaultMrFiboD1GuardConfig(),
    clients: {
      ready: rows.filter((r) => r.bucket === "READY"),
      eaNotReady: rows.filter((r) => r.bucket === "EA_NOT_READY"),
      blocked: rows.filter((r) => r.bucket === "PLATFORM_BLOCKED"),
    },
    recentDecisions: decisions.map((d) => ({
      id: d.id,
      createdAt: d.createdAt.toISOString(),
      clientEmail: d.license.user.email,
      licenseId: d.licenseId,
      action: d.signalReason,
      side: d.side,
      allowed: d.decision === "ALLOWED",
      reasonCode: d.reasonCode,
      detail: d.detail,
      requestedContracts: d.requestedContracts,
    })),
  };
}
