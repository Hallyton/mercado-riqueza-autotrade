import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  LicenseStatus,
  SubscriptionStatus,
} from "@prisma/client";

const { prismaMock, auditMock, activationMock, assertAccessMock } = vi.hoisted(() => ({
  prismaMock: {
    license: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    mt5Account: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    device: { updateMany: vi.fn(), count: vi.fn() },
    activationCode: { updateMany: vi.fn() },
  },
  auditMock: vi.fn(),
  activationMock: vi.fn(),
  assertAccessMock: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/audit/log", () => ({ createAuditLog: auditMock }));
vi.mock("@/lib/licensing/service", () => ({
  assertLicenseAccess: assertAccessMock,
}));
vi.mock("@/lib/ea/activate", () => ({
  createActivationCodeForLicense: activationMock,
}));

import {
  ClientLicenseError,
  issueActivationCodeForClient,
  linkMt5AccountToLicense,
  updateMt5AccountForLicense,
} from "@/lib/licensing/client-license";

const baseLicense = {
  id: "lic_1",
  userId: "user_1",
  subscriptionId: "sub_1",
  mt5AccountId: null,
  status: LicenseStatus.ACTIVE,
  haltNewEntries: false,
  haltAllTrading: true,
  subscription: {
    status: SubscriptionStatus.ACTIVE,
    currentPeriodEnd: new Date(Date.now() + 86400000),
    plan: { name: "Start", maxMt5Accounts: 1, maxDevices: 1 },
  },
  mt5Account: null,
};

const linkedLicense = {
  ...baseLicense,
  mt5AccountId: "mt5_old",
  mt5Account: { id: "mt5_old", login: "11111", server: "Old-Server" },
};

describe("linkMt5AccountToLicense", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertAccessMock.mockResolvedValue(true);
    prismaMock.license.findUnique.mockResolvedValue(baseLicense);
    prismaMock.license.count.mockResolvedValue(0);
    prismaMock.mt5Account.findUnique.mockResolvedValue(null);
    prismaMock.mt5Account.create.mockResolvedValue({
      id: "mt5_1",
      login: "12345",
      server: "Broker",
      userId: "user_1",
    });
    prismaMock.license.findFirst.mockResolvedValue(null);
    prismaMock.license.update.mockResolvedValue({});
    prismaMock.device.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.activationCode.updateMany.mockResolvedValue({ count: 0 });
  });

  it("vincula MT5 e grava auditoria", async () => {
    await linkMt5AccountToLicense({
      userId: "user_1",
      licenseId: "lic_1",
      login: "12345",
      server: "Broker",
    });

    expect(prismaMock.license.update).toHaveBeenCalledWith({
      where: { id: "lic_1" },
      data: { mt5AccountId: "mt5_1" },
    });
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "license.mt5_linked" })
    );
    expect(prismaMock.device.updateMany).not.toHaveBeenCalled();
  });

  it("rejeita login MT5 não numérico", async () => {
    await expect(
      linkMt5AccountToLicense({
        userId: "user_1",
        licenseId: "lic_1",
        login: "abc",
        server: "Broker",
      })
    ).rejects.toMatchObject({ code: "INVALID_MT5_LOGIN" });
  });
});

describe("updateMt5AccountForLicense — alterar MT5", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertAccessMock.mockResolvedValue(true);
    prismaMock.license.findUnique.mockResolvedValue(linkedLicense);
    prismaMock.mt5Account.findUnique.mockResolvedValue(null);
    prismaMock.mt5Account.create.mockResolvedValue({
      id: "mt5_new",
      login: "52609973",
      server: "XPMT5-DEMO",
      userId: "user_1",
    });
    prismaMock.license.findFirst.mockResolvedValue(null);
    prismaMock.license.update.mockResolvedValue({});
    prismaMock.device.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.activationCode.updateMany.mockResolvedValue({ count: 0 });
  });

  it("altera MT5 da própria licença e revoga devices", async () => {
    const result = await updateMt5AccountForLicense({
      userId: "user_1",
      licenseId: "lic_1",
      login: "52609973",
      server: "XPMT5-DEMO",
    });

    expect(result.changed).toBe(true);
    expect(result.devicesRevoked).toBe(1);
    expect(prismaMock.device.updateMany).toHaveBeenCalledWith({
      where: { licenseId: "lic_1", revokedAt: null },
      data: expect.objectContaining({ revokedAt: expect.any(Date) }),
    });
    expect(prismaMock.license.update).toHaveBeenCalledWith({
      where: { id: "lic_1" },
      data: { mt5AccountId: "mt5_new" },
    });
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "license.mt5_changed" })
    );
  });

  it("não altera flags halt nem status da licença", async () => {
    await updateMt5AccountForLicense({
      userId: "user_1",
      licenseId: "lic_1",
      login: "52609973",
      server: "XPMT5-DEMO",
    });

    const updateCall = prismaMock.license.update.mock.calls[0]?.[0];
    expect(updateCall?.data).toEqual({ mt5AccountId: "mt5_new" });
  });

  it("cliente não altera licença de outro usuário", async () => {
    assertAccessMock.mockResolvedValue(false);

    await expect(
      updateMt5AccountForLicense({
        userId: "user_other",
        licenseId: "lic_1",
        login: "52609973",
        server: "XPMT5-DEMO",
      })
    ).rejects.toMatchObject({ code: "LICENSE_NOT_FOUND", status: 404 });
  });

  it("mesmos login/servidor não revoga devices", async () => {
    const result = await updateMt5AccountForLicense({
      userId: "user_1",
      licenseId: "lic_1",
      login: "11111",
      server: "Old-Server",
    });

    expect(result.changed).toBe(false);
    expect(result.devicesRevoked).toBe(0);
    expect(prismaMock.device.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.license.update).not.toHaveBeenCalled();
  });
});

describe("issueActivationCodeForClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activationMock.mockResolvedValue({
      code: "ABCD1234",
      expiresAt: new Date(Date.now() + 900000),
    });
  });

  it("exige MT5 vinculado", async () => {
    prismaMock.license.findUnique.mockResolvedValue(baseLicense);

    await expect(
      issueActivationCodeForClient({ userId: "user_1", licenseId: "lic_1" })
    ).rejects.toMatchObject({ code: "MT5_NOT_LINKED" });
  });

  it("emite código com MT5 vinculado", async () => {
    prismaMock.license.findUnique.mockResolvedValue({
      ...baseLicense,
      mt5Account: { login: "12345", server: "Broker" },
    });

    const result = await issueActivationCodeForClient({
      userId: "user_1",
      licenseId: "lic_1",
    });

    expect(result.code).toBe("ABCD1234");
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "license.activation_code_issued" })
    );
  });
});

describe("ClientLicenseError", () => {
  it("expõe código HTTP", () => {
    const err = new ClientLicenseError("teste", "CODE", 403);
    expect(err.status).toBe(403);
  });
});
