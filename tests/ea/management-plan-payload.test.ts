import { describe, expect, it } from "vitest";
import {
  mapManagementPlanToEaPayload,
  parseManagementPlanFromInstruction,
} from "@/lib/ea/management-plan";
import { mapInstructionToEaPayload } from "@/lib/ea/instructions";
import { InstructionPurpose } from "@prisma/client";

const samplePlan = {
  version: 1 as const,
  initialStopLoss: 4999,
  takes: [
    { label: "T1" as const, enabled: true, price: 5001, quantity: 1 },
    { label: "T2" as const, enabled: false, price: null, quantity: 0 },
  ],
  breakEven: {
    enabled: true,
    trigger: "TAKE1_FILLED" as const,
    triggerPrice: null,
    offset: 0,
  },
  trailingStop: {
    enabled: false,
    triggerPrice: null,
    distance: null,
    step: null,
  },
};

describe("EA management plan payload", () => {
  it("serializa management_plan em snake_case", () => {
    const ea = mapManagementPlanToEaPayload(samplePlan);
    expect(ea.initial_stop_loss).toBe(4999);
    expect(ea.takes[0]?.label).toBe("T1");
    expect(ea.break_even.trigger).toBe("TAKE1_FILLED");
    expect(ea.trailing_stop.enabled).toBe(false);
  });

  it("mapInstructionToEaPayload inclui management_plan", () => {
    const payload = mapInstructionToEaPayload({
      id: "instr-1",
      purpose: InstructionPurpose.ENTRY,
      symbol: "WDON26",
      side: "BUY",
      orderType: "LIMIT",
      orderPrice: 5000,
      quantity: 1,
      stopLoss: 4999,
      takeProfit: 5001,
      expiresAt: new Date(),
      idempotencyKey: "key-1",
      managementPlan: samplePlan,
    });
    expect(payload.stop_loss_price).toBe(4999);
    expect(payload.take_profit_price).toBe(5001);
    expect(payload.management_plan?.initial_stop_loss).toBe(4999);
  });

  it("parseManagementPlanFromInstruction", () => {
    expect(parseManagementPlanFromInstruction(samplePlan)).toEqual(samplePlan);
  });
});
