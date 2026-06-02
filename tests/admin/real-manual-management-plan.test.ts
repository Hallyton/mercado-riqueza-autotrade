import { describe, expect, it } from "vitest";
import {
  createDefaultManagementPlan,
  deriveLegacyPricesFromPlan,
  validateManagementPlan,
} from "@/lib/admin/real-manual-management-plan";

function validPlan() {
  const plan = createDefaultManagementPlan();
  plan.initialStopLoss = 4999;
  plan.takes[0] = { label: "T1", enabled: true, price: 5001, quantity: 1 };
  plan.takes[1] = { label: "T2", enabled: false, price: null, quantity: 0 };
  return plan;
}

describe("real manual management plan", () => {
  it("exige initialStopLoss", () => {
    const plan = validPlan();
    plan.initialStopLoss = 0;
    expect(
      validateManagementPlan({ plan, requestedContracts: 1, side: "BUY", entryPrice: 5000 })
        ?.code
    ).toBe("INITIAL_STOP_LOSS_REQUIRED");
  });

  it("aceita T1 ativo", () => {
    expect(
      validateManagementPlan({
        plan: validPlan(),
        requestedContracts: 1,
        side: "BUY",
        entryPrice: 5000,
      })
    ).toBeNull();
  });

  it("aceita T1+T2 quando quantity total <= requestedContracts", () => {
    const plan = validPlan();
    plan.takes[1] = { label: "T2", enabled: true, price: 5003, quantity: 1 };
    expect(
      validateManagementPlan({
        plan,
        requestedContracts: 2,
        side: "BUY",
        entryPrice: 5000,
      })
    ).toBeNull();
  });

  it("bloqueia T1+T2 com requestedContracts=1", () => {
    const plan = validPlan();
    plan.takes[1] = { label: "T2", enabled: true, price: 5003, quantity: 1 };
    expect(
      validateManagementPlan({
        plan,
        requestedContracts: 1,
        side: "BUY",
        entryPrice: 5000,
      })?.code
    ).toBe("TAKE_SPLIT_NOT_AVAILABLE_FOR_ONE_CONTRACT");
  });

  it("bloqueia take sem preço", () => {
    const plan = validPlan();
    plan.takes[0].price = null;
    expect(
      validateManagementPlan({ plan, requestedContracts: 1, side: "BUY" })?.code
    ).toBe("TAKE1_PRICE_REQUIRED");
  });

  it("bloqueia take sem quantidade", () => {
    const plan = validPlan();
    plan.takes[0].quantity = 0;
    expect(
      validateManagementPlan({ plan, requestedContracts: 1, side: "BUY" })?.code
    ).toBe("TAKE1_QUANTITY_REQUIRED");
  });

  it("bloqueia TS sem trigger/distance/step", () => {
    const plan = validPlan();
    plan.trailingStop.enabled = true;
    expect(
      validateManagementPlan({ plan, requestedContracts: 1, side: "BUY" })?.code
    ).toBe("TRAILING_TRIGGER_PRICE_REQUIRED");

    plan.trailingStop.triggerPrice = 5002;
    expect(
      validateManagementPlan({ plan, requestedContracts: 1, side: "BUY" })?.code
    ).toBe("TRAILING_DISTANCE_REQUIRED");

    plan.trailingStop.distance = 1;
    expect(
      validateManagementPlan({ plan, requestedContracts: 1, side: "BUY" })?.code
    ).toBe("TRAILING_STEP_REQUIRED");
  });

  it("bloqueia BE PRICE_REACHED sem triggerPrice", () => {
    const plan = validPlan();
    plan.breakEven.enabled = true;
    plan.breakEven.trigger = "PRICE_REACHED";
    expect(
      validateManagementPlan({ plan, requestedContracts: 1, side: "BUY" })?.code
    ).toBe("BREAKEVEN_TRIGGER_PRICE_REQUIRED");
  });

  it("deriveLegacyPricesFromPlan mapeia SL e T1", () => {
    const legacy = deriveLegacyPricesFromPlan(validPlan());
    expect(legacy.stopLossPrice).toBe(4999);
    expect(legacy.takeProfitPrice).toBe(5001);
  });
});
