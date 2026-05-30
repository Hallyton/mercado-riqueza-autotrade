import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeviceStatus } from "@prisma/client";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    device: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import { authenticateEaRequest, EaAuthError } from "@/lib/ea/auth";
import { hashToken } from "@/lib/ea/token";

function mockRequest(token: string) {
  return new Request("https://example.com", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

describe("EA device auth lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("device revogado retorna DEVICE_REVOKED", async () => {
    const token = "opaque-revoked";
    prismaMock.device.findFirst.mockResolvedValue({
      id: "d1",
      deviceId: "vps-1",
      status: DeviceStatus.REVOKED,
      revokedAt: new Date(),
      blockedAt: null,
      tokenHash: hashToken(token),
      license: {
        subscription: { status: "ACTIVE", plan: { allowDemo: true } },
        mt5Account: null,
        exposureProfile: null,
        status: "ACTIVE",
      },
    });

    await expect(authenticateEaRequest(mockRequest(token))).rejects.toMatchObject({
      code: "DEVICE_REVOKED",
    });
  });

  it("device bloqueado retorna DEVICE_BLOCKED", async () => {
    const token = "opaque-blocked";
    prismaMock.device.findFirst.mockResolvedValue({
      id: "d1",
      deviceId: "vps-1",
      status: DeviceStatus.BLOCKED,
      blockedAt: new Date(),
      revokedAt: new Date(),
      tokenHash: hashToken(token),
      license: {
        subscription: { status: "ACTIVE", plan: { allowDemo: true } },
        mt5Account: null,
        exposureProfile: null,
        status: "ACTIVE",
      },
    });

    await expect(authenticateEaRequest(mockRequest(token))).rejects.toMatchObject({
      code: "DEVICE_BLOCKED",
    });
  });

  it("device ativo autentica", async () => {
    const token = "opaque-active";
    prismaMock.device.findFirst.mockResolvedValue({
      id: "d1",
      deviceId: "vps-1",
      status: DeviceStatus.ACTIVE,
      revokedAt: null,
      blockedAt: null,
      tokenHash: hashToken(token),
      license: {
        id: "lic-1",
        userId: "u1",
        subscription: {
          status: "ACTIVE",
          currentPeriodEnd: new Date(Date.now() + 86400000),
          plan: { allowDemo: true },
        },
        mt5Account: { login: "1", server: "S" },
        exposureProfile: null,
        status: "ACTIVE",
        haltNewEntries: false,
        haltAllTrading: false,
      },
    });

    const ctx = await authenticateEaRequest(mockRequest(token));
    expect(ctx.device.deviceId).toBe("vps-1");
  });
});
