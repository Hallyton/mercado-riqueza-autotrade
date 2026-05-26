import { describe, expect, it } from "vitest";
import {
  getRealTradingGuardAdminStatus,
  maskLicenseId,
} from "@/lib/risk/real-trading-guard-status";

describe("Real Trading Guard admin status", () => {
  it("retorna status bloqueado com env vazio", () => {
    const status = getRealTradingGuardAdminStatus({});

    expect(status.realTradingEnabled).toBe(false);
    expect(status.enableRealTradingConfigured).toBe(false);
    expect(status.allowedLicenseCount).toBe(0);
    expect(status.allowedLicenseIdsMasked).toEqual([]);
    expect(status.defaultPolicy).toBe("BLOCK_REAL_BY_DEFAULT");
    expect(status.demoAllowed).toBe(true);
    expect(status.realRequiresFlagAndAllowlist).toBe(true);
    expect(status.currentOperationalStatus).toBe("REAL_TRADING_BLOCKED");
  });

  it("mantém bloqueado com ENABLE_REAL_TRADING=true sem allowlist", () => {
    const status = getRealTradingGuardAdminStatus({
      ENABLE_REAL_TRADING: "true",
    });

    expect(status.realTradingEnabled).toBe(true);
    expect(status.enableRealTradingConfigured).toBe(true);
    expect(status.allowedLicenseCount).toBe(0);
    expect(status.currentOperationalStatus).toBe("REAL_TRADING_BLOCKED");
  });

  it("retorna parcialmente permitido quando flag e allowlist existem", () => {
    const status = getRealTradingGuardAdminStatus({
      ENABLE_REAL_TRADING: "true",
      REAL_TRADING_ALLOWED_LICENSE_IDS:
        "cmpj3wby70005sx18ot5e939p other-license-1234",
    });

    expect(status.realTradingEnabled).toBe(true);
    expect(status.allowedLicenseCount).toBe(2);
    expect(status.allowedLicenseIdsMasked).toEqual([
      "cmpj3w...939p",
      "other-...1234",
    ]);
    expect(status.currentOperationalStatus).toBe(
      "REAL_TRADING_PARTIALLY_ALLOWED_BY_ALLOWLIST"
    );
  });

  it("mascara licenseId sem expor valor completo", () => {
    expect(maskLicenseId("cmpj3wby70005sx18ot5e939p")).toBe("cmpj3w...939p");
    expect(maskLicenseId("abcd1234")).toBe("ab...34");
    expect(maskLicenseId("")).toBe("***");
  });

  it("não retorna valores brutos das envs", () => {
    const rawLicenseId = "cmpj3wby70005sx18ot5e939p";
    const status = getRealTradingGuardAdminStatus({
      ENABLE_REAL_TRADING: "true",
      REAL_TRADING_ALLOWED_LICENSE_IDS: rawLicenseId,
    });
    const serialized = JSON.stringify(status);

    expect(serialized).not.toContain(rawLicenseId);
    expect(serialized).not.toContain("REAL_TRADING_ALLOWED_LICENSE_IDS");
    expect(serialized).not.toContain("ENABLE_REAL_TRADING");
  });
});
