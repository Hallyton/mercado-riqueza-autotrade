import { describe, expect, it } from "vitest";
import { DailyFinancialRiskStatus } from "@prisma/client";
import {
  buildDailyRiskReportTrace,
  dailyRiskReportActionHint,
  dailyRiskReportOperationalMessage,
} from "@/lib/admin/daily-risk-report-trace";

describe("daily-risk-report-trace", () => {
  const tradeDate = "2026-06-02";

  it("returns MISSING when state is absent", () => {
    const trace = buildDailyRiskReportTrace(null, tradeDate);
    expect(trace.reportReceived).toBe(false);
    expect(trace.reportStatus).toBe("MISSING");
    expect(trace.lastReportAt).toBeNull();
  });

  it("returns STALE when lastUpdatedAt is older than threshold", () => {
    const staleAt = new Date(Date.now() - 25 * 60 * 1000);
    const trace = buildDailyRiskReportTrace(
      {
        tradeDate,
        lastUpdatedAt: staleAt,
        realizedPnlCents: 0,
        openPnlCents: 0,
        totalPnlCents: 0,
        remainingLossCents: 40000,
        status: DailyFinancialRiskStatus.OK,
      } as never,
      tradeDate
    );
    expect(trace.reportStatus).toBe("STALE");
    expect(trace.reportReceived).toBe(true);
  });

  it("returns OK for recent state", () => {
    const trace = buildDailyRiskReportTrace(
      {
        tradeDate,
        lastUpdatedAt: new Date(),
        realizedPnlCents: 0,
        openPnlCents: 0,
        totalPnlCents: 0,
        remainingLossCents: 40000,
        status: DailyFinancialRiskStatus.OK,
      } as never,
      tradeDate
    );
    expect(trace.reportStatus).toBe("OK");
    expect(trace.realizedPnlBrl).toBe(0);
    expect(trace.remainingLossBrl).toBe(400);
  });

  it("builds operational message for configured limit without report", () => {
    const message = dailyRiskReportOperationalMessage({
      limitConfigured: true,
      report: buildDailyRiskReportTrace(null, tradeDate),
    });
    expect(message).toContain("Stop diário configurado");
    expect(message).toContain("EA ainda não enviou");
  });

  it("suggests EA endpoint when report is missing", () => {
    expect(dailyRiskReportActionHint("MISSING")).toContain(
      "/api/v1/ea/daily-risk/report"
    );
  });
});
