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
import { evaluateDailyFinancialStopForEntry, tradeDateKeySaoPaulo, getDailyRiskStaleThresholdSeconds } from "@/lib/risk/daily-financial-risk";
import { isRealTradingEnabled } from "@/lib/risk/real-trading-guard";
import {
  buildDailyRiskLinkageDetail,
  resolveFiboDailyRiskLimit,
} from "@/lib/admin/daily-risk-limit-resolver";
import { normalizeFiboDailyRiskStrategyCodes } from "@/lib/admin/normalize-fibo-daily-risk-records";
import {
  buildDailyRiskReportTrace,
  dailyRiskReportActionHint,
  dailyRiskReportOperationalMessage,
  formatDailyRiskCompositeStatus,
  type DailyRiskReportTrace,
} from "@/lib/admin/daily-risk-report-trace";
import {
  describeDailyRiskStateMismatch,
  resolveDailyRiskStateLookup,
  type DailyRiskNearbyState,
} from "@/lib/admin/daily-risk-state-trace";
import type { DailyRiskStateEffectiveKey } from "@/lib/risk/daily-risk-state-key";
import { buildDefaultMrFiboD1GuardConfig, mrFiboD1GuardConfigSchema } from "@/lib/strategy/mr-fibo-d1-guard-config";
import { LOT_TOTAL_EXCEEDS_MAX_CONTRACTS } from "@/lib/strategy/mr-fibo-d1-guard-readiness";

export type FiboGuardClientBucket = "READY" | "EA_NOT_READY" | "PLATFORM_BLOCKED";

export type DailyRiskLinkageDiagnostic = {
  licenseId: string;
  accountLogin: string | null;
  accountServer: string | null;
  symbol: string | null;
  expectedStrategyCode: string;
  stopConfigured: boolean;
  foundDailyRiskLimit: boolean;
  foundDailyRiskStrategyCode: string | null;
  dailyLimitBrl: number | null;
  enabled: boolean | null;
  includeOpenPnL: boolean | null;
  riskEstimatedBrl: number | null;
  remainingLossBrl: number | null;
  dailyRiskStatus: string | null;
  reportTrace: DailyRiskReportTrace | null;
  expectedStateKey: DailyRiskStateEffectiveKey | null;
  nearbyStates: DailyRiskNearbyState[];
  stateLookupDiagnosis: string | null;
  primaryReasonCode: string | null;
  detailMessage: string | null;
  operationalMessage: string | null;
  recommendedAction: string | null;
  compositeStatus: {
    configuredLabel: string;
    reportLabel: string;
    blockLabel: string | null;
  } | null;
  latestOperationSnapshotAt: string | null;
  latestHeartbeatAt: string | null;
  lastDailyRiskSentAtFromSnapshot: string | null;
  lastDailyRiskStatusFromSnapshot: string | null;
  lastDailyRiskErrorFromSnapshot: string | null;
  latestRefreshCommandStatus: string | null;
  staleThresholdMinutes: number;
};

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
  dailyRiskDiagnostic: DailyRiskLinkageDiagnostic | null;
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

