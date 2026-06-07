import {
  DailyFinancialRiskStatus,
  EAOperationalCommandStatus,
  type DailyFinancialRiskLimit,
  type DailyFinancialRiskState,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { tradeDateKeySaoPaulo } from "@/lib/risk/daily-risk-state-key";
import { normalizeFiboStrategyCode } from "@/lib/strategy/normalize-strategy-code";

/** Janela curta exigida quando há posição aberta ou ordens pendentes. */
export const DAILY_RISK_POSITION_PENDING_THRESHOLD_SEC = 180;

export const DAILY_RISK_POLICY_REASON_CODES = [
  "DAILY_RISK_OK_FOR_DAY",
  "DAILY_RISK_REPORT_MISSING",
  "DAILY_RISK_REPORT_STALE",
  "DAILY_RISK_TRADE_DATE_MISMATCH",
  "POSITION_RISK_REPORT_STALE",
  "PENDING_ORDERS_RISK_REPORT_STALE",
  "DAILY_RISK_REVALIDATION_REQUIRED_AFTER_TRADE",
  "DAILY_RISK_REVALIDATION_REQUIRED_AFTER_ADMIN_CHANGE",
  "EA_OFFLINE_WITH_DAILY_RISK_OK_FOR_DAY",
] as const;

export type DailyRiskPolicyReasonCode =
  (typeof DAILY_RISK_POLICY_REASON_CODES)[number];

export type DailyRiskFreshnessStatus =
  | "OK_FOR_DAY"
  | "RECENT_OK"
  | "MISSING"
  | "STALE"
  | "REVALIDATION_REQUIRED"
  | "POSITION_REQUIRES_RECENT_REPORT"
  | "PENDING_ORDERS_REQUIRE_RECENT_REPORT";

export type DailyRiskInvalidationEvent = {
  at: string;
  reasonCode: string;
  source: string;
};

export type DailyRiskInvalidationResult = {
  hasInvalidation: boolean;
  latestInvalidationAt: Date | null;
  reasonCode: DailyRiskPolicyReasonCode | null;
  events: DailyRiskInvalidationEvent[];
};

export type DailyRiskFreshnessPolicyResult = {
  status: DailyRiskFreshnessStatus;
  reasonCode: DailyRiskPolicyReasonCode;
  message: string;
  actionHint: string;
  details: {
    tradeDate: string;
    lastReportAt: string | null;
    ageSeconds: number | null;
    thresholdSeconds: number | null;
    hasOpenPosition: boolean;
    pendingOrdersCount: number;
    latestExecutionAfterReport: boolean;
    latestAdminChangeAfterReport: boolean;
    remainingLossCents: number | null;
    blocksEntry: boolean;
  };
};

const ADMIN_INVALIDATION_ACTIONS = [
  "daily_risk.limit.updated",
  "daily_risk.limit.created",
  "real_trading.approval.limit_updated",
  "real_trading.approval.approved",
  "real_trading.approval.revoked",
  "real_trading.approval.suspended",
  "strategy_config.published",
  "operation.pause.enabled",
  "operation.pause.disabled",
  "operation.command.created",
  "operation.command.executed",
] as const;

function reportClock(state: DailyFinancialRiskState | null | undefined): Date | null {
  if (!state) return null;
  return state.lastReportReceivedAt ?? state.lastUpdatedAt ?? null;
}

function reportAgeSeconds(lastReportAt: Date | null): number | null {
  if (!lastReportAt) return null;
  return Math.max(0, Math.floor((Date.now() - lastReportAt.getTime()) / 1000));
}

export function evaluateDailyRiskFreshnessPolicy(input: {
  tradeDate?: string;
  riskLimit: Pick<DailyFinancialRiskLimit, "enabled"> | null;
  riskState: DailyFinancialRiskState | null;
  latestOperationSnapshot?: {
    hasOpenPosition: boolean;
    pendingOrdersCount: number;
    updatedAt: Date | null;
  } | null;
  invalidation: DailyRiskInvalidationResult;
  recentReportThresholdSeconds?: number;
}): DailyRiskFreshnessPolicyResult {
  const tradeDate = input.tradeDate ?? tradeDateKeySaoPaulo();
  const threshold =
    input.recentReportThresholdSeconds ?? DAILY_RISK_POSITION_PENDING_THRESHOLD_SEC;
  const hasOpenPosition = input.latestOperationSnapshot?.hasOpenPosition ?? false;
  const pendingOrdersCount = input.latestOperationSnapshot?.pendingOrdersCount ?? 0;
  const lastReportAt = reportClock(input.riskState);
  const ageSeconds = reportAgeSeconds(lastReportAt);

  const baseDetails = {
    tradeDate,
    lastReportAt: lastReportAt?.toISOString() ?? null,
    ageSeconds,
    thresholdSeconds: threshold,
    hasOpenPosition,
    pendingOrdersCount,
    latestExecutionAfterReport:
      input.invalidation.reasonCode === "DAILY_RISK_REVALIDATION_REQUIRED_AFTER_TRADE",
    latestAdminChangeAfterReport:
      input.invalidation.reasonCode ===
      "DAILY_RISK_REVALIDATION_REQUIRED_AFTER_ADMIN_CHANGE",
    remainingLossCents: input.riskState?.remainingLossCents ?? null,
    blocksEntry: true,
  };

  if (!input.riskLimit?.enabled) {
    return {
      status: "MISSING",
      reasonCode: "DAILY_RISK_REPORT_MISSING",
      message: "Stop financeiro diário não configurado.",
      actionHint: "Configurar stop financeiro diário no admin.",
      details: { ...baseDetails, blocksEntry: true },
    };
  }

  if (!input.riskState) {
    return {
      status: "MISSING",
      reasonCode: "DAILY_RISK_REPORT_MISSING",
      message:
        "Stop financeiro diário configurado, mas nenhum relatório do pregão foi recebido.",
      actionHint: "Verificar EA online e POST /api/v1/ea/daily-risk/report.",
      details: { ...baseDetails, blocksEntry: true },
    };
  }

  if (input.riskState.tradeDate !== tradeDate) {
    return {
      status: "STALE",
      reasonCode: "DAILY_RISK_TRADE_DATE_MISMATCH",
      message: `Relatório salvo em ${input.riskState.tradeDate}, mas o pregão operacional é ${tradeDate}.`,
      actionHint: "Aguardar novo report com tradeDate correto.",
      details: { ...baseDetails, blocksEntry: true },
    };
  }

  if (input.invalidation.hasInvalidation && input.invalidation.reasonCode) {
    const isTrade =
      input.invalidation.reasonCode ===
      "DAILY_RISK_REVALIDATION_REQUIRED_AFTER_TRADE";
    return {
      status: "REVALIDATION_REQUIRED",
      reasonCode: input.invalidation.reasonCode,
      message: isTrade
        ? "Houve execução após o último DailyRisk. O EA precisa reenviar o relatório."
        : "Houve alteração administrativa após o último DailyRisk. O EA precisa reenviar o relatório.",
      actionHint: isTrade
        ? "Aguardar novo report após a operação ou usar HEALTH_CHECK."
        : "Aguardar novo report após a alteração admin ou usar HEALTH_CHECK.",
      details: { ...baseDetails, blocksEntry: true },
    };
  }

  if (hasOpenPosition && ageSeconds != null && ageSeconds > threshold) {
    return {
      status: "POSITION_REQUIRES_RECENT_REPORT",
      reasonCode: "POSITION_RISK_REPORT_STALE",
      message:
        "Existe posição aberta. O DailyRisk precisa ser atualizado em janela curta.",
      actionHint: "EA precisa reenviar DailyRisk enquanto houver posição aberta.",
      details: {
        ...baseDetails,
        thresholdSeconds: threshold,
        blocksEntry: true,
      },
    };
  }

  if (pendingOrdersCount > 0 && ageSeconds != null && ageSeconds > threshold) {
    return {
      status: "PENDING_ORDERS_REQUIRE_RECENT_REPORT",
      reasonCode: "PENDING_ORDERS_RISK_REPORT_STALE",
      message:
        "Existem ordens pendentes. O DailyRisk precisa ser atualizado em janela curta.",
      actionHint: "EA precisa reenviar DailyRisk enquanto houver ordens pendentes.",
      details: {
        ...baseDetails,
        thresholdSeconds: threshold,
        blocksEntry: true,
      },
    };
  }

  const isRecent = ageSeconds != null && ageSeconds <= threshold;
  const status: DailyRiskFreshnessStatus =
    isRecent && (hasOpenPosition || pendingOrdersCount > 0)
      ? "RECENT_OK"
      : "OK_FOR_DAY";

  return {
    status,
    reasonCode: "DAILY_RISK_OK_FOR_DAY",
    message:
      status === "RECENT_OK"
        ? "DailyRisk recente com exposição operacional ativa."
        : "DailyRisk OK para o pregão. Sem posição aberta, sem ordens pendentes e sem eventos após o report.",
    actionHint:
      status === "RECENT_OK"
        ? "Manter envio periódico enquanto houver exposição."
        : "Relatório válido para o pregão inteiro enquanto não houver operação ou evento invalidante.",
    details: { ...baseDetails, blocksEntry: false },
  };
}

export async function getDailyRiskInvalidationEvents(input: {
  licenseId: string;
  accountLogin: string;
  accountServer: string;
  symbol: string;
  strategyCode: string;
  since: Date | null;
}): Promise<DailyRiskInvalidationResult> {
  if (!input.since) {
    return {
      hasInvalidation: false,
      latestInvalidationAt: null,
      reasonCode: null,
      events: [],
    };
  }

  const strategyCode = normalizeFiboStrategyCode(input.strategyCode);
  const symbol = input.symbol.trim().toUpperCase();
  const events: DailyRiskInvalidationEvent[] = [];

  const [
    execution,
    command,
    adminActions,
    configPublish,
  ] = await Promise.all([
    prisma.execution.findFirst({
      where: {
        licenseId: input.licenseId,
        OR: [
          { createdAt: { gt: input.since } },
          { executedAt: { gt: input.since } },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, executedAt: true },
    }),
    prisma.eAOperationalCommand.findFirst({
      where: {
        licenseId: input.licenseId,
        accountLogin: input.accountLogin,
        accountServer: input.accountServer,
        symbol,
        requestedAt: { gt: input.since },
        status: {
          in: [
            EAOperationalCommandStatus.PENDING,
            EAOperationalCommandStatus.ACKED,
            EAOperationalCommandStatus.EXECUTED,
          ],
        },
      },
      orderBy: { requestedAt: "desc" },
      select: { requestedAt: true, commandType: true },
    }),
    prisma.adminAction.findMany({
      where: {
        createdAt: { gt: input.since },
        targetType: "license",
        targetId: input.licenseId,
        action: { in: [...ADMIN_INVALIDATION_ACTIONS] },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { createdAt: true, action: true },
    }),
    prisma.strategyRuntimeConfigHistory.findFirst({
      where: {
        licenseId: input.licenseId,
        createdAt: { gt: input.since },
        action: "strategy_config.published",
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  if (execution) {
    const at = execution.executedAt ?? execution.createdAt;
    events.push({
      at: at.toISOString(),
      reasonCode: "DAILY_RISK_REVALIDATION_REQUIRED_AFTER_TRADE",
      source: "execution",
    });
  }

  for (const action of adminActions) {
    events.push({
      at: action.createdAt.toISOString(),
      reasonCode: "DAILY_RISK_REVALIDATION_REQUIRED_AFTER_ADMIN_CHANGE",
      source: action.action,
    });
  }

  if (configPublish?.createdAt) {
    events.push({
      at: configPublish.createdAt.toISOString(),
      reasonCode: "DAILY_RISK_REVALIDATION_REQUIRED_AFTER_ADMIN_CHANGE",
      source: "strategy_config.published",
    });
  }

  if (command?.requestedAt) {
    events.push({
      at: command.requestedAt.toISOString(),
      reasonCode: "DAILY_RISK_REVALIDATION_REQUIRED_AFTER_ADMIN_CHANGE",
      source: `operation.command:${command.commandType}`,
    });
  }

  if (events.length === 0) {
    return {
      hasInvalidation: false,
      latestInvalidationAt: null,
      reasonCode: null,
      events: [],
    };
  }

  events.sort((a, b) => b.at.localeCompare(a.at));
  const latest = events[0]!;
  const tradeEvents = events.filter(
    (e) => e.reasonCode === "DAILY_RISK_REVALIDATION_REQUIRED_AFTER_TRADE"
  );
  const reasonCode = (
    tradeEvents.length > 0
      ? "DAILY_RISK_REVALIDATION_REQUIRED_AFTER_TRADE"
      : "DAILY_RISK_REVALIDATION_REQUIRED_AFTER_ADMIN_CHANGE"
  ) as DailyRiskPolicyReasonCode;

  return {
    hasInvalidation: true,
    latestInvalidationAt: new Date(latest.at),
    reasonCode,
    events,
  };
}

export async function loadDailyRiskFreshnessPolicyForLicense(input: {
  licenseId: string;
  accountLogin: string;
  accountServer: string;
  strategyCode: string;
  symbol: string;
  tradeDate?: string;
  riskLimit: DailyFinancialRiskLimit | null;
  riskState: DailyFinancialRiskState | null;
}): Promise<DailyRiskFreshnessPolicyResult> {
  const since = reportClock(input.riskState);

  const [snapshot, invalidation] = await Promise.all([
    prisma.eAOperationalSnapshot.findFirst({
      where: {
        licenseId: input.licenseId,
        accountLogin: input.accountLogin,
        accountServer: input.accountServer,
        symbol: input.symbol.trim().toUpperCase(),
        strategyCode: normalizeFiboStrategyCode(input.strategyCode),
      },
      orderBy: { updatedAt: "desc" },
      select: {
        hasOpenPosition: true,
        pendingOrdersCount: true,
        updatedAt: true,
      },
    }),
    getDailyRiskInvalidationEvents({
      licenseId: input.licenseId,
      accountLogin: input.accountLogin,
      accountServer: input.accountServer,
      symbol: input.symbol,
      strategyCode: input.strategyCode,
      since,
    }),
  ]);

  return evaluateDailyRiskFreshnessPolicy({
    tradeDate: input.tradeDate,
    riskLimit: input.riskLimit,
    riskState: input.riskState,
    latestOperationSnapshot: snapshot,
    invalidation,
  });
}

export function mapDailyRiskPolicyToEntryBlock(
  policy: DailyRiskFreshnessPolicyResult
):
  | { ok: true }
  | { ok: false; reasonCode: string; detail: string; policy: DailyRiskFreshnessPolicyResult } {
  if (!policy.details.blocksEntry) {
    return { ok: true };
  }

  const legacyStale =
    policy.reasonCode === "DAILY_RISK_REPORT_STALE" ||
    policy.reasonCode === "DAILY_RISK_TRADE_DATE_MISMATCH";

  return {
    ok: false,
    reasonCode: legacyStale ? "DAILY_RISK_REPORT_STALE" : policy.reasonCode,
    detail: JSON.stringify({
      message: policy.message,
      actionHint: policy.actionHint,
      dailyRiskPolicy: {
        status: policy.status,
        reasonCode: policy.reasonCode,
        ...policy.details,
      },
    }),
    policy,
  };
}

export function dailyRiskPolicyAllowsDay(policy: DailyRiskFreshnessPolicyResult): boolean {
  return (
    policy.status === "OK_FOR_DAY" ||
    policy.status === "RECENT_OK"
  );
}

export type DailyRiskPolicyPublicDetail = {
  status: DailyRiskFreshnessStatus;
  reasonCode: DailyRiskPolicyReasonCode | string;
  tradeDate: string;
  lastReportAt: string | null;
  hasOpenPosition: boolean;
  pendingOrdersCount: number;
  latestExecutionAfterReport: boolean;
  latestAdminChangeAfterReport: boolean;
  remainingLossCents: number | null;
  ageSeconds?: number | null;
  thresholdSeconds?: number | null;
};

export function toDailyRiskPolicyPublicDetail(
  policy: DailyRiskFreshnessPolicyResult
): DailyRiskPolicyPublicDetail {
  return {
    status: policy.status,
    reasonCode: policy.reasonCode,
    tradeDate: policy.details.tradeDate,
    lastReportAt: policy.details.lastReportAt,
    hasOpenPosition: policy.details.hasOpenPosition,
    pendingOrdersCount: policy.details.pendingOrdersCount,
    latestExecutionAfterReport: policy.details.latestExecutionAfterReport,
    latestAdminChangeAfterReport: policy.details.latestAdminChangeAfterReport,
    remainingLossCents: policy.details.remainingLossCents,
    ageSeconds: policy.details.ageSeconds,
    thresholdSeconds: policy.details.thresholdSeconds,
  };
}

export function policyStatusLabel(status: DailyRiskFreshnessStatus): string {
  switch (status) {
    case "OK_FOR_DAY":
      return "OK_FOR_DAY";
    case "RECENT_OK":
      return "RECENT_OK";
    case "MISSING":
      return "MISSING";
    case "REVALIDATION_REQUIRED":
      return "REVALIDATION_REQUIRED";
    case "STALE":
      return "STALE";
    case "POSITION_REQUIRES_RECENT_REPORT":
    case "PENDING_ORDERS_REQUIRE_RECENT_REPORT":
      return "STALE";
    default:
      return status;
  }
}

export function isDailyRiskStateBlockedForStop(
  status: DailyFinancialRiskStatus | null | undefined
): boolean {
  return status === DailyFinancialRiskStatus.BLOCKED;
}
