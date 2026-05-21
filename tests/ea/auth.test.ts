import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  LicenseStatus,
  SubscriptionStatus,
} from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  default: {
    device: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/ea/token", () => ({
  hashToken: vi.fn((t: string) => `hash-${t}`),
}));

import prisma from "@/lib/prisma";
import {
  assertSubscriptionActive,
  authenticateEaRequest,
  EaAuthError,
  extractBearerToken,
} from "@/lib/ea/auth";

const baseLicense = {
  id: "lic1",
  userId: "user1",
  status: LicenseStatus.ACTIVE,
  haltNewEntries: false,
  haltAllTrading: false,
  subscription: {
    status: SubscriptionStatus.ACTIVE,
    currentPeriodEnd: new Date(Date.now() + 86400_000),
    plan: { allowDemo: false, slug: "pro", name: "Pro" },
  },
  mt5Account: { login: "12345", server: "Broker-Server" },
  exposureProfile: null,
};

describe("LicenseToken", () => {
  beforeEach(() => vi.clearAllMocks());

  it("extrai Bearer token", () => {
    const req = new Request("http://x", {
      headers: { Authorization: "Bearer secret-token" },
    });
    expect(extractBearerToken(req)).toBe("secret-token");
  });

  it("rejeita token inválido", async () => {
    vi.mocked(prisma.device.findFirst).mockResolvedValue(null);
    const req = new Request("http://x", {
      headers: {
        Authorization: "Bearer bad",
        "X-Device-Id": "dev-1",
      },
    });
    await expect(authenticateEaRequest(req)).rejects.toMatchObject({
      code: "INVALID_TOKEN",
      status: 401,
    });
  });

  it("aceita licença ativa com token válido", async () => {
    vi.mocked(prisma.device.findFirst).mockResolvedValue({
      id: "d1",
      deviceId: "dev-1",
      licenseId: "lic1",
      tokenHash: "hash-good",
      revokedAt: null,
      license: baseLicense,
    } as never);

    const req = new Request("http://x", {
      headers: {
        Authorization: "Bearer good",
        "X-Device-Id": "dev-1",
        "X-Request-Id": "req-1",
      },
    });

    const ctx = await authenticateEaRequest(req);
    expect(ctx.license.id).toBe("lic1");
    expect(ctx.requestId).toBe("req-1");
  });
});

describe("Licença ativa", () => {
  it("valida assinatura ativa", () => {
    expect(() =>
      assertSubscriptionActive({
        device: {} as never,
        license: baseLicense as never,
        requestId: null,
        deviceIdHeader: null,
        eaVersion: null,
      })
    ).not.toThrow();
  });
});

describe("Licença vencida", () => {
  it("falha assinatura expirada", () => {
    expect(() =>
      assertSubscriptionActive({
        device: {} as never,
        license: {
          ...baseLicense,
          subscription: {
            ...baseLicense.subscription,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodEnd: new Date(Date.now() - 1000),
          },
        } as never,
        requestId: null,
        deviceIdHeader: null,
        eaVersion: null,
      })
    ).toThrowError(EaAuthError);
  });

  it("falha assinatura inadimplente", () => {
    expect(() =>
      assertSubscriptionActive({
        device: {} as never,
        license: {
          ...baseLicense,
          subscription: {
            ...baseLicense.subscription,
            status: SubscriptionStatus.PAST_DUE,
          },
        } as never,
        requestId: null,
        deviceIdHeader: null,
        eaVersion: null,
      })
    ).toThrowError(
      expect.objectContaining({ code: "SUBSCRIPTION_INACTIVE" })
    );
  });
});