function readSnapshotField(raw: unknown, key: string): string | null {
  if (!raw || typeof raw !== "object") return null;
  const value = (raw as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function getFiboD1GuardOperationCenterView() {
  await normalizeFiboDailyRiskStrategyCodes();

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
      dailyFinancialRiskLimits: true,
    },
    take: 200,
  });

  const rows: FiboGuardClientRow[] = [];
  const tradeDate = tradeDateKeySaoPaulo();

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
    const accountLogin =
      license.mt5Account?.login ?? license.expectedAccountLogin ?? null;
    const accountServer =
      license.mt5Account?.server ?? license.expectedAccountServer ?? null;
    const symbolRaw = robot.symbol ?? license.expectedSymbol ?? null;
    const symbol = symbolRaw ? symbolRaw.trim().toUpperCase() : null;

    if (symbol && loteTotal && stopPoints) {
      const pointValue = await prisma.instrumentPointValue.findFirst({
        where: { symbol: symbol.toUpperCase() },
      });
      if (pointValue) {
        estimatedRiskBrl =
          (loteTotal * stopPoints * pointValue.centsPerPointPerContract) / 100;
      }
    }

    const dailyRiskResolution =
      accountLogin && accountServer && symbol
        ? resolveFiboDailyRiskLimit(license.dailyFinancialRiskLimits, {
            accountLogin,
            accountServer,
            symbol,
          })
        : {
            canonical: null,
            aliasLimits: [],
            effective: null,
            strategyMismatch: false,
            mismatchStrategyCodes: [],
          };

    const dailyLimit = dailyRiskResolution.canonical ?? dailyRiskResolution.effective;
    let stateLookup: Awaited<ReturnType<typeof resolveDailyRiskStateLookup>> | null =
      null;

    if (dailyLimit && accountLogin && accountServer && symbol) {
      stateLookup = await resolveDailyRiskStateLookup({
        licenseId: license.id,
        accountLogin,
        accountServer,
        symbol,
        strategyCode: dailyLimit.strategyCode,
      });
    }

    const dailyRiskState = stateLookup?.exactState ?? null;
    const reportTrace =
      stateLookup != null
        ? buildDailyRiskReportTrace(
            dailyRiskState,
            stateLookup.expectedKey.tradeDate
          )
        : null;

    let dailyRiskDiagnostic: DailyRiskLinkageDiagnostic | null = null;
    let remainingLossBrl: number | null = null;
    let dailyRiskStatus: string | null = null;

    if (accountLogin && accountServer && symbol) {
      const [operationSnapshot, latestRefreshCommand, latestHeartbeat] =
        await Promise.all([
          prisma.eAOperationalSnapshot.findFirst({
            where: {
              licenseId: license.id,
              accountLogin,
              accountServer,
              symbol,
            },
            orderBy: { updatedAt: "desc" },
          }),
          prisma.eAOperationalCommand.findFirst({
            where: {
              licenseId: license.id,
              commandType: "REFRESH_STATUS",
            },
            orderBy: { createdAt: "desc" },
          }),
          prisma.eaHeartbeat.findFirst({
            where: { licenseId: license.id },
            orderBy: { receivedAt: "desc" },
          }),
        ]);

      const rawSnapshot = operationSnapshot?.rawSnapshotJson;
      const compositeStatus = formatDailyRiskCompositeStatus({
        stopConfigured: Boolean(dailyLimit?.enabled),
        report: reportTrace,
      });

      dailyRiskDiagnostic = {
        licenseId: license.id,
        accountLogin,
        accountServer,
        symbol,
        expectedStrategyCode: MR_FIBO_D1_GUARD_CODE,
        stopConfigured: Boolean(dailyLimit?.enabled),
        foundDailyRiskLimit: Boolean(dailyLimit),
        foundDailyRiskStrategyCode: dailyLimit?.strategyCode ?? null,
        dailyLimitBrl: dailyLimit
          ? dailyLimit.dailyLossLimitCents / 100
          : null,
        enabled: dailyLimit?.enabled ?? null,
        includeOpenPnL: dailyLimit?.includeOpenPnL ?? null,
        riskEstimatedBrl: estimatedRiskBrl,
        remainingLossBrl: reportTrace?.remainingLossBrl ?? null,
        dailyRiskStatus: reportTrace?.stateStatus ?? null,
        reportTrace,
        expectedStateKey: stateLookup?.expectedKey ?? null,
        nearbyStates: stateLookup?.nearbyStates ?? [],
        stateLookupDiagnosis: stateLookup
          ? describeDailyRiskStateMismatch({
              expectedKey: stateLookup.expectedKey,
              nearbyStates: stateLookup.nearbyStates,
              diagnosisCode: stateLookup.diagnosisCode,
              received: stateLookup.received,
            })
          : null,
        primaryReasonCode: null,
        detailMessage: buildDailyRiskLinkageDetail({
          resolution: dailyRiskResolution,
          expectedStrategyCode: MR_FIBO_D1_GUARD_CODE,
          accountLogin,
          accountServer,
          symbol,
        }),
        operationalMessage: dailyRiskReportOperationalMessage({
          limitConfigured: Boolean(dailyLimit?.enabled),
          report: reportTrace ?? buildDailyRiskReportTrace(null, tradeDate),
        }),
        recommendedAction: reportTrace
          ? dailyRiskReportActionHint(reportTrace.reportStatus)
          : dailyLimit?.enabled
            ? dailyRiskReportActionHint("MISSING")
            : null,
        compositeStatus,
        latestOperationSnapshotAt:
          operationSnapshot?.updatedAt.toISOString() ?? null,
        latestHeartbeatAt: latestHeartbeat?.receivedAt?.toISOString() ?? null,
        lastDailyRiskSentAtFromSnapshot: readSnapshotField(
          rawSnapshot,
          "last_daily_risk_sent_at"
        ),
        lastDailyRiskStatusFromSnapshot: readSnapshotField(
          rawSnapshot,
          "last_daily_risk_status"
        ),
        lastDailyRiskErrorFromSnapshot:
          readSnapshotField(rawSnapshot, "last_daily_risk_error_code") ??
          readSnapshotField(rawSnapshot, "last_daily_risk_error_message"),
        latestRefreshCommandStatus: latestRefreshCommand?.status ?? null,
        staleThresholdMinutes: Math.floor(
          getDailyRiskStaleThresholdSeconds() / 60
        ),
      };
    }

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
    if (robot.robotProduct.requiresDailyFinancialStop) {
      if (dailyRiskResolution.strategyMismatch) {
        reasonCodes.push("DAILY_FINANCIAL_STOP_STRATEGY_MISMATCH");
        bucket = "PLATFORM_BLOCKED";
        if (dailyRiskDiagnostic) {
          dailyRiskDiagnostic.primaryReasonCode =
            "DAILY_FINANCIAL_STOP_STRATEGY_MISMATCH";
        }
      } else if (!dailyLimit?.enabled) {
        reasonCodes.push("DAILY_FINANCIAL_STOP_NOT_CONFIGURED");
        bucket = "PLATFORM_BLOCKED";
        if (dailyRiskDiagnostic) {
          dailyRiskDiagnostic.primaryReasonCode =
            "DAILY_FINANCIAL_STOP_NOT_CONFIGURED";
        }
      }
    }

    if (
      loteTotal &&
      stopPoints &&
      dailyLimit?.enabled &&
      accountLogin &&
      accountServer &&
      symbol &&
      !dailyRiskResolution.strategyMismatch
    ) {
      const dailyCheck = await evaluateDailyFinancialStopForEntry({
        licenseId: license.id,
        accountLogin,
        accountServer,
        strategyCode: MR_FIBO_D1_GUARD_CODE,
        symbol,
        requestedContracts: loteTotal,
        stopPoints,
        requiresDailyStop: true,
      });
      if (dailyCheck.ok && dailyCheck.snapshot) {
        remainingLossBrl = dailyCheck.snapshot.remainingLossCents / 100;
        dailyRiskStatus = dailyCheck.snapshot.status;
        if (dailyRiskDiagnostic) {
          dailyRiskDiagnostic.remainingLossBrl = remainingLossBrl;
          dailyRiskDiagnostic.dailyRiskStatus = dailyRiskStatus;
        }
      }
      if (!dailyCheck.ok) {
        reasonCodes.push(dailyCheck.reasonCode);
        bucket = "PLATFORM_BLOCKED";
        if (dailyRiskDiagnostic) {
          dailyRiskDiagnostic.primaryReasonCode = dailyCheck.reasonCode;
          dailyRiskDiagnostic.detailMessage = dailyCheck.detail;
          dailyRiskDiagnostic.operationalMessage =
            dailyRiskReportOperationalMessage({
              limitConfigured: true,
              report:
                dailyRiskDiagnostic.reportTrace ??
                buildDailyRiskReportTrace(null, tradeDate),
            });
          dailyRiskDiagnostic.recommendedAction = dailyRiskReportActionHint(
            dailyCheck.reasonCode === "DAILY_RISK_REPORT_STALE"
              ? "STALE"
              : dailyCheck.reasonCode === "DAILY_RISK_REPORT_MISSING"
                ? "MISSING"
                : reportTrace?.reportStatus ?? "MISSING"
          );
        }
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
      accountLogin,
      accountServer,
      symbol,
      magicNumber: robot.magicNumber ?? license.expectedMagicNumber,
      configuredContracts: loteTotal,
      estimatedRiskBrl,
      dailyStopLimitBrl: dailyLimit
        ? dailyLimit.dailyLossLimitCents / 100
        : null,
      dailyStopStatus: dailyRiskResolution.strategyMismatch
        ? "STRATEGY_MISMATCH"
        : dailyLimit?.enabled
          ? "CONFIGURED"
          : dailyLimit
            ? "INACTIVE"
            : "MISSING",
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
      dailyRiskDiagnostic,
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
