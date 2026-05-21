import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  LicenseStatus,
  SubscriptionStatus,
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

  it("rejeita limite de devices", async () => {
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
});
