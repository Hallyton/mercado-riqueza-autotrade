import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  DeviceStatus,
  LicenseStatus,
  SubscriptionStatus,
  TradeMode,
} from "@prisma/client";

const { prismaMock, auditMock, syncMock } = vi.hoisted(() => ({
  prismaMock: {
    activationCode: { findFirst: vi.fn(), update: vi.fn() },
    device: {
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    license: { update: vi.fn() },
    $transaction: vi.fn(),
  },
  auditMock: vi.fn(),
  syncMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/audit/log", () => ({ createAuditLog: auditMock }));
vi.mock("@/lib/licensing/service", () => ({
  syncLicenseFlags: syncMock,
}));

import { activateEaDevice } from "@/lib/ea/activate";

const licenseBase = {
  id: "lic_1",
  userId: "user_1",
  status: LicenseStatus.PENDING_ACTIVATION,
  expectedTradeMode: TradeMode.DEMO,
  expectedAccountLogin: null,
  expectedAccountServer: null,
  expectedSymbol: null,
  expectedMagicNumber: null,
  mt5Account: { login: "1", server: "S" },
  subscription: {
    status: SubscriptionStatus.ACTIVE,
    currentPeriodEnd: new Date(Date.now() + 86400000),
    plan: { maxDevices: 1 },
  },
};

describe("activateEaDevice validações", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.activationCode.findFirst.mockResolvedValue({
      id: "act_1",
      license: licenseBase,
    });
    prismaMock.device.findUnique.mockResolvedValue(null);
    prismaMock.device.count.mockResolvedValue(0);
    prismaMock.$transaction.mockImplementation(async (fn) => fn(prismaMock));
    prismaMock.device.create.mockResolvedValue({ id: "dev_1" });
    prismaMock.activationCode.update.mockResolvedValue({});
    syncMock.mockResolvedValue({});
  });

  it("rejeita sem MT5 vinculado", async () => {
    prismaMock.activationCode.findFirst.mockResolvedValue({
      id: "act_1",
      license: { ...licenseBase, mt5Account: null },
    });

    const result = await activateEaDevice({
      activationCode: "CODE",
      deviceId: "vps-1",
    });

    expect(result).toEqual({ ok: false, code: "MT5_NOT_LINKED" });
  });

  it("rejeita limite de devices ativos", async () => {
    prismaMock.device.count.mockResolvedValue(1);

    const result = await activateEaDevice({
      activationCode: "CODE",
      deviceId: "vps-new",
    });

    expect(result).toEqual({ ok: false, code: "DEVICE_LIMIT_EXCEEDED" });
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ea.activation_rejected" })
    );
  });

  it("reativa device revogado sem contar no limite", async () => {
    prismaMock.device.findUnique.mockResolvedValue({
      id: "dev-old",
      status: DeviceStatus.REVOKED,
      revokedAt: new Date(),
    });
    prismaMock.device.update.mockResolvedValue({ id: "dev-old" });

    const result = await activateEaDevice({
      activationCode: "CODE",
      deviceId: "vps-real",
    });

    expect(result.ok).toBe(true);
    expect(prismaMock.device.count).not.toHaveBeenCalled();
    expect(prismaMock.device.update).toHaveBeenCalled();
  });

  it("rejeita device bloqueado existente", async () => {
    prismaMock.device.findUnique.mockResolvedValue({
      id: "dev-blocked",
      status: DeviceStatus.BLOCKED,
      revokedAt: new Date(),
    });

    const result = await activateEaDevice({
      activationCode: "CODE",
      deviceId: "vps-blocked",
    });

    expect(result).toEqual({ ok: false, code: "DEVICE_BLOCKED" });
  });

  it("rejeita tradeMode DEMO quando licença espera REAL", async () => {
    prismaMock.activationCode.findFirst.mockResolvedValue({
      id: "act_1",
      license: {
        ...licenseBase,
        expectedTradeMode: TradeMode.REAL,
        expectedAccountLogin: "4598526",
        expectedAccountServer: "BancoBTGPactual-PRD",
        mt5Account: { login: "4598526", server: "BancoBTGPactual-PRD" },
      },
    });

    const result = await activateEaDevice({
      activationCode: "CODE",
      deviceId: "vps-real",
      accountLogin: "4598526",
      accountServer: "BancoBTGPactual-PRD",
      tradeMode: "DEMO",
    });

    expect(result).toEqual({
      ok: false,
      code: "LICENSE_EXPECTED_TRADE_MODE_MISMATCH",
    });
  });

  it("aceita ativação REAL após device revogado quando dados conferem", async () => {
    prismaMock.activationCode.findFirst.mockResolvedValue({
      id: "act_1",
      license: {
        ...licenseBase,
        expectedTradeMode: TradeMode.REAL,
        expectedAccountLogin: "4598526",
        expectedAccountServer: "BancoBTGPactual-PRD",
        mt5Account: { login: "4598526", server: "BancoBTGPactual-PRD" },
      },
    });
    prismaMock.device.findUnique.mockResolvedValue({
      id: "dev-old",
      status: DeviceStatus.REVOKED,
      revokedAt: new Date(),
    });
    prismaMock.device.update.mockResolvedValue({ id: "dev-old" });

    const result = await activateEaDevice({
      activationCode: "CODE",
      deviceId: "vps-real",
      accountLogin: "4598526",
      accountServer: "BancoBTGPactual-PRD",
      tradeMode: "REAL",
    });

    expect(result.ok).toBe(true);
  });

  it("persiste somente tokenHash do device, nunca o token bruto", async () => {
    const result = await activateEaDevice({
      activationCode: "CODE",
      deviceId: "vps-1",
      fingerprint: "fp-1",
      eaVersion: "1.0.0",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.device_token).toBeTruthy();
    }
    const createArg = prismaMock.device.create.mock.calls[0][0];
    const persisted = JSON.stringify(createArg.data);
    expect(createArg.data).toHaveProperty("tokenHash");
    expect(createArg.data).not.toHaveProperty("device_token");
    expect(createArg.data).not.toHaveProperty("token");
    if (result.ok) {
      expect(persisted).not.toContain(result.device_token);
    }
  });
});
