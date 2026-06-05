import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/admin-api", () => ({
  requireAdminApiSession: authMock,
  clientIp: () => "127.0.0.1",
}));

vi.mock("@/lib/admin/license-autonomous-strategy", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/admin/license-autonomous-strategy")>();
  return {
    ...actual,
    updateLicenseAutonomousStrategy: updateMock,
  };
});

import { POST } from "@/app/api/admin/licenses/[licenseId]/autonomous-strategy/route";
import { AUTONOMOUS_STRATEGY_ENABLE_CONFIRM_PHRASE } from "@/lib/admin/license-autonomous-strategy";

describe("POST /api/admin/licenses/[licenseId]/autonomous-strategy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMock.mockResolvedValue({
      ok: true,
      robotInstanceId: "ri1",
      autonomousStrategyEnabled: true,
    });
  });

  it("retorna 401 sem sessão admin", async () => {
    authMock.mockResolvedValue({
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });

    const res = await POST(
      new Request("http://localhost/api", {
        method: "POST",
        body: JSON.stringify({
          strategy_code: "MR_FIBO_D1_GUARD",
          autonomous_strategy_enabled: true,
          admin_confirmation: AUTONOMOUS_STRATEGY_ENABLE_CONFIRM_PHRASE,
        }),
      }),
      { params: Promise.resolve({ licenseId: "lic1" }) }
    );
    expect(res.status).toBe(401);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("admin autenticado pode habilitar", async () => {
    authMock.mockResolvedValue({
      session: { user: { id: "admin1" } },
    });

    const res = await POST(
      new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategy_code: "MR_FIBO_D1_GUARD",
          autonomous_strategy_enabled: true,
          admin_confirmation: AUTONOMOUS_STRATEGY_ENABLE_CONFIRM_PHRASE,
        }),
      }),
      { params: Promise.resolve({ licenseId: "lic1" }) }
    );

    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        licenseId: "lic1",
        autonomousStrategyEnabled: true,
        actorId: "admin1",
      })
    );
  });
});
