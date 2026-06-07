import type { DailyFinancialRiskLimit, DailyFinancialRiskState } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  buildDailyRiskReportTrace,
  type DailyRiskReportTrace,
} from "@/lib/admin/daily-risk-report-trace";
import { isEaOffline } from "@/lib/ea/status";
import {
  getDailyRiskStaleThresholdSeconds,
  isDailyRiskStateStale,
} from "@/lib/risk/daily-financial-risk";
import {
  classifyNearbyDailyRiskState,
  dailyRiskStateUniqueWhere,
  formatDailyRiskStateKey,
  resolveDailyRiskStateKey,
  toDailyRiskStateEffectiveKey,
  type DailyRiskStateDiagnosisCode,
  type DailyRiskStateEffectiveKey,
  type DailyRiskStateKeyReceived,
} from "@/lib/risk/daily-risk-state-key";

export type DailyRiskNearbyState = {
  stateId: string;
  key: DailyRiskStateEffectiveKey;
  keyLabel: string;
  diagnosisCode: DailyRiskStateDiagnosisCode;
  lastUpdatedAt: string;
  tradeDate: string;
  symbol: string;
  strategyCode: string;
  accountLogin: string;
  accountServer: string;
  lastReportRequestId: string | null;
};

export type DailyRiskStateLookupResult = {
  expectedKey: DailyRiskStateEffectiveKey;
  expectedKeyLabel: string;
  received: DailyRiskStateKeyReceived;
  exactState: DailyFinancialRiskState | null;
  nearbyStates: DailyRiskNearbyState[];
  diagnosisCode: DailyRiskStateDiagnosisCode;
  tradeDateMismatchState: DailyFinancialRiskState | null;
};

export async function findNearbyDailyRiskStates(
  expectedKey: DailyRiskStateEffectiveKey,
  take = 8
): Promise<DailyRiskNearbyState[]> {
  const rows = await prisma.dailyFinancialRiskState.findMany({
    where: {
      OR: [
        { licenseId: expectedKey.licenseId },
        {
          accountLogin: expectedKey.accountLogin,
          accountServer: expectedKey.accountServer,
        },
      ],
    },
    orderBy: { lastUpdatedAt: "desc" },
    take,
  });

  return rows.map((row) => {
    const key = toDailyRiskStateEffectiveKey(row);
    return {
      stateId: row.id,
      key,
      keyLabel: formatDailyRiskStateKey(key),
      diagnosisCode:
        classifyNearbyDailyRiskState(expectedKey, key) ??
        "DAILY_RISK_STATE_MISSING",
      lastUpdatedAt: row.lastUpdatedAt.toISOString(),
      tradeDate: row.tradeDate,
      symbol: row.symbol,
      strategyCode: row.strategyCode,
      accountLogin: row.accountLogin,
      accountServer: row.accountServer,
      lastReportRequestId: row.lastReportRequestId ?? null,
    };
  });
}

export async function resolveDailyRiskStateLookup(input: {
  licenseId: string;
  accountLogin: string | number;
  accountServer: string;
  symbol: string;
  strategyCode: string;
  tradeDate?: string | null;
  tradeDateFromEa?: string | null;
}): Promise<DailyRiskStateLookupResult> {
  const { effectiveKey, received } = resolveDailyRiskStateKey(input);

  const exactState = await prisma.dailyFinancialRiskState.findUnique({
    where: dailyRiskStateUniqueWhere(effectiveKey),
  });

  if (exactState) {
    return {
      expectedKey: effectiveKey,
      expectedKeyLabel: formatDailyRiskStateKey(effectiveKey),
      received,
      exactState,
      nearbyStates: [],
      diagnosisCode: "DAILY_RISK_STATE_FOUND",
      tradeDateMismatchState: null,
    };
  }

  const nearbyStates = await findNearbyDailyRiskStates(effectiveKey);

  let tradeDateMismatchState: DailyFinancialRiskState | null = null;
  if (received.tradeDateRaw && received.tradeDateMismatch) {
    tradeDateMismatchState = await prisma.dailyFinancialRiskState.findFirst({
      where: {
        licenseId: effectiveKey.licenseId,
        accountLogin: effectiveKey.accountLogin,
        accountServer: effectiveKey.accountServer,
        symbol: effectiveKey.symbol,
        strategyCode: effectiveKey.strategyCode,
        tradeDate: received.tradeDateRaw,
      },
      orderBy: { lastUpdatedAt: "desc" },
    });
  }

  let diagnosisCode: DailyRiskStateDiagnosisCode = "DAILY_RISK_STATE_MISSING";
  if (tradeDateMismatchState) {
    diagnosisCode = "DAILY_RISK_STATE_TRADE_DATE_MISMATCH";
  } else if (nearbyStates.length > 0) {
    diagnosisCode = nearbyStates[0]!.diagnosisCode;
  }

  return {
    expectedKey: effectiveKey,
    expectedKeyLabel: formatDailyRiskStateKey(effectiveKey),
    received,
    exactState: null,
    nearbyStates,
    diagnosisCode,
    tradeDateMismatchState,
  };
}

