import { describe, expect, it } from "vitest";
import { DeviceStatus, TradeMode } from "@prisma/client";
import {
  computeDeviceCompatibility,
  computeLicenseOperationalStatus,
  validateLicenseExpectedActivation,
} from "@/lib/licensing/license-expected-mode";

describe("license expected mode", () => {
  const licenseReal = {
    expectedTradeMode: TradeMode.REAL,
    expectedAccountLogin: "4598526",
    expectedAccountServer: "BancoBTGPactual-PRD",
    expectedSymbol: null,
    expectedMagicNumber: null,
    mt5Account: { login: "4598526", server: "BancoBTGPactual-PRD" },
  };

  it("bloqueia ativação DEMO quando esperado REAL", () => {
    const r = validateLicenseExpectedActivation({
      license: licenseReal,
      accountLogin: "4598526",
      accountServer: "BancoBTGPactual-PRD",
      tradeMode: "DEMO",
    });
    expect(r).toEqual({
      ok: false,
      code: "LICENSE_EXPECTED_TRADE_MODE_MISMATCH",
    });
  });

  it("aceita ativação REAL com conta esperada", () => {
    const r = validateLicenseExpectedActivation({
      license: licenseReal,
      accountLogin: "4598526",
      accountServer: "BancoBTGPactual-PRD",
      tradeMode: "REAL",
    });
    expect(r).toEqual({ ok: true });
  });

  it("bloqueia conta divergente", () => {
    const r = validateLicenseExpectedActivation({
      license: licenseReal,
      accountLogin: "111",
      accountServer: "BancoBTGPactual-PRD",
      tradeMode: "REAL",
    });
    expect(r).toEqual({
      ok: false,
      code: "LICENSE_EXPECTED_ACCOUNT_MISMATCH",
    });
  });

  it("status mismatch quando heartbeat DEMO e esperado REAL", () => {
    const status = computeLicenseOperationalStatus({
      license: licenseReal,
      activeDevices: [],
      latestHeartbeat: {
        tradeMode: TradeMode.DEMO,
        deviceId: "mt5-old",
        receivedAt: new Date(),
      },
    });
    expect(status).toBe("AWAITING_NEW_DEVICE");
  });

  it("status OK com device ACTIVE REAL", () => {
    const status = computeLicenseOperationalStatus({
      license: licenseReal,
      activeDevices: [
        {
          status: DeviceStatus.ACTIVE,
          tradeMode: "REAL",
          accountLogin: "4598526",
          accountServer: "BancoBTGPactual-PRD",
        },
      ],
      latestHeartbeat: {
        tradeMode: TradeMode.REAL,
        deviceId: "mt5-new",
        receivedAt: new Date(),
      },
    });
    expect(status).toBe("OK");
  });

  it("device revogado é histórico", () => {
    const label = computeDeviceCompatibility({
      deviceStatus: DeviceStatus.REVOKED,
      reportedTradeMode: "DEMO",
      accountLogin: "52609973",
      accountServer: "XPMT5-DEMO",
      hasHeartbeat: true,
      expectedTradeMode: TradeMode.REAL,
      expectedAccountLogin: "4598526",
      expectedAccountServer: "BancoBTGPactual-PRD",
    });
    expect(label).toBe("HISTORICAL_REVOKED");
  });

  it("device ACTIVE REAL compatível", () => {
    const label = computeDeviceCompatibility({
      deviceStatus: DeviceStatus.ACTIVE,
      reportedTradeMode: "REAL",
      accountLogin: "4598526",
      accountServer: "BancoBTGPactual-PRD",
      hasHeartbeat: true,
      expectedTradeMode: TradeMode.REAL,
      expectedAccountLogin: "4598526",
      expectedAccountServer: "BancoBTGPactual-PRD",
    });
    expect(label).toBe("OK_REAL_ACTIVE");
  });
});
