import { describe, expect, it } from "vitest";
import { DailyFinancialRiskStatus } from "@prisma/client";
import {
  DAILY_RISK_POSITION_PENDING_THRESHOLD_SEC,
  evaluateDailyRiskFreshnessPolicy,
} from "@/lib/risk/daily-risk-freshness-policy";

const baseState = {
  id: "state1",
  licenseId: "lic1",
  accountLogin: "1",
  accountServer: "S",
  strategyCode: "MR_FIBO_D1_GUARD",
  symbol: "WDON26",
  tradeDate: "2026-06-07",
  realizedPnlCents: 0,
  openPnlCents: 0,
  totalPnlCents: 0,
  limitCents: 40000,
  remainingLossCents: 40000,
  status: DailyFinancialRiskStatus.OK,
  lastUpdatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
  lastReportReceivedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
  lastReportRequestId: "req1",
  lastReportSource: "EA",
  receivedTradeDate: "2026-06-07",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("evaluateDailyRiskFreshnessPolicy", () => {
  it("report do dia antigo em horas sem eventos => OK_FOR_DAY", () => {
    const result = evaluateDailyRiskFreshnessPolicy({
      tradeDate: "2026-06-07",
      riskLimit: { enabled: true },
      riskState: baseState,
      latestOperationSnapshot: {
        hasOpenPosition: false,
        pendingOrdersCount: 0,
        updatedAt: new Date(),
      },
      invalidation: {
        hasInvalidation: false,
        latestInvalidationAt: null,
        reasonCode: null,
        events: [],
      },
    });
    expect(result.status).toBe("OK_FOR_DAY");
    expect(result.reasonCode).toBe("DAILY_RISK_OK_FOR_DAY");
    expect(result.details.blocksEntry).toBe(false);
  });

  it("sem report => MISSING", () => {
    const result = evaluateDailyRiskFreshnessPolicy({
      tradeDate: "2026-06-07",
      riskLimit: { enabled: true },
      riskState: null,
      invalidation: {
        hasInvalidation: false,
        latestInvalidationAt: null,
        reasonCode: null,
        events: [],
      },
    });
    expect(result.status).toBe("MISSING");
    expect(result.reasonCode).toBe("DAILY_RISK_REPORT_MISSING");
  });

  it("posição aberta + idade > 180s => POSITION_RISK_REPORT_STALE", () => {
    const result = evaluateDailyRiskFreshnessPolicy({
      tradeDate: "2026-06-07",
      riskLimit: { enabled: true },
      riskState: baseState,
      latestOperationSnapshot: {
        hasOpenPosition: true,
        pendingOrdersCount: 0,
        updatedAt: new Date(),
      },
      invalidation: {
        hasInvalidation: false,
        latestInvalidationAt: null,
        reasonCode: null,
        events: [],
      },
    });
    expect(result.reasonCode).toBe("POSITION_RISK_REPORT_STALE");
    expect(result.details.ageSeconds).toBeGreaterThan(
      DAILY_RISK_POSITION_PENDING_THRESHOLD_SEC
    );
  });

  it("pendentes + idade > 180s => PENDING_ORDERS_RISK_REPORT_STALE", () => {
    const result = evaluateDailyRiskFreshnessPolicy({
      tradeDate: "2026-06-07",
      riskLimit: { enabled: true },
      riskState: baseState,
      latestOperationSnapshot: {
        hasOpenPosition: false,
        pendingOrdersCount: 2,
        updatedAt: new Date(),
      },
      invalidation: {
        hasInvalidation: false,
        latestInvalidationAt: null,
        reasonCode: null,
        events: [],
      },
    });
    expect(result.reasonCode).toBe("PENDING_ORDERS_RISK_REPORT_STALE");
  });

  it("execução após report => REVALIDATION_REQUIRED_AFTER_TRADE", () => {
    const result = evaluateDailyRiskFreshnessPolicy({
      tradeDate: "2026-06-07",
      riskLimit: { enabled: true },
      riskState: baseState,
      latestOperationSnapshot: {
        hasOpenPosition: false,
        pendingOrdersCount: 0,
        updatedAt: new Date(),
      },
      invalidation: {
        hasInvalidation: true,
        latestInvalidationAt: new Date(),
        reasonCode: "DAILY_RISK_REVALIDATION_REQUIRED_AFTER_TRADE",
        events: [
          {
            at: new Date().toISOString(),
            reasonCode: "DAILY_RISK_REVALIDATION_REQUIRED_AFTER_TRADE",
            source: "execution",
          },
        ],
      },
    });
    expect(result.status).toBe("REVALIDATION_REQUIRED");
    expect(result.reasonCode).toBe("DAILY_RISK_REVALIDATION_REQUIRED_AFTER_TRADE");
  });

  it("alteração admin após report => REVALIDATION_REQUIRED_AFTER_ADMIN_CHANGE", () => {
    const result = evaluateDailyRiskFreshnessPolicy({
      tradeDate: "2026-06-07",
      riskLimit: { enabled: true },
      riskState: baseState,
      invalidation: {
        hasInvalidation: true,
        latestInvalidationAt: new Date(),
        reasonCode: "DAILY_RISK_REVALIDATION_REQUIRED_AFTER_ADMIN_CHANGE",
        events: [
          {
            at: new Date().toISOString(),
            reasonCode: "DAILY_RISK_REVALIDATION_REQUIRED_AFTER_ADMIN_CHANGE",
            source: "daily_risk.limit.updated",
          },
        ],
      },
    });
    expect(result.reasonCode).toBe(
      "DAILY_RISK_REVALIDATION_REQUIRED_AFTER_ADMIN_CHANGE"
    );
  });
});