export type DailyRiskAdminTraceView = {
  licenseId: string;
  expectedKey: DailyRiskStateEffectiveKey;
  expectedKeyLabel: string;
  riskLimit: DailyFinancialRiskLimit | null;
  exactState: DailyFinancialRiskState | null;
  nearbyStates: DailyRiskNearbyState[];
  latestReports: DailyRiskNearbyState[];
  diagnosisCode: DailyRiskStateDiagnosisCode;
  received: DailyRiskStateKeyReceived;
};

export async function buildDailyRiskAdminTraceView(input: {
  licenseId: string;
  accountLogin?: string | null;
  accountServer?: string | null;
  symbol?: string | null;
  strategyCode?: string;
}): Promise<DailyRiskAdminTraceView | null> {
  const limits = await prisma.dailyFinancialRiskLimit.findMany({
    where: { licenseId: input.licenseId },
    orderBy: { updatedAt: "desc" },
  });

  const limit =
    limits.find(
      (row) =>
        (!input.accountLogin ||
          row.accountLogin === String(input.accountLogin).trim()) &&
        (!input.accountServer ||
          row.accountServer === String(input.accountServer).trim()) &&
        (!input.symbol ||
          row.symbol.toUpperCase() === String(input.symbol).trim().toUpperCase())
    ) ?? limits[0];

  if (!limit) {
    return null;
  }

  const lookup = await resolveDailyRiskStateLookup({
    licenseId: limit.licenseId,
    accountLogin: input.accountLogin ?? limit.accountLogin,
    accountServer: input.accountServer ?? limit.accountServer,
    symbol: input.symbol ?? limit.symbol,
    strategyCode: input.strategyCode ?? limit.strategyCode,
  });

  const latestReports = await findNearbyDailyRiskStates(lookup.expectedKey, 5);

  return {
    licenseId: input.licenseId,
    expectedKey: lookup.expectedKey,
    expectedKeyLabel: lookup.expectedKeyLabel,
    riskLimit: limit,
    exactState: lookup.exactState,
    nearbyStates: lookup.nearbyStates,
    latestReports,
    diagnosisCode: lookup.diagnosisCode,
    received: lookup.received,
  };
}

export function describeDailyRiskStateMismatch(input: {
  expectedKey: DailyRiskStateEffectiveKey;
  nearbyStates: DailyRiskNearbyState[];
  diagnosisCode: DailyRiskStateDiagnosisCode;
  received: DailyRiskStateKeyReceived;
}): string | null {
  if (input.diagnosisCode === "DAILY_RISK_STATE_FOUND") return null;

  if (input.received.tradeDateMismatch) {
    return `Relatório recebido com tradeDate ${input.received.tradeDateRaw}, mas o dia operacional é ${input.received.tradeDateOperational}.`;
  }

  const nearby = input.nearbyStates[0];
  if (!nearby) {
    return "Nenhum DailyFinancialRiskState encontrado para a chave operacional esperada.";
  }

  return `Existe relatório diário com chave divergente (${nearby.keyLabel}). Diagnóstico: ${nearby.diagnosisCode}.`;
}

export type DailyRiskTraceDiagnosisCode =
  | "DAILY_RISK_STATE_FOUND_FRESH"
  | "DAILY_RISK_STATE_FOUND_STALE"
  | "DAILY_RISK_STATE_MISSING"
  | "DAILY_RISK_EA_ONLINE_BUT_NOT_REPORTING"
  | "DAILY_RISK_EA_OFFLINE"
  | "DAILY_RISK_LAST_ATTEMPT_FAILED";

export type DailyRiskFullTraceView = DailyRiskAdminTraceView & {
  latestDailyRiskState: DailyFinancialRiskState | null;
  latestDailyRiskStateAgeSeconds: number | null;
  staleThresholdSeconds: number;
  reportTrace: DailyRiskReportTrace;
  latestOperationSnapshot: {
    id: string;
    receivedAt: string;
    lastHeartbeatAt: string | null;
    lastDailyRiskSentAtFromSnapshot: string | null;
    lastDailyRiskStatusFromSnapshot: string | null;
    lastDailyRiskStateIdFromSnapshot: string | null;
    lastDailyRiskErrorCodeFromSnapshot: string | null;
    lastDailyRiskErrorMessageFromSnapshot: string | null;
  } | null;
  latestHeartbeat: {
    receivedAt: string;
    eaStatus: string | null;
  } | null;
  diagnosis: DailyRiskTraceDiagnosisCode;
};

