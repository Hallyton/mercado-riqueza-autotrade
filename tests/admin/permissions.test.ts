import { describe, expect, it } from "vitest";
import {
  canDispatchAdminInstructions,
  canRunEmergencyActions,
  canRunStandardAdminActions,
} from "@/lib/admin/permissions";

describe("admin permissions", () => {
  it("allows emergency for SUPERADMIN and OPS only", () => {
    expect(canRunEmergencyActions("SUPERADMIN")).toBe(true);
    expect(canRunEmergencyActions("OPS")).toBe(true);
    expect(canRunEmergencyActions("SUPPORT")).toBe(false);
    expect(canRunEmergencyActions("CLIENT")).toBe(false);
  });

  it("allows standard admin actions for ops roles", () => {
    expect(canRunStandardAdminActions("FINANCE")).toBe(true);
    expect(canRunStandardAdminActions("STRATEGY_OPS")).toBe(false);
  });

  it("allows instruction dispatch for SUPERADMIN and OPS only", () => {
    expect(canDispatchAdminInstructions("SUPERADMIN")).toBe(true);
    expect(canDispatchAdminInstructions("OPS")).toBe(true);
    expect(canDispatchAdminInstructions("SUPPORT")).toBe(false);
    expect(canDispatchAdminInstructions("FINANCE")).toBe(false);
  });
});
