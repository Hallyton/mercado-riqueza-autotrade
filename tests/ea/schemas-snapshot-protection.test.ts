import { describe, expect, it } from "vitest";
import {
  accountSnapshotBodySchema,
  executionProtectionBodySchema,
} from "@/lib/ea/schemas";

describe("accountSnapshotBodySchema", () => {
  const valid = {
    snapshot_type: "PRE_MARKET" as const,
    account_login: "12345",
    account_server: "Broker-Demo",
    environment: "REAL" as const,
    currency: "BRL",
    balance: 100000,
    equity: 100000,
    margin: 5000,
    free_margin: 95000,
    margin_level: 2000,
    open_positions: [{ symbol: "PETR4", quantity: 100 }],
    pending_orders: [],
    active_magic_numbers: [910001],
    captured_at: "2026-05-27T10:00:00Z",
  };

  it("aceita snapshot REAL PRE_MARKET válido", () => {
    const parsed = accountSnapshotBodySchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("aceita PRE_TRADE e POST_MARKET", () => {
    for (const snapshot_type of ["PRE_TRADE", "POST_MARKET", "MANUAL"] as const) {
      const parsed = accountSnapshotBodySchema.safeParse({
        ...valid,
        snapshot_type,
      });
      expect(parsed.success).toBe(true);
    }
  });

  it("rejeita snapshot_type inválido", () => {
    const parsed = accountSnapshotBodySchema.safeParse({
      ...valid,
      snapshot_type: "INTRADAY",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("executionProtectionBodySchema", () => {
  const base = {
    instruction_id: "inst-1",
    account_login: "12345",
    account_server: "Broker-Demo",
    symbol: "WDOM26",
    magic_number: 910001,
    stop_loss_present: true,
    take_profit_present: true,
    stop_loss_price: 100,
    take_profit_price: 110,
    protection_mode: "ATTACHED_SL_TP" as const,
    protection_status: "PROTECTION_CONFIRMED" as const,
    reported_at: "2026-05-27T10:05:00Z",
  };

  it("aceita proteção confirmada com SL/TP", () => {
    expect(executionProtectionBodySchema.safeParse(base).success).toBe(true);
  });

  it("aceita PROTECTION_FAILED com erro", () => {
    const parsed = executionProtectionBodySchema.safeParse({
      ...base,
      protection_status: "PROTECTION_FAILED",
      error_code: "ORDER_SEND_SL",
      error_message: "retcode=10016",
    });
    expect(parsed.success).toBe(true);
  });

  it("exige magic_number positivo", () => {
    const parsed = executionProtectionBodySchema.safeParse({
      ...base,
      magic_number: 0,
    });
    expect(parsed.success).toBe(false);
  });
});
