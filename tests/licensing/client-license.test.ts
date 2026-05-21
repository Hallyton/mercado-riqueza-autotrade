import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  LicenseStatus,
  SubscriptionStatus,
} from "@prisma/client";

const { prismaMock, auditMock, activationMock } = vi.hoisted(() => ({
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
    device: { count: vi.fn() },
  },
  auditMock: vi.fn(),
  activationMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/audit/log", () => ({ createAuditLog: auditMock }));
vi.mock("@/lib/licensing/service", () => ({
  assertLicenseAccess: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/ea/activate", () => ({
  createActivationCodeForLicense: activationMock,
}));

import {
  ClientLicenseError,
  issueActivationCodeForClient,
  linkMt5AccountToLicense,
} from "@/lib/licensing/client-license";

const baseLicense = {
  id: "lic_1",
  userId: "user_1",
  subscriptionId: "sub_1",
  mt5AccountId: null,
  status: LicenseStatus.PENDING_ACTIVATION,
  subscription: {
    status: SubscriptionStatus.ACTIVE,
    currentPeriodEnd: new Date(Date.now() + 86400000),
    plan: { name: "Start", maxMt5Accounts: 1, maxDevices: 1 },
  },
  mt5Account: null,
};

describe("linkMt5AccountToLicense", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
