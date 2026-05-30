import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeviceStatus, LicenseStatus, SubscriptionStatus } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  default: {
    license: { findUnique: vi.fn(), findFirst: vi.fn() },
    device: { findFirst: vi.fn(), update: vi.fn(), count: vi.fn() },
    eaHeartbeat: { findFirst: vi.fn(), findMany: vi.fn() },
    activationCode: { create: vi.fn() },
  },
}));

vi.mock("@/lib/admin/record-action", () => ({
  recordAdminAction: vi.fn(),
}));

vi.mock("@/lib/ea/activate", () => ({
  createActivationCodeForLicense: vi.fn(),
}));

import prisma from "@/lib/prisma";
import { recordAdminAction } from "@/lib/admin/record-action";
import { createActivationCodeForLicense } from "@/lib/ea/activate";
import {
  blockLicenseDevice,
  DEVICE_BLOCK_CONFIRM_PHRASE,
  DEVICE_REVOKE_CONFIRM_PHRASE,
  issueActivationCodeForAdmin,
  revokeLicenseDevice,
  ADMIN_ACTIVATION_CODE_CONFIRM_PHRASE,
} from "@/lib/admin/license-devices";

describe("license device admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("admin revoga device com confirmação correta", async () => {
    vi.mocked(prisma.device.findFirst).mockResolvedValue({
      id: "dev-rec",
      licenseId: "lic-1",
      deviceId: "vps-demo",
      status: DeviceStatus.ACTIVE,
      revokedAt: null,
    } as never);
    vi.mocked(prisma.device.update).mockResolvedValue({
      id: "dev-rec",
      deviceId: "vps-demo",
      status: DeviceStatus.REVOKED,
      revokedAt: new Date(),
    } as never);

    const updated = await revokeLicenseDevice({
      licenseId: "lic-1",
      deviceRecordId: "dev-rec",
      actorId: "admin-1",
      adminConfirmation: DEVICE_REVOKE_CONFIRM_PHRASE,
    });

    expect(updated.status).toBe(DeviceStatus.REVOKED);
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "license.device_revoked" })
    );
  });

  it("não revoga sem frase correta", async () => {
    await expect(
      revokeLicenseDevice({
        licenseId: "lic-1",
        deviceRecordId: "dev-rec",
        actorId: "admin-1",
        adminConfirmation: "errado",
      })
    ).rejects.toMatchObject({ code: "CONFIRMATION_MISMATCH" });
  });

  it("admin bloqueia device", async () => {
    vi.mocked(prisma.device.findFirst).mockResolvedValue({
      id: "dev-rec",
      licenseId: "lic-1",
      deviceId: "vps-demo",
      status: DeviceStatus.ACTIVE,
      revokedAt: null,
      revokedByUserId: null,
    } as never);
    vi.mocked(prisma.device.update).mockResolvedValue({
      id: "dev-rec",
      status: DeviceStatus.BLOCKED,
      blockedAt: new Date(),
    } as never);

    const updated = await blockLicenseDevice({
      licenseId: "lic-1",
      deviceRecordId: "dev-rec",
      actorId: "admin-1",
      adminConfirmation: DEVICE_BLOCK_CONFIRM_PHRASE,
    });

    expect(updated.status).toBe(DeviceStatus.BLOCKED);
  });

  it("gera activation code admin sem expor tokenHash", async () => {
    vi.mocked(prisma.license.findUnique).mockResolvedValue({
      id: "lic-1",
      status: LicenseStatus.ACTIVE,
      mt5Account: { login: "1", server: "S" },
      subscription: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date(Date.now() + 86400000),
      },
    } as never);
    vi.mocked(createActivationCodeForLicense).mockResolvedValue({
      code: "ABC12345",
      expiresAt: new Date(),
    });

    const result = await issueActivationCodeForAdmin({
      licenseId: "lic-1",
      actorId: "admin-1",
      adminConfirmation: ADMIN_ACTIVATION_CODE_CONFIRM_PHRASE,
    });

    expect(result.code).toBe("ABC12345");
    expect(JSON.stringify(result)).not.toContain("tokenHash");
    expect(recordAdminAction).toHaveBeenCalled();
  });
});
