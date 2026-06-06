import { beforeEach, describe, expect, it, vi } from "vitest";
import { DailyFinancialRiskStatus } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  dailyFinancialRiskLimit: { findMany: vi.fn(), findUnique: vi.fn() },
  dailyFinancialRiskState: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  instrumentPointValue: { findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import {
  evaluateDailyFinancialStopForEntry,
  processDailyRiskReport,
} from "@/lib/risk/daily-financial-risk";

const baseInput = {
  licenseId: "lic1",
  accountLogin: "19583778",
  accountServer: "XPMT5-PRD",
  strategyCode: "MR_FIBO_D1_GUARD",
  symbol: "WDON26",
  requestedContracts: 1,
  stopPoints: 100,
  requiresDailyStop: true,
};

describe("evaluateDailyFinancialStopForEntry report linkage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.dailyFinancialRiskLimit.findUnique.mockResolvedValue({
      id: "limit1",
      licenseId: "lic1",
      accountLogin: "19583778",
      accountServer: "XPMT5-PRD",
      symbol: "WDON26",
      strategyCode: "MR_FIBO_D1_GUARD",
      enabled: true,
      dailyLossLimitCents: 40000,
      includeOpenPnL: true,
    });
    prismaMock.dailyFinancialRiskLimit.findMany.mockResolvedValue([]);
    prismaMock.instrumentPointValue.findUnique.mockResolvedValue({
      centsPerPointPerContract: 1000,
    });
  });

  it("returns DAILY_RISK_REPORT_MISSING when limit exists but state is absent", async () => {
    prismaMock.dailyFinancialRiskState.findUnique.mockResolvedValue(null);

    const result = await evaluateDailyFinancialStopForEntry(baseInput);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasonCode).toBe("DAILY_RISK_REPORT_MISSING");
    expect(result.detail).toContain("DailyFinancialRiskLimit está configurado");
    expect(result.detail).not.toContain("não configurado");
  });

  it("returns DAILY_RISK_REPORT_STALE when state is outdated", async () => {
    prismaMock.dailyFinancialRiskState.findUnique.mockResolvedValue({
      tradeDate: "2026-06-02",
      lastUpdatedAt: new Date(Date.now() - 25 * 60 * 1000),
      realizedPnlCents: 0,
      openPnlCents: 0,
      totalPnlCents: 0,
      remainingLossCents: 40000,
      status: DailyFinancialRiskStatus.OK,
    });

    const result = await evaluateDailyFinancialStopForEntry(baseInput);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasonCode).toBe("DAILY_RISK_REPORT_STALE");
  });

  it("returns ok when recent state exists", async () => {
    prismaMock.dailyFinancialRiskState.findUnique.mockResolvedValue({
      tradeDate: "2026-06-02",
      lastUpdatedAt: new Date(),
      realizedPnlCents: 0,
      openPnlCents: 0,
      totalPnlCents: 0,
      remainingLossCents: 40000,
      status: DailyFinancialRiskStatus.OK,
    });
    prismaMock.instrumentPointValue.findUnique.mockResolvedValue(null);

    const result = await evaluateDailyFinancialStopForEntry(baseInput);
    expect(result.ok).toBe(true);
  });

  it("returns DAILY_FINANCIAL_STOP_NOT_CONFIGURED when limit disabled", async () => {
    prismaMock.dailyFinancialRiskLimit.findUnique.mockResolvedValue({
      id: "limit1",
      licenseId: "lic1",
      accountLogin: "19583778",
      accountServer: "XPMT5-PRD",
      symbol: "WDON26",
      strategyCode: "MR_FIBO_D1_GUARD",
      enabled: false,
      dailyLossLimitCents: 40000,
      includeOpenPnL: true,
    });

    const result = await evaluateDailyFinancialStopForEntry(baseInput);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasonCode).toBe("DAILY_FINANCIAL_STOP_NOT_CONFIGURED");
  });
});

describe("processDailyRiskReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.dailyFinancialRiskLimit.findUnique.mockResolvedValue({
      enabled: true,
      dailyLossLimitCents: 40000,
      includeOpenPnL: true,
    });
    prismaMock.dailyFinancialRiskState.upsert.mockResolvedValue({
      tradeDate: "2026-06-02",
      status: DailyFinancialRiskStatus.OK,
      realizedPnlCents: 0,
      openPnlCents: 0,
      totalPnlCents: 0,
      remainingLossCents: 40000,
      limitCents: 40000,
      lastUpdatedAt: new Date(),
    });
  });

  it("accepts zero pnl and normalizes strategy alias", async () => {
    const state = await processDailyRiskReport({
      licenseId: "lic1",
      accountLogin: "19583778",
      accountServer: "XPMT5-PRD",
      strategyCode: "fibo-d1-guard",
      symbol: "WDON26",
      tradeDate: "2026-06-02",
      realizedPnl: 0,
      openPnl: 0,
    });

    expect(prismaMock.dailyFinancialRiskLimit.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          licenseId_accountLogin_accountServer_strategyCode_symbol:
            expect.objectContaining({
              strategyCode: "MR_FIBO_D1_GUARD",
            }),
        }),
      })
    );
    expect(prismaMock.dailyFinancialRiskState.upsert).toHaveBeenCalled();
    expect(state.realizedPnlCents).toBe(0);
    expect(state.openPnlCents).toBe(0);
  });
});
