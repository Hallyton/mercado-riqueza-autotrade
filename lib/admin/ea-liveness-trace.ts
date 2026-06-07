import prisma from "@/lib/prisma";
import { ACTIVE_DEVICE_WHERE } from "@/lib/licensing/device-lifecycle";
import { MR_FIBO_D1_GUARD_CODE } from "@/lib/risk/autonomous-strategy-reasons";
import { normalizeFiboStrategyCode } from "@/lib/strategy/normalize-strategy-code";
import {
  resolveEaLiveness,
  type EaLivenessDiagnosisCode,
  type EaLivenessResult,
  type EaLivenessStatus,
} from "@/lib/ea/liveness";

export type EaLivenessTraceView = {
  licenseId: string;
  deviceId: string | null;
  accountLogin: string | null;
  accountServer: string | null;
  symbol: string | null;
  strategyCode: string;
  lastSeenAt: string | null;
  lastActivityAt: string | null;
  lastActivitySource: string | null;
  latestHeartbeatAt: string | null;
  latestDailyRiskReportAt: string | null;
  latestOperationSnapshotAt: string | null;
  latestCommandsPollAt: string | null;
  latestCommandAckAt: string | null;
  latestCanTradeAt: string | null;
  latestHealthCheck: {
    commandId: string;
    status: string;
    ackedAt: string | null;
    executedAt: string | null;
    resultCode: string | null;
    requestedAt: string;
    expiresAt: string;
  } | null;
  computedStatus: EaLivenessStatus;
  diagnosisCode: EaLivenessDiagnosisCode;
  ageSeconds: number | null;
  thresholdSeconds: number;
  message: string;
  liveness: EaLivenessResult;
};

export async function buildEaLivenessTraceView(input: {
  licenseId: string;
  accountLogin?: string | null;
  accountServer?: string | null;
  symbol?: string | null;
  strategyCode?: string;
}): Promise<EaLivenessTraceView | null> {
  const license = await prisma.license.findUnique({
    where: { id: input.licenseId },
    include: {
      mt5Account: true,
      robotInstances: { take: 1, orderBy: { createdAt: "desc" } },
    },
  });
  if (!license) return null;

  const robot = license.robotInstances[0];
  const accountLogin =
    input.accountLogin ??
    license.mt5Account?.login ??
    license.expectedAccountLogin ??
    null;
  const accountServer =
    input.accountServer ??
    license.mt5Account?.server ??
    license.expectedAccountServer ??
    null;
  const symbol =
    input.symbol ?? robot?.symbol ?? license.expectedSymbol ?? null;
  const strategyCode = normalizeFiboStrategyCode(
    input.strategyCode ?? robot?.autonomousStrategyCode ?? MR_FIBO_D1_GUARD_CODE
  );

  const device = await prisma.device.findFirst({
    where: { licenseId: input.licenseId, ...ACTIVE_DEVICE_WHERE },
    orderBy: { lastActivityAt: "desc" },
  });

  const latestHeartbeat = await prisma.eaHeartbeat.findFirst({
    where: { licenseId: input.licenseId },
    orderBy: { receivedAt: "desc" },
  });

  const snapshot =
    accountLogin && accountServer && symbol
      ? await prisma.eAOperationalSnapshot.findFirst({
          where: {
            licenseId: input.licenseId,
            accountLogin,
            accountServer,
            symbol: symbol.trim().toUpperCase(),
            strategyCode,
          },
          orderBy: { updatedAt: "desc" },
        })
      : null;

  const dailyRiskState =
    accountLogin && accountServer && symbol
      ? await prisma.dailyFinancialRiskState.findFirst({
          where: {
            licenseId: input.licenseId,
            accountLogin,
            accountServer,
            symbol: symbol.trim().toUpperCase(),
            strategyCode,
          },
          orderBy: { lastUpdatedAt: "desc" },
        })
      : null;

  const latestHealthCheck = await prisma.eAOperationalCommand.findFirst({
    where: {
      licenseId: input.licenseId,
      commandType: "HEALTH_CHECK",
    },
    orderBy: { requestedAt: "desc" },
  });

  const latestAck = await prisma.eAOperationalCommand.findFirst({
    where: {
      licenseId: input.licenseId,
      ackedAt: { not: null },
    },
    orderBy: { ackedAt: "desc" },
  });

  const latestCanTrade = await prisma.autonomousStrategyDecision.findFirst({
    where: { licenseId: input.licenseId },
    orderBy: { createdAt: "desc" },
  });

  const commandsPollAt =
    device?.lastActivitySource === "COMMANDS_POLL"
      ? device.lastActivityAt
      : null;

  const liveness = resolveEaLiveness({
    device,
    latestHeartbeatAt: latestHeartbeat?.receivedAt ?? null,
    latestOperationSnapshotAt: snapshot?.updatedAt ?? null,
    latestDailyRiskReportAt: dailyRiskState?.lastUpdatedAt ?? null,
    latestCommandsPollAt: commandsPollAt,
    latestCommandAckAt: latestAck?.ackedAt ?? null,
    latestCanTradeAt: latestCanTrade?.createdAt ?? null,
    latestHealthCheck,
  });

  return {
    licenseId: input.licenseId,
    deviceId: device?.deviceId ?? null,
    accountLogin,
    accountServer,
    symbol,
    strategyCode,
    lastSeenAt: device?.lastSeenAt?.toISOString() ?? null,
    lastActivityAt: liveness.lastActivityAt,
    lastActivitySource: liveness.lastActivitySource,
    latestHeartbeatAt: latestHeartbeat?.receivedAt.toISOString() ?? null,
    latestDailyRiskReportAt: dailyRiskState?.lastUpdatedAt.toISOString() ?? null,
    latestOperationSnapshotAt: snapshot?.updatedAt.toISOString() ?? null,
    latestCommandsPollAt: commandsPollAt?.toISOString() ?? null,
    latestCommandAckAt: latestAck?.ackedAt?.toISOString() ?? null,
    latestCanTradeAt: latestCanTrade?.createdAt.toISOString() ?? null,
    latestHealthCheck: latestHealthCheck
      ? {
          commandId: latestHealthCheck.id,
          status: latestHealthCheck.status,
          ackedAt: latestHealthCheck.ackedAt?.toISOString() ?? null,
          executedAt: latestHealthCheck.executedAt?.toISOString() ?? null,
          resultCode: latestHealthCheck.resultCode,
          requestedAt: latestHealthCheck.requestedAt.toISOString(),
          expiresAt: latestHealthCheck.expiresAt.toISOString(),
        }
      : null,
    computedStatus: liveness.computedStatus,
    diagnosisCode: liveness.diagnosisCode,
    ageSeconds: liveness.ageSeconds,
    thresholdSeconds: liveness.thresholdSeconds,
    message: liveness.message,
    liveness,
  };
}

export async function loadEaLivenessForLicense(licenseId: string) {
  return buildEaLivenessTraceView({ licenseId });
}
