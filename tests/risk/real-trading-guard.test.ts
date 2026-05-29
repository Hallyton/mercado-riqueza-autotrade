import { describe, expect, it } from "vitest";
import { TradeMode } from "@prisma/client";
import {
  evaluateRealTradingGuard,
  isLicenseAllowedForRealTrading,
  isRealTradingEnabled,
} from "@/lib/risk/real-trading-guard";
import { REAL_TRADING_REASONS } from "@/lib/risk/real-trading-reasons";
import {
  REAL_TRADING_GUARD_DIAGNOSTIC_SCENARIOS,
  runRealTradingGuardDiagnostics,
} from "@/scripts/risk/diagnose-real-trading-guard";

describe("Real Trading Guard", () => {
  it("bloqueia REAL por padrão quando ENABLE_REAL_TRADING está ausente", () => {
    const decision = evaluateRealTradingGuard(
      { tradeMode: TradeMode.REAL, licenseId: "lic-1" },
      {}
    );

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.code).toBe(REAL_TRADING_REASONS.ENV_NOT_ENABLED);
    }
  });

  it("permite DEMO sem feature flag futura", () => {
    const decision = evaluateRealTradingGuard(
      { tradeMode: TradeMode.DEMO, licenseId: "lic-1" },
      {}
    );

    expect(decision.allowed).toBe(true);
  });

  it("feature flag futura não libera REAL sem allowlist", () => {
    const decision = evaluateRealTradingGuard(
      { tradeMode: TradeMode.REAL, licenseId: "lic-out" },
      { ENABLE_REAL_TRADING: "true", REAL_TRADING_ALLOWED_LICENSE_IDS: "lic-in" }
    );

    expect(isRealTradingEnabled({ ENABLE_REAL_TRADING: "true" })).toBe(true);
    expect(decision.allowed).toBe(false);
  });

  it("feature flag futura com allowlist permite tecnicamente a avaliação do guard", () => {
    const env = {
      ENABLE_REAL_TRADING: "true",
      REAL_TRADING_ALLOWED_LICENSE_IDS: "lic-a, lic-b",
    };
    const decision = evaluateRealTradingGuard(
      { tradeMode: TradeMode.REAL, licenseId: "lic-b" },
      env
    );

    expect(isLicenseAllowedForRealTrading("lic-b", env)).toBe(true);
    expect(decision.allowed).toBe(true);
  });

  it("harness diagnóstico cobre todos os cenários obrigatórios sem falhas", () => {
    const results = runRealTradingGuardDiagnostics();

    expect(results).toHaveLength(REAL_TRADING_GUARD_DIAGNOSTIC_SCENARIOS.length);
    expect(results.every((result) => result.status === "PASS")).toBe(true);
    expect(results.map((result) => result.name)).toEqual([
      "A) DEMO sem env",
      "B) REAL sem env",
      "C) REAL com ENABLE_REAL_TRADING=false",
      "D) REAL com ENABLE_REAL_TRADING=true sem allowlist",
      "E) REAL com allowlist sem a licença",
      "F) REAL com allowlist contendo a licença",
      "G) tradeMode ausente",
      "G2) tradeMode desconhecido",
    ]);
  });
});
