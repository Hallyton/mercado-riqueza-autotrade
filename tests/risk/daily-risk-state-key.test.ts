import { describe, expect, it } from "vitest";
import {
  classifyNearbyDailyRiskState,
  normalizeDailyRiskAccountLogin,
  normalizeDailyRiskSymbol,
  resolveDailyRiskStateKey,
  resolveOperationalTradeDate,
  tradeDateKeySaoPaulo,
} from "@/lib/risk/daily-risk-state-key";

describe("daily-risk-state-key", () => {
  it("normalizes account login as string", () => {
    expect(normalizeDailyRiskAccountLogin(19583778)).toBe("19583778");
    expect(normalizeDailyRiskAccountLogin(" 19583778 ")).toBe("19583778");
  });

  it("normalizes symbol uppercase", () => {
    expect(normalizeDailyRiskSymbol("wdon26")).toBe("WDON26");
  });

  it("normalizes strategy alias to MR_FIBO_D1_GUARD", () => {
    const resolved = resolveDailyRiskStateKey({
      licenseId: "lic1",
      accountLogin: "19583778",
      accountServer: "XPMT5-PRD",
      symbol: "WDON26",
      strategyCode: "fibo-d1-guard",
      tradeDateFromEa: "2026-06-06",
    });

    expect(resolved.effectiveKey.strategyCode).toBe("MR_FIBO_D1_GUARD");
    expect(resolved.received.strategyCodeNormalized).toBe("MR_FIBO_D1_GUARD");
  });

  it("flags tradeDate mismatch against America/Sao_Paulo operational date", () => {
    const operational = tradeDateKeySaoPaulo(new Date("2026-06-06T03:00:00Z"));
    const resolved = resolveOperationalTradeDate({
      tradeDateFromEa: "2026-06-05",
      now: new Date("2026-06-06T03:00:00Z"),
    });

    expect(resolved.operationalTradeDate).toBe(operational);
    expect(resolved.tradeDateMismatch).toBe(true);
  });

  it("uses operational tradeDate in effective key even when EA sends different date", () => {
    const resolved = resolveDailyRiskStateKey({
      licenseId: "lic1",
      accountLogin: "19583778",
      accountServer: "XPMT5-PRD",
      symbol: "WDON26",
      strategyCode: "MR_FIBO_D1_GUARD",
      tradeDateFromEa: "2026-06-05",
    });

    expect(resolved.effectiveKey.tradeDate).toBe(
      resolveOperationalTradeDate({ tradeDateFromEa: "2026-06-05" }).operationalTradeDate
    );
    expect(resolved.received.tradeDateMismatch).toBe(true);
  });

  it("classifies nearby trade date mismatch", () => {
    const expected = resolveDailyRiskStateKey({
      licenseId: "lic1",
      accountLogin: "19583778",
      accountServer: "XPMT5-PRD",
      symbol: "WDON26",
      strategyCode: "MR_FIBO_D1_GUARD",
    }).effectiveKey;

    const nearby = {
      ...expected,
      tradeDate: "2026-06-05",
    };

    expect(classifyNearbyDailyRiskState(expected, nearby)).toBe(
      "DAILY_RISK_STATE_TRADE_DATE_MISMATCH"
    );
  });
});
