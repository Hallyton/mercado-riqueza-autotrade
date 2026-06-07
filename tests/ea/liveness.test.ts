import { describe, expect, it } from "vitest";
import {
  EAOperationalCommandStatus,
  type Device,
  type EAOperationalCommand,
} from "@prisma/client";
import {
  EA_LIVENESS_DEGRADED_THRESHOLD_SEC,
  EA_LIVENESS_ONLINE_THRESHOLD_SEC,
  resolveEaLiveness,
} from "@/lib/ea/liveness";

const baseDevice = {
  id: "dev-row",
  deviceId: "device-1",
  licenseId: "lic-1",
  lastSeenAt: new Date("2026-06-02T10:00:00Z"),
  lastActivityAt: new Date("2026-06-02T10:00:30Z"),
  lastActivitySource: "OPERATION_SNAPSHOT",
  lastActivityRequestId: "req-1",
} as Device;

describe("resolveEaLiveness", () => {
  const now = new Date("2026-06-02T10:01:00Z");

  it("returns ONLINE when recent authenticated activity exists", () => {
    const result = resolveEaLiveness({
      device: baseDevice,
      latestHeartbeatAt: new Date("2026-06-02T09:58:00Z"),
      latestOperationSnapshotAt: new Date("2026-06-02T10:00:30Z"),
      latestDailyRiskReportAt: null,
      latestCommandsPollAt: null,
      latestCommandAckAt: null,
      latestCanTradeAt: null,
      latestHealthCheck: null,
      now,
    });

    expect(result.computedStatus).toBe("ONLINE");
    expect(result.blocksTrading).toBe(false);
    expect(result.diagnosisCode).toBe("EA_LIVENESS_ONLINE");
  });

  it("returns DEGRADED when activity is recent but heartbeat is stale", () => {
    const result = resolveEaLiveness({
      device: {
        ...baseDevice,
        lastSeenAt: new Date("2026-06-02T09:57:00Z"),
        lastActivitySource: "DAILY_RISK_REPORT",
        lastActivityAt: new Date("2026-06-02T09:57:00Z"),
      },
      latestHeartbeatAt: new Date("2026-06-02T09:50:00Z"),
      latestOperationSnapshotAt: null,
      latestDailyRiskReportAt: new Date("2026-06-02T09:57:00Z"),
      latestCommandsPollAt: null,
      latestCommandAckAt: null,
      latestCanTradeAt: null,
      latestHealthCheck: null,
      now: new Date("2026-06-02T10:01:00Z"),
    });

    expect(result.computedStatus).toBe("DEGRADED");
    expect(result.blocksTrading).toBe(false);
    expect(result.diagnosisCode).toBe("EA_LIVENESS_HAS_DAILY_RISK_BUT_NO_HEARTBEAT");
  });

  it("returns CHECKING when health check is pending", () => {
    const healthCheck = {
      id: "hc-1",
      status: EAOperationalCommandStatus.PENDING,
      requestedAt: new Date("2026-06-02T10:00:50Z"),
      expiresAt: new Date("2026-06-02T10:01:50Z"),
      ackedAt: null,
      executedAt: null,
    } as EAOperationalCommand;

    const result = resolveEaLiveness({
      device: baseDevice,
      latestHeartbeatAt: null,
      latestOperationSnapshotAt: null,
      latestDailyRiskReportAt: null,
      latestCommandsPollAt: null,
      latestCommandAckAt: null,
      latestCanTradeAt: null,
      latestHealthCheck: healthCheck,
      now,
    });

    expect(result.computedStatus).toBe("CHECKING");
    expect(result.diagnosisCode).toBe("EA_LIVENESS_CHECKING");
  });

  it("returns UNRESPONSIVE when health check expired without activity", () => {
    const healthCheck = {
      id: "hc-2",
      status: EAOperationalCommandStatus.PENDING,
      requestedAt: new Date("2026-06-02T09:58:00Z"),
      expiresAt: new Date("2026-06-02T09:59:00Z"),
      ackedAt: null,
      executedAt: null,
    } as EAOperationalCommand;

    const result = resolveEaLiveness({
      device: {
        ...baseDevice,
        lastSeenAt: new Date("2026-06-02T09:50:00Z"),
        lastActivityAt: new Date("2026-06-02T09:50:00Z"),
      },
      latestHeartbeatAt: new Date("2026-06-02T09:50:00Z"),
      latestOperationSnapshotAt: null,
      latestDailyRiskReportAt: null,
      latestCommandsPollAt: null,
      latestCommandAckAt: null,
      latestCanTradeAt: null,
      latestHealthCheck: healthCheck,
      now,
    });

    expect(result.computedStatus).toBe("UNRESPONSIVE");
    expect(result.blocksTrading).toBe(true);
  });

  it("returns OFFLINE when no recent activity exists", () => {
    const result = resolveEaLiveness({
      device: {
        ...baseDevice,
        lastActivityAt: new Date("2026-06-02T09:50:00Z"),
        lastSeenAt: new Date("2026-06-02T09:50:00Z"),
      },
      latestHeartbeatAt: new Date("2026-06-02T09:50:00Z"),
      latestOperationSnapshotAt: null,
      latestDailyRiskReportAt: null,
      latestCommandsPollAt: null,
      latestCommandAckAt: null,
      latestCanTradeAt: null,
      latestHealthCheck: null,
      now,
    });

    expect(result.computedStatus).toBe("OFFLINE");
    expect(result.ageSeconds).toBeGreaterThan(EA_LIVENESS_DEGRADED_THRESHOLD_SEC);
    expect(result.blocksTrading).toBe(true);
  });

  it("returns ONLINE when health check executed recently", () => {
    const healthCheck = {
      id: "hc-3",
      status: EAOperationalCommandStatus.EXECUTED,
      requestedAt: new Date("2026-06-02T10:00:40Z"),
      expiresAt: new Date("2026-06-02T10:01:40Z"),
      ackedAt: new Date("2026-06-02T10:00:45Z"),
      executedAt: new Date("2026-06-02T10:00:50Z"),
    } as EAOperationalCommand;

    const result = resolveEaLiveness({
      device: {
        ...baseDevice,
        lastActivityAt: new Date("2026-06-02T09:50:00Z"),
      },
      latestHeartbeatAt: new Date("2026-06-02T09:50:00Z"),
      latestOperationSnapshotAt: null,
      latestDailyRiskReportAt: null,
      latestCommandsPollAt: null,
      latestCommandAckAt: null,
      latestCanTradeAt: null,
      latestHealthCheck: healthCheck,
      now,
    });

    expect(result.computedStatus).toBe("ONLINE");
    expect(result.ageSeconds).toBeLessThanOrEqual(EA_LIVENESS_ONLINE_THRESHOLD_SEC);
  });
});
