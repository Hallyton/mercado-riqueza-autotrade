import {
  EAOperationalCommandStatus,
  type Device,
  type EAOperationalCommand,
} from "@prisma/client";
import type { EaActivitySource } from "@/lib/ea/device-activity";

export const EA_HEARTBEAT_IDEAL_INTERVAL_SEC = 30;
export const EA_LIVENESS_ONLINE_THRESHOLD_SEC = 180;
export const EA_LIVENESS_DEGRADED_THRESHOLD_SEC = 300;
export const EA_HEARTBEAT_STALE_THRESHOLD_SEC = 120;
export const EA_HEALTH_CHECK_TIMEOUT_SEC = 60;

export type EaLivenessStatus =
  | "ONLINE"
  | "DEGRADED"
  | "CHECKING"
  | "UNRESPONSIVE"
  | "OFFLINE"
  | "UNKNOWN";

export type EaLivenessDiagnosisCode =
  | "EA_LIVENESS_ONLINE"
  | "EA_LIVENESS_DEGRADED_HEARTBEAT_STALE"
  | "EA_LIVENESS_CHECKING"
  | "EA_LIVENESS_UNRESPONSIVE"
  | "EA_LIVENESS_OFFLINE_NO_ACTIVITY"
  | "EA_LIVENESS_HAS_DAILY_RISK_BUT_NO_HEARTBEAT"
  | "EA_LIVENESS_HAS_SNAPSHOT_BUT_NO_HEARTBEAT"
  | "EA_LIVENESS_DEVICE_NOT_FOUND";

export type EaLivenessInput = {
  device: Device | null;
  latestHeartbeatAt: Date | null;
  latestOperationSnapshotAt: Date | null;
  latestDailyRiskReportAt: Date | null;
  latestCommandsPollAt: Date | null;
  latestCommandAckAt: Date | null;
  latestCanTradeAt: Date | null;
  latestHealthCheck: EAOperationalCommand | null;
  now?: Date;
};

export type EaLivenessResult = {
  computedStatus: EaLivenessStatus;
  diagnosisCode: EaLivenessDiagnosisCode;
  lastActivityAt: string | null;
  lastActivitySource: EaActivitySource | string | null;
  ageSeconds: number | null;
  thresholdSeconds: number;
  onlineThresholdSeconds: number;
  degradedThresholdSeconds: number;
  heartbeatAgeSeconds: number | null;
  snapshotAgeSeconds: number | null;
  dailyRiskAgeSeconds: number | null;
  healthCheckStatus: EAOperationalCommandStatus | null;
  healthCheckAgeSeconds: number | null;
  message: string;
  blocksTrading: boolean;
};

function ageSecondsFrom(at: Date | null | undefined, now: Date): number | null {
  if (!at) return null;
  return Math.max(0, Math.floor((now.getTime() - at.getTime()) / 1000));
}

function maxDate(...dates: Array<Date | null | undefined>): Date | null {
  const valid = dates.filter(Boolean) as Date[];
  if (valid.length === 0) return null;
  return new Date(Math.max(...valid.map((d) => d.getTime())));
}

function activitySourceFromDevice(device: Device | null): string | null {
  return device?.lastActivitySource ?? null;
}

