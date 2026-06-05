import { describe, expect, it } from "vitest";
import {
  buildDefaultMrFiboD1GuardConfig,
  toEaMrFiboD1GuardStrategyConfig,
  validateMrFiboD1GuardConfigWithContext,
} from "@/lib/strategy/mr-fibo-d1-guard-config";
import { hashMrFiboD1GuardConfig } from "@/lib/strategy/mr-fibo-d1-guard-config-hash";

describe("mr-fibo-d1-guard-config", () => {
  it("validates default config", () => {
    const cfg = buildDefaultMrFiboD1GuardConfig();
    const result = validateMrFiboD1GuardConfigWithContext(cfg, { maxContracts: 10 });
    expect(result.success).toBe(true);
  });

  it("blocks loteTotal above maxContracts", () => {
    const cfg = buildDefaultMrFiboD1GuardConfig();
    cfg.risk.loteTotal = 20;
    const result = validateMrFiboD1GuardConfigWithContext(cfg, { maxContracts: 5 });
    expect(result.success).toBe(false);
  });

  it("blocks incoherent partials", () => {
    const cfg = buildDefaultMrFiboD1GuardConfig();
    cfg.partialsAndTrailing.loteAlvo1 = 10;
    const result = validateMrFiboD1GuardConfigWithContext(cfg, { maxContracts: 20 });
    expect(result.success).toBe(false);
  });

  it("blocks invalid hours", () => {
    const cfg = buildDefaultMrFiboD1GuardConfig();
    cfg.operationalHours.horarioInicio = "18:00";
    cfg.operationalHours.horarioFimEntradas = "09:00";
    const result = validateMrFiboD1GuardConfigWithContext(cfg);
    expect(result.success).toBe(false);
  });

  it("blocks invalid stop", () => {
    const cfg = buildDefaultMrFiboD1GuardConfig();
    cfg.risk.stopPontos = 0;
    const result = validateMrFiboD1GuardConfigWithContext(cfg);
    expect(result.success).toBe(false);
  });

  it("produces stable hash and EA payload", () => {
    const cfg = buildDefaultMrFiboD1GuardConfig();
    const hash = hashMrFiboD1GuardConfig(cfg);
    expect(hash).toHaveLength(64);
    const ea = toEaMrFiboD1GuardStrategyConfig(cfg);
    expect(ea.risk.lote_total).toBe(5);
    expect(ea.fibo_d1.percentual_fibo).toBe(0.2);
    expect(ea.operational_hours.horario_inicio).toBe("09:15");
  });
});