function readSnapshotDailyRiskField(
  raw: unknown,
  key: string
): string | null {
  if (!raw || typeof raw !== "object") return null;
  const value = (raw as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function resolveDailyRiskTraceDiagnosis(input: {
  exactState: DailyFinancialRiskState | null;
  tradeDate: string;
  eaOnline: boolean;
  lastDailyRiskStatusFromSnapshot: string | null;
  lastDailyRiskErrorCodeFromSnapshot: string | null;
}): DailyRiskTraceDiagnosisCode {
  if (!input.exactState) {
    if (input.lastDailyRiskStatusFromSnapshot === "FAILED") {
      return "DAILY_RISK_LAST_ATTEMPT_FAILED";
    }
    if (input.eaOnline) {
      return "DAILY_RISK_EA_ONLINE_BUT_NOT_REPORTING";
    }
    return "DAILY_RISK_EA_OFFLINE";
  }

  if (input.exactState.tradeDate !== input.tradeDate) {
    return "DAILY_RISK_STATE_MISSING";
  }

  if (isDailyRiskStateStale(input.exactState.lastUpdatedAt)) {
    if (input.lastDailyRiskStatusFromSnapshot === "FAILED") {
      return "DAILY_RISK_LAST_ATTEMPT_FAILED";
    }
    if (input.eaOnline) {
      return "DAILY_RISK_EA_ONLINE_BUT_NOT_REPORTING";
    }
    return "DAILY_RISK_STATE_FOUND_STALE";
  }

  return "DAILY_RISK_STATE_FOUND_FRESH";
}

export async function buildDailyRiskFullTraceView(input: {
  licenseId: string;
  accountLogin?: string | null;
  accountServer?: string | null;
  symbol?: string | null;
  strategyCode?: string;
}): Promise<DailyRiskFullTraceView | null> {
  const base = await buildDailyRiskAdminTraceView(input);
  if (!base) return null;

  const tradeDate = base.expectedKey.tradeDate;
  const reportTrace = buildDailyRiskReportTrace(base.exactState, tradeDate);
  const staleThresholdSeconds = getDailyRiskStaleThresholdSeconds();

  const snapshot = await prisma.eAOperationalSnapshot.findFirst({
    where: {
      licenseId: input.licenseId,
      ...(input.accountLogin
        ? { accountLogin: String(input.accountLogin).trim() }
        : {}),
      ...(input.accountServer
        ? { accountServer: String(input.accountServer).trim() }
        : {}),
      ...(input.symbol
        ? { symbol: String(input.symbol).trim().toUpperCase() }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  const heartbeat = await prisma.eaHeartbeat.findFirst({
    where: { licenseId: input.licenseId },
    orderBy: { receivedAt: "desc" },
  });

  const device = await prisma.device.findFirst({
    where: { licenseId: input.licenseId },
    orderBy: { lastSeenAt: "desc" },
  });
  const eaOnline = device ? !isEaOffline(device.lastSeenAt) : false;

  const rawSnapshot = snapshot?.rawSnapshotJson;
  const lastDailyRiskStatusFromSnapshot = readSnapshotDailyRiskField(
    rawSnapshot,
    "last_daily_risk_status"
  );
  const lastDailyRiskErrorCodeFromSnapshot = readSnapshotDailyRiskField(
    rawSnapshot,
    "last_daily_risk_error_code"
  );

  const diagnosis = resolveDailyRiskTraceDiagnosis({
    exactState: base.exactState,
    tradeDate,
    eaOnline,
    lastDailyRiskStatusFromSnapshot,
    lastDailyRiskErrorCodeFromSnapshot,
  });

  const latestDailyRiskStateAgeSeconds =
    base.exactState != null
      ? Math.max(
          0,
          Math.floor((Date.now() - base.exactState.lastUpdatedAt.getTime()) / 1000)
        )
      : null;

  return {
    ...base,
    latestDailyRiskState: base.exactState,
    latestDailyRiskStateAgeSeconds,
    staleThresholdSeconds,
    reportTrace,
    latestOperationSnapshot: snapshot
      ? {
          id: snapshot.id,
          receivedAt: snapshot.updatedAt.toISOString(),
          lastHeartbeatAt: snapshot.lastHeartbeatAt?.toISOString() ?? null,
          lastDailyRiskSentAtFromSnapshot: readSnapshotDailyRiskField(
            rawSnapshot,
            "last_daily_risk_sent_at"
          ),
          lastDailyRiskStatusFromSnapshot,
          lastDailyRiskStateIdFromSnapshot: readSnapshotDailyRiskField(
            rawSnapshot,
            "last_daily_risk_state_id"
          ),
          lastDailyRiskErrorCodeFromSnapshot,
          lastDailyRiskErrorMessageFromSnapshot: readSnapshotDailyRiskField(
            rawSnapshot,
            "last_daily_risk_error_message"
          ),
        }
      : null,
    latestHeartbeat: heartbeat
      ? {
          receivedAt: heartbeat.receivedAt.toISOString(),
          eaStatus:
            heartbeat.reportPayload &&
            typeof heartbeat.reportPayload === "object" &&
            "ea_status" in (heartbeat.reportPayload as object)
              ? String(
                  (heartbeat.reportPayload as Record<string, unknown>).ea_status
                )
              : null,
        }
      : null,
    diagnosis,
  };
}