export function resolveEaLiveness(input: EaLivenessInput): EaLivenessResult {
  const now = input.now ?? new Date();
  const thresholdSeconds = EA_LIVENESS_DEGRADED_THRESHOLD_SEC;

  if (!input.device) {
    return {
      computedStatus: "UNKNOWN",
      diagnosisCode: "EA_LIVENESS_DEVICE_NOT_FOUND",
      lastActivityAt: null,
      lastActivitySource: null,
      ageSeconds: null,
      thresholdSeconds,
      onlineThresholdSeconds: EA_LIVENESS_ONLINE_THRESHOLD_SEC,
      degradedThresholdSeconds: EA_LIVENESS_DEGRADED_THRESHOLD_SEC,
      heartbeatAgeSeconds: null,
      snapshotAgeSeconds: null,
      dailyRiskAgeSeconds: null,
      healthCheckStatus: null,
      healthCheckAgeSeconds: null,
      message: "Nenhum device ativo encontrado para a licença.",
      blocksTrading: true,
    };
  }

  const healthCheck = input.latestHealthCheck;
  const healthCheckAgeSeconds = healthCheck
    ? ageSecondsFrom(healthCheck.requestedAt, now)
    : null;

  const lastActivityAt = maxDate(
    input.device.lastSeenAt,
    input.device.lastActivityAt,
    input.latestOperationSnapshotAt,
    input.latestDailyRiskReportAt,
    input.latestCommandsPollAt,
    input.latestCommandAckAt,
    input.latestCanTradeAt,
    healthCheck?.executedAt,
    healthCheck?.ackedAt,
    input.latestHeartbeatAt
  );

  const ageSeconds = ageSecondsFrom(lastActivityAt, now);
  const heartbeatAgeSeconds = ageSecondsFrom(
    input.latestHeartbeatAt ?? input.device.lastSeenAt,
    now
  );
  const snapshotAgeSeconds = ageSecondsFrom(input.latestOperationSnapshotAt, now);
  const dailyRiskAgeSeconds = ageSecondsFrom(input.latestDailyRiskReportAt, now);
  const lastActivitySource =
    activitySourceFromDevice(input.device) ??
    (input.latestDailyRiskReportAt ? "DAILY_RISK_REPORT" : null);

  const healthCheckPending =
    healthCheck &&
    (healthCheck.status === EAOperationalCommandStatus.PENDING ||
      healthCheck.status === EAOperationalCommandStatus.ACKED) &&
    healthCheck.expiresAt > now;

  const healthCheckExpired =
    healthCheck &&
    (healthCheck.status === EAOperationalCommandStatus.EXPIRED ||
      ((healthCheck.status === EAOperationalCommandStatus.PENDING ||
        healthCheck.status === EAOperationalCommandStatus.ACKED) &&
        healthCheck.expiresAt <= now));

  const healthCheckExecutedRecently =
    healthCheck?.status === EAOperationalCommandStatus.EXECUTED &&
    healthCheck.executedAt != null &&
    ageSecondsFrom(healthCheck.executedAt, now)! <= EA_LIVENESS_ONLINE_THRESHOLD_SEC;

  if (healthCheckPending) {
    return {
      computedStatus: "CHECKING",
      diagnosisCode: "EA_LIVENESS_CHECKING",
      lastActivityAt: lastActivityAt?.toISOString() ?? null,
      lastActivitySource,
      ageSeconds,
      thresholdSeconds,
      onlineThresholdSeconds: EA_LIVENESS_ONLINE_THRESHOLD_SEC,
      degradedThresholdSeconds: EA_LIVENESS_DEGRADED_THRESHOLD_SEC,
      heartbeatAgeSeconds,
      snapshotAgeSeconds,
      dailyRiskAgeSeconds,
      healthCheckStatus: healthCheck.status,
      healthCheckAgeSeconds,
      message: "Health check enviado. Aguardando o EA consultar comandos.",
      blocksTrading: false,
    };
  }

  if (healthCheckExpired && (ageSeconds == null || ageSeconds > thresholdSeconds)) {
    return {
      computedStatus: "UNRESPONSIVE",
      diagnosisCode: "EA_LIVENESS_UNRESPONSIVE",
      lastActivityAt: lastActivityAt?.toISOString() ?? null,
      lastActivitySource,
      ageSeconds,
      thresholdSeconds,
      onlineThresholdSeconds: EA_LIVENESS_ONLINE_THRESHOLD_SEC,
      degradedThresholdSeconds: EA_LIVENESS_DEGRADED_THRESHOLD_SEC,
      heartbeatAgeSeconds,
      snapshotAgeSeconds,
      dailyRiskAgeSeconds,
      healthCheckStatus: EAOperationalCommandStatus.EXPIRED,
      healthCheckAgeSeconds,
      message: "Health check expirou sem resposta do EA.",
      blocksTrading: true,
    };
  }

  if (
    healthCheckExecutedRecently ||
    (ageSeconds != null && ageSeconds <= EA_LIVENESS_ONLINE_THRESHOLD_SEC)
  ) {
    const sourceLabel = lastActivitySource ?? "atividade autenticada";
    return {
      computedStatus: "ONLINE",
      diagnosisCode: "EA_LIVENESS_ONLINE",
      lastActivityAt: lastActivityAt?.toISOString() ?? null,
      lastActivitySource,
      ageSeconds,
      thresholdSeconds,
      onlineThresholdSeconds: EA_LIVENESS_ONLINE_THRESHOLD_SEC,
      degradedThresholdSeconds: EA_LIVENESS_DEGRADED_THRESHOLD_SEC,
      heartbeatAgeSeconds,
      snapshotAgeSeconds,
      dailyRiskAgeSeconds,
      healthCheckStatus: healthCheck?.status ?? null,
      healthCheckAgeSeconds,
      message: `EA comunicou via ${sourceLabel}${ageSeconds != null ? ` há ${ageSeconds}s` : ""}.`,
      blocksTrading: false,
    };
  }

  if (ageSeconds != null && ageSeconds <= EA_LIVENESS_DEGRADED_THRESHOLD_SEC) {
    const diagnosisCode =
      dailyRiskAgeSeconds != null &&
      dailyRiskAgeSeconds <= EA_LIVENESS_DEGRADED_THRESHOLD_SEC &&
      heartbeatAgeSeconds != null &&
      heartbeatAgeSeconds > EA_HEARTBEAT_STALE_THRESHOLD_SEC
        ? "EA_LIVENESS_HAS_DAILY_RISK_BUT_NO_HEARTBEAT"
        : snapshotAgeSeconds != null &&
            snapshotAgeSeconds <= EA_LIVENESS_DEGRADED_THRESHOLD_SEC &&
            heartbeatAgeSeconds != null &&
            heartbeatAgeSeconds > EA_HEARTBEAT_STALE_THRESHOLD_SEC
          ? "EA_LIVENESS_HAS_SNAPSHOT_BUT_NO_HEARTBEAT"
          : "EA_LIVENESS_DEGRADED_HEARTBEAT_STALE";

    return {
      computedStatus: "DEGRADED",
      diagnosisCode,
      lastActivityAt: lastActivityAt?.toISOString() ?? null,
      lastActivitySource,
      ageSeconds,
      thresholdSeconds,
      onlineThresholdSeconds: EA_LIVENESS_ONLINE_THRESHOLD_SEC,
      degradedThresholdSeconds: EA_LIVENESS_DEGRADED_THRESHOLD_SEC,
      heartbeatAgeSeconds,
      snapshotAgeSeconds,
      dailyRiskAgeSeconds,
      healthCheckStatus: healthCheck?.status ?? null,
      healthCheckAgeSeconds,
      message: `EA comunicou via ${lastActivitySource ?? "atividade"} há ${ageSeconds}s, mas heartbeat específico está atrasado.`,
      blocksTrading: false,
    };
  }

  return {
    computedStatus: "OFFLINE",
    diagnosisCode: "EA_LIVENESS_OFFLINE_NO_ACTIVITY",
    lastActivityAt: lastActivityAt?.toISOString() ?? null,
    lastActivitySource,
    ageSeconds,
    thresholdSeconds,
    onlineThresholdSeconds: EA_LIVENESS_ONLINE_THRESHOLD_SEC,
    degradedThresholdSeconds: EA_LIVENESS_DEGRADED_THRESHOLD_SEC,
    heartbeatAgeSeconds,
    snapshotAgeSeconds,
    dailyRiskAgeSeconds,
    healthCheckStatus: healthCheck?.status ?? null,
    healthCheckAgeSeconds,
    message: "Nenhuma atividade autenticada recente foi recebida.",
    blocksTrading: true,
  };
}
