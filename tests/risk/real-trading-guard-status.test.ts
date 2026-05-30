import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    realTradingApproval: { count: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import {
  getRealTradingGuardAdminStatus,
  maskAccountLogin,
  maskLicenseId,
} from "@/lib/risk/real-trading-guard-status";

describe("Real Trading Guard admin status", () => {
  beforeEach(() => {
    vi.mocked(prisma.realTradingApproval.count).mockResolvedValue(0);
  });

  it("retorna status bloqueado com env vazio", async () => {
    const status = await getRealTradingGuardAdminStatus({});

    expect(status.realTradingEnabled).toBe(false);
    expect(status.enableRealTradingConfigured).toBe(false);
    expect(status.activeManualApprovalCount).toBe(0);
    expect(status.manualAllowlistConfigured).toBe(false);
    expect(status.defaultPolicy).toBe("BLOCK_REAL_BY_DEFAULT");
    expect(status.currentOperationalStatus).toBe("REAL_TRADING_BLOCKED");
  });

  it("master switch on sem approval manual mantém bloqueio operacional", async () => {
    const status = await getRealTradingGuardAdminStatus({
      ENABLE_REAL_TRADING: "true",
    });

    expect(status.realTradingEnabled).toBe(true);
    expect(status.activeManualApprovalCount).toBe(0);
    expect(status.currentOperationalStatus).toBe(
      "REAL_TRADING_MASTER_SWITCH_OPEN"
    );
  });

  it("conta aprovações manuais ativas", async () => {
    vi.mocked(prisma.realTradingApproval.count).mockResolvedValue(2);

    const status = await getRealTradingGuardAdminStatus({
      ENABLE_REAL_TRADING: "true",
    });

    expect(status.activeManualApprovalCount).toBe(2);
    expect(status.manualAllowlistConfigured).toBe(true);
    expect(status.currentOperationalStatus).toBe(
      "REAL_TRADING_PARTIALLY_ALLOWED_BY_MANUAL_APPROVAL"
    );
  });

  it("mascara licenseId e accountLogin", () => {
    expect(maskLicenseId("cmpj3wby70005sx18ot5e939p")).toBe("cmpj3w...939p");
    expect(maskAccountLogin("52609973")).toBe("***9973");
  });

  it("não retorna valores brutos das envs", async () => {
    const rawLicenseId = "cmpj3wby70005sx18ot5e939p";
    const status = await getRealTradingGuardAdminStatus({
      ENABLE_REAL_TRADING: "true",
      REAL_TRADING_ALLOWED_LICENSE_IDS: rawLicenseId,
    });
    const serialized = JSON.stringify(status);

    expect(serialized).not.toContain(rawLicenseId);
    expect(serialized).not.toContain("REAL_TRADING_ALLOWED_LICENSE_IDS");
    expect(serialized).not.toContain("ENABLE_REAL_TRADING");
  });
});
