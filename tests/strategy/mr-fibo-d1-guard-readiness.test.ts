import { describe, expect, it } from "vitest";
import {
  analyzeStrategyConfigReadiness,
  applyLoteTotalToApprovedMax,
  computeEstimatedStopRiskBrl,
  LOT_TOTAL_EXCEEDS_MAX_CONTRACTS,
} from "@/lib/strategy/mr-fibo-d1-guard-readiness";
import { buildDefaultMrFiboD1GuardConfig } from "@/lib/strategy/mr-fibo-d1-guard-config";

describe("mr-fibo-d1-guard-readiness", () => {
  it("computes estimated stop risk with InstrumentPointValue", () => {
    const risk = computeEstimatedStopRiskBrl({
      contracts: 5,
      stopPoints: 7,
      pointValueBrl: 10,
    });
    expect(risk).toBe(350);
  });

  it("flags LOT_TOTAL_EXCEEDS_MAX_CONTRACTS when loteTotal exceeds approval", () => {
    const cfg = buildDefaultMrFiboD1GuardConfig();
    const result = analyzeStrategyConfigReadiness(cfg, {
      maxContracts: 1,
      pointValueBrl: 10,
      dailyLossLimitCents: 50000,
      dailyRiskEnabled: true,
      remainingLossBrl: 500,
      requiresDailyFinancialStop: true,
    });

    expect(result.contractLimit.exceedsLimit).toBe(true);
    expect(result.contractLimit.contractsToRelease).toBe(4);
    expect(result.canPublish).toBe(false);
    expect(result.issues.some((i) => i.code === LOT_TOTAL_EXCEEDS_MAX_CONTRACTS)).toBe(
      true
    );
  });

  it("blocks publish when estimated risk exceeds remaining daily stop", () => {
    const cfg = buildDefaultMrFiboD1GuardConfig();
    cfg.risk.loteTotal = 1;
    const result = analyzeStrategyConfigReadiness(cfg, {
      maxContracts: 5,
      pointValueBrl: 10,
      dailyLossLimitCents: 5000,
      dailyRiskEnabled: true,
      remainingLossBrl: 50,
      requiresDailyFinancialStop: true,
    });

    expect(result.canPublish).toBe(false);
    expect(result.estimatedRisk.estimatedRiskBrl).toBe(70);
    expect(result.estimatedRisk.dailyRiskStatus).toBe("EXCEEDS_DAILY_STOP");
  });

  it("applyLoteTotalToApprovedMax reduces only loteTotal locally", () => {
    const cfg = buildDefaultMrFiboD1GuardConfig();
    const next = applyLoteTotalToApprovedMax(cfg, 1);
    expect(next.risk.loteTotal).toBe(1);
    expect(cfg.risk.loteTotal).toBe(5);
  });
});
