import { describe, expect, it } from "vitest";
import { validateRealManualOrderFields } from "@/lib/admin/real-manual-dispatch-validation";

describe("validateRealManualOrderFields", () => {
  it("MARKET aceita sem orderPrice com SL/TP", () => {
    expect(
      validateRealManualOrderFields({
        orderType: "MARKET",
        stopLossPrice: 5643.5,
        takeProfitPrice: 5660.5,
      })
    ).toBeNull();
  });

  it("MARKET bloqueia orderPrice", () => {
    expect(
      validateRealManualOrderFields({
        orderType: "MARKET",
        orderPrice: 5650,
        stopLossPrice: 5643.5,
        takeProfitPrice: 5660.5,
      })?.code
    ).toBe("ORDER_PRICE_NOT_ALLOWED_FOR_MARKET");
  });

  it("LIMIT exige orderPrice, SL e TP", () => {
    expect(
      validateRealManualOrderFields({
        orderType: "LIMIT",
        stopLossPrice: 5643.5,
        takeProfitPrice: 5660.5,
      })?.code
    ).toBe("ORDER_PRICE_REQUIRED_FOR_PENDING_ORDER");

    expect(
      validateRealManualOrderFields({
        orderType: "LIMIT",
        orderPrice: 5650.5,
        stopLossPrice: 5643.5,
        takeProfitPrice: 5660.5,
      })
    ).toBeNull();
  });

  it("bloqueia sem stopLossPrice", () => {
    expect(
      validateRealManualOrderFields({
        orderType: "MARKET",
        takeProfitPrice: 5660.5,
      })?.code
    ).toBe("STOP_LOSS_REQUIRED");
  });

  it("bloqueia sem takeProfitPrice", () => {
    expect(
      validateRealManualOrderFields({
        orderType: "MARKET",
        stopLossPrice: 5643.5,
      })?.code
    ).toBe("TAKE_PROFIT_REQUIRED");
  });

  it("bloqueia preços inválidos", () => {
    expect(
      validateRealManualOrderFields({
        orderType: "STOP",
        orderPrice: -1,
        stopLossPrice: 5643.5,
        takeProfitPrice: 5660.5,
      })?.code
    ).toBe("ORDER_PRICE_INVALID");

    expect(
      validateRealManualOrderFields({
        orderType: "MARKET",
        stopLossPrice: 0,
        takeProfitPrice: 5660.5,
      })?.code
    ).toBe("STOP_LOSS_INVALID");
  });
});
