import { beforeEach, describe, expect, it, vi } from "vitest";
import { DailyFinancialRiskStatus } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  dailyFinancialRiskLimit: { findMany: vi.fn() },
  dailyFinancialRiskState: { findUnique: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  eAOperationalSnapshot: { findFirst: vi.fn() },
  eaHeartbeat: { findFirst: vi.fn() },
  device: { findFirst: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

vi.mock("@/lib/ea/status", () => ({
  isEaOffline: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/risk/daily-financial-risk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/risk/daily-financial-risk")>();
  return {
    ...actual,
    tradeDateKeySaoPaulo: vi.fn().mockReturnValue("2026-06-07"),
  };
});

import {
  buildDailyRiskFullTraceView,
  resolveDailyRiskTraceDiagnosis,
} from "@/lib/admin/daily-risk-state-trace";

describe("daily risk full trace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.dailyFinancialRiskLimit.findMany.mockResolvedValue([
      {
        id: "limit1",
        licenseId: "lic1",
        accountLogin: "123",
        accountServer: "XPMT5-PRD",
        symbol: "WDON26",
        strategyCode: "MR_FIBO_D1_GUARD",
        enabled: true,
        dailyLossLimitCents: 50000,
        includeOpenPnL: true,
        resetTimezone: "America/Sao_Paulo",
        resetAtTime: "00:00",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    prismaMock.dailyFinancialRiskState.findUnique.mockResolvedValue({
      id: "state1",
      licenseId: "lic1",
      accountLogin: "123",
      accountServer: "XPMT5-PRD",
      symbol: "WDON26",
      strategyCode: "MR_FIBO_D1_GUARD",
      tradeDate: "2026-06-07",
      lastUpdatedAt: new Date(Date.now() - 25 * 60 * 1000),
      realizedPnlCents: 0,
      openPnlCents: 0,
      totalPnlCents: 0,
      remainingLossCents: 40000,
      status: DailyFinancialRiskStatus.OK,
    });
    prismaMock.dailyFinancialRiskState.findMany.mockResolvedValue([]);
    prismaMock.eAOperationalSnapshot.findFirst.mockResolvedValue({
      id: "snap1",
      updatedAt: new Date(),
      lastHeartbeatAt: new Date(),
      rawSnapshotJson: {
        last_daily_risk_sent_at: "2026.06.07 08:26:22",
        last_daily_risk_status: "OK",
        last_daily_risk_state_id: "state1",
      },
    });
    prismaMock.eaHeartbeat.findFirst.mockResolvedValue({
      receivedAt: new Date(),
      reportPayload: { ea_status: "ONLINE" },
    });
    prismaMock.device.findFirst.mockResolvedValue({
      lastSeenAt: new Date(),
    });
  });

  it("returns stale trace with snapshot daily risk telemetry", async () => {
    const trace = await buildDailyRiskFullTraceView({ licenseId: "lic1" });
    expect(trace?.diagnosis).toBe("DAILY_RISK_EA_ONLINE_BUT_NOT_REPORTING");
    expect(trace?.reportTrace.reportStatus).toBe("STALE");
    expect(trace?.latestOperationSnapshot?.lastDailyRiskSentAtFromSnapshot).toBe(
      "2026.06.07 08:26:22"
    );
    expect(trace?.staleThresholdSeconds).toBe(1200);
  });

  it("returns fresh diagnosis for recent state", () => {
    expect(
      resolveDailyRiskTraceDiagnosis({
        exactState: {
          tradeDate: "2026-06-07",
          lastUpdatedAt: new Date(),
        } as never,
        tradeDate: "2026-06-07",
        eaOnline: true,
        lastDailyRiskStatusFromSnapshot: "OK",
        lastDailyRiskErrorCodeFromSnapshot: null,
      })
    ).toBe("DAILY_RISK_STATE_FOUND_FRESH");
  });
});
