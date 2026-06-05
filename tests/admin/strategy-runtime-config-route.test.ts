import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/admin-api", () => ({
  requireAdminApiSession: vi.fn(),
  clientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/admin/strategy-runtime-config", () => ({
  getStrategyConfigAdminView: vi.fn(),
  saveStrategyConfigDraft: vi.fn(),
  StrategyRuntimeConfigError: class extends Error {
    code = "ERR";
    status = 400;
  },
}));

import { requireAdminApiSession } from "@/lib/auth/admin-api";
import { getStrategyConfigAdminView } from "@/lib/admin/strategy-runtime-config";
import { GET as strategyConfigGet } from "@/app/api/admin/licenses/[licenseId]/strategy-config/route";

describe("admin strategy-config route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for non-admin", async () => {
    vi.mocked(requireAdminApiSession).mockResolvedValue({
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    } as never);

    const res = await strategyConfigGet(
      new Request("http://localhost/api/admin/licenses/lic1/strategy-config"),
      { params: Promise.resolve({ licenseId: "lic1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns view for admin", async () => {
    vi.mocked(requireAdminApiSession).mockResolvedValue({
      session: { user: { id: "admin1" } },
    } as never);
    vi.mocked(getStrategyConfigAdminView).mockResolvedValue({
      licenseId: "lic1",
      strategyCode: "MR_FIBO_D1_GUARD",
    } as never);

    const res = await strategyConfigGet(
      new Request("http://localhost/api/admin/licenses/lic1/strategy-config"),
      { params: Promise.resolve({ licenseId: "lic1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.strategyCode).toBe("MR_FIBO_D1_GUARD");
  });
});
