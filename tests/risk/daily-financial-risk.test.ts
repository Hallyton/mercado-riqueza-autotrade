import { describe, expect, it } from "vitest";
import {
  computeTotalPnlCents,
  evaluateDailyRiskStatus,
  tradeDateKeySaoPaulo,
} from "@/lib/risk/daily-financial-risk";
import { DailyFinancialRiskStatus } from "@prisma/client";

describe("daily-financial-risk", () => {
  it("computeTotalPnlCents respects includeOpenPnL", () => {
    expect(
      computeTotalPnlCents({
        realizedPnlCents: -10000,
        openPnlCents: -5000,
        includeOpenPnL: true,
      })
    ).toBe(-15000);
    expect(
      computeTotalPnlCents({
        realizedPnlCents: -10000,
        openPnlCents: -5000,
        includeOpenPnL: false,
      })
    ).toBe(-10000);
  });

  it("evaluateDailyRiskStatus blocks at limit", () => {
    const blocked = evaluateDailyRiskStatus({
      totalPnlCents: -30000,
      limitCents: 30000,
    });
    expect(blocked.status).toBe(DailyFinancialRiskStatus.BLOCKED);
    expect(blocked.remainingLossCents).toBe(0);

    const ok = evaluateDailyRiskStatus({
      totalPnlCents: -10000,
      limitCents: 30000,
    });
    expect(ok.status).toBe(DailyFinancialRiskStatus.OK);
    expect(ok.remainingLossCents).toBe(20000);
  });

  it("tradeDateKeySaoPaulo returns YYYY-MM-DD", () => {
    const key = tradeDateKeySaoPaulo(new Date("2026-06-02T15:00:00Z"));
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
