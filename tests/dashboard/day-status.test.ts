import { describe, expect, it } from "vitest";
import { resolveDayOperationalStatus } from "@/lib/dashboard/day-status";

describe("Status do dia", () => {
  it("prioriza EA offline", () => {
    expect(
      resolveDayOperationalStatus({
        eaOnline: false,
        riskBlocked: false,
        hasOpenPosition: true,
        hasArmedOrder: true,
        hadExecutionToday: true,
        canAcceptNewEntries: true,
      })
    ).toBe("ea_offline");
  });

  it("detecta posicionado", () => {
    expect(
      resolveDayOperationalStatus({
        eaOnline: true,
        riskBlocked: false,
        hasOpenPosition: true,
        hasArmedOrder: false,
        hadExecutionToday: false,
        canAcceptNewEntries: true,
      })
    ).toBe("positioned");
  });

  it("detecta ordem armada", () => {
    expect(
      resolveDayOperationalStatus({
        eaOnline: true,
        riskBlocked: false,
        hasOpenPosition: false,
        hasArmedOrder: true,
        hadExecutionToday: false,
        canAcceptNewEntries: true,
      })
    ).toBe("armed_order");
  });
});
