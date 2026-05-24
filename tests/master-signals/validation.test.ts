import { describe, expect, it } from "vitest";
import { masterSignalInputSchema } from "@/lib/master-signals/schemas";
import { redactMasterSignalPayload, validateMasterSignalPayload } from "@/lib/master-signals/service";

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    master_signal_id: "msig-001",
    source: "MASTER_EA",
    symbol: "WDOM26",
    side: "BUY",
    order_type: "MARKET",
    purpose: "ENTRY",
    profile: " START ",
    expires_in_seconds: 60,
    idempotency_key: "idem-001",
    ...overrides,
  };
}

describe("master signal validation", () => {
  it("1) aceita payload válido de MASTER_EA", () => {
    const result = validateMasterSignalPayload(validPayload());
    expect(result.source).toBe("MASTER_EA");
    expect(result.masterSignalId).toBe("msig-001");
  });

  it("2) aceita source ADMIN_TEST", () => {
    const parsed = masterSignalInputSchema.safeParse(validPayload({ source: "ADMIN_TEST" }));
    expect(parsed.success).toBe(true);
  });

  it("3) aceita source SIMULATOR", () => {
    const parsed = masterSignalInputSchema.safeParse(validPayload({ source: "SIMULATOR" }));
    expect(parsed.success).toBe(true);
  });

  it("4) rejeita master_signal_id vazio", () => {
    const parsed = masterSignalInputSchema.safeParse(validPayload({ master_signal_id: "   " }));
    expect(parsed.success).toBe(false);
  });

  it("5) rejeita idempotency_key vazio", () => {
    const parsed = masterSignalInputSchema.safeParse(validPayload({ idempotency_key: "" }));
    expect(parsed.success).toBe(false);
  });

  it("6) rejeita side inválido", () => {
    const parsed = masterSignalInputSchema.safeParse(validPayload({ side: "LONG" }));
    expect(parsed.success).toBe(false);
  });

  it("7) rejeita order_type inválido", () => {
    const parsed = masterSignalInputSchema.safeParse(validPayload({ order_type: "IOC" }));
    expect(parsed.success).toBe(false);
  });

  it("8) rejeita purpose inválido", () => {
    const parsed = masterSignalInputSchema.safeParse(validPayload({ purpose: "SCALE_IN" }));
    expect(parsed.success).toBe(false);
  });

  it("9) rejeita symbol vazio", () => {
    const parsed = masterSignalInputSchema.safeParse(validPayload({ symbol: "   " }));
    expect(parsed.success).toBe(false);
  });

  it("10) rejeita expires_in_seconds muito baixo", () => {
    const parsed = masterSignalInputSchema.safeParse(validPayload({ expires_in_seconds: 1 }));
    expect(parsed.success).toBe(false);
  });

  it("11) rejeita expires_in_seconds muito alto", () => {
    const parsed = masterSignalInputSchema.safeParse(validPayload({ expires_in_seconds: 9999 }));
    expect(parsed.success).toBe(false);
  });

  it("12) normaliza profile para profileSlug", () => {
    const result = validateMasterSignalPayload(validPayload({ profile: " START " }));
    expect(result.profileSlug).toBe("start");
  });

  it("13) remove/mascara campos sensíveis de rawPayloadRedacted", () => {
    const redacted = redactMasterSignalPayload({
      symbol: "WDOM26",
      nested: { strategy_config: { a: 1 }, indicator_params: { period: 14 } },
    });

    expect(redacted).toEqual({
      symbol: "WDOM26",
      nested: {},
    });
  });

  it("14) não inclui token/secret no rawPayloadRedacted", () => {
    const redacted = redactMasterSignalPayload({
      token: "abc",
      api_secret: "xyz",
      keep: 1,
    });
    expect(redacted).toEqual({ keep: 1 });
    expect(JSON.stringify(redacted)).not.toContain("token");
    expect(JSON.stringify(redacted)).not.toContain("secret");
  });

  it("15) não expõe estratégia no payload normalizado", () => {
    const result = validateMasterSignalPayload(validPayload({ symbol: "wdom26" }));
    expect(result.symbol).toBe("WDOM26");
    expect(result).not.toHaveProperty("strategy");
    expect(Object.keys(result.rawPayloadRedacted)).not.toContain("strategy");
  });

  it("rejeita payload com campo estratégico sensível", () => {
    const parsed = masterSignalInputSchema.safeParse(
      validPayload({
        strategy_config: { internal_filter: "x" },
      })
    );
    expect(parsed.success).toBe(false);
  });
});
