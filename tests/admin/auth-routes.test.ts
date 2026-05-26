import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, dispatchMasterSignalFromAdmin, mapMasterSignalDispatchError } =
  vi.hoisted(() => ({
    authMock: vi.fn(),
    dispatchMasterSignalFromAdmin: vi.fn(),
    mapMasterSignalDispatchError: vi.fn(),
  }));

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("next/navigation", () => ({
  redirect: (target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  },
}));

vi.mock("@/lib/master-signals/admin-dispatch", () => ({
  dispatchMasterSignalFromAdmin,
  mapMasterSignalDispatchError,
}));

import { requireAppRole } from "@/lib/auth/session";
import { requireAdminApiSession } from "@/lib/auth/admin-api";
import { resolvePostLoginDestination } from "@/lib/auth/callback-url";
import { POST as dispatchMasterSignalRoute } from "@/app/api/admin/master-signals/[masterSignalId]/dispatch/route";

const ADMIN_API_DIR = path.join(process.cwd(), "app", "api", "admin");
const ADMIN_APP_DIR = path.join(process.cwd(), "app", "admin");

function listRouteFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listRouteFiles(fullPath);
    return entry.name === "route.ts" ? [fullPath] : [];
  });
}

function relativeToRepo(filePath: string): string {
  return path.relative(process.cwd(), filePath).replace(/\\/g, "/");
}

describe("auditoria admin auth e rotas protegidas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AUTH_SECRET;
    delete process.env.MASTER_EA_API_SECRET;
    delete process.env.DATABASE_URL;
  });

  it("layout /admin exige sessão ADMIN para todas as páginas admin", () => {
    const layoutPath = path.join(ADMIN_APP_DIR, "layout.tsx");
    const source = readFileSync(layoutPath, "utf8");

    expect(source).toContain('requireAppRole("ADMIN")');
  });

  it("página admin sem sessão redireciona para login", async () => {
    authMock.mockResolvedValue(null);

    await expect(requireAppRole("ADMIN")).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("admin autenticado acessa rota protegida", async () => {
    authMock.mockResolvedValue({
      user: { id: "admin-1", role: "OPS", appRole: "ADMIN" },
    });

    const session = await requireAppRole("ADMIN");

    expect(session.user.id).toBe("admin-1");
    expect(session.user.appRole).toBe("ADMIN");
  });

  it("todas as rotas app/api/admin usam requireAdminApiSession", () => {
    const routeFiles = listRouteFiles(ADMIN_API_DIR);

    expect(routeFiles.map(relativeToRepo).sort()).toEqual([
      "app/api/admin/emergency/cancel-orders/route.ts",
      "app/api/admin/instructions/route.ts",
      "app/api/admin/licenses/[licenseId]/pause-entries/route.ts",
      "app/api/admin/master-signals/[masterSignalId]/dispatch/route.ts",
      "app/api/admin/users/[userId]/block/route.ts",
    ]);

    for (const filePath of routeFiles) {
      const source = readFileSync(filePath, "utf8");
      expect(source, relativeToRepo(filePath)).toContain("requireAdminApiSession");
    }
  });

  it("API admin sem sessão retorna 401 sem expor secrets", async () => {
    process.env.AUTH_SECRET = "auth-secret-test";
    process.env.MASTER_EA_API_SECRET = "master-secret-test";
    process.env.DATABASE_URL = "postgres://secret-url";
    authMock.mockResolvedValue(null);

    const result = await requireAdminApiSession();

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.status).toBe(401);
      const body = await result.error.text();
      expect(body).toContain("Unauthorized");
      expect(body).not.toContain("auth-secret-test");
      expect(body).not.toContain("master-secret-test");
      expect(body).not.toContain("postgres://secret-url");
      expect(body).not.toContain("AUTH_SECRET");
      expect(body).not.toContain("MASTER_EA_API_SECRET");
      expect(body).not.toContain("DATABASE_URL");
    }
  });

  it("dispatch admin sem sessão não executa dispatch", async () => {
    authMock.mockResolvedValue(null);

    const response = await dispatchMasterSignalRoute(new Request("http://test.local"), {
      params: Promise.resolve({ masterSignalId: "ms-audit-001" }),
    });

    expect(response.status).toBe(401);
    expect(dispatchMasterSignalFromAdmin).not.toHaveBeenCalled();
  });

  it("dispatch admin autenticado permite execução manual para OPS", async () => {
    authMock.mockResolvedValue({
      user: { id: "admin-1", role: "OPS", appRole: "ADMIN" },
    });
    dispatchMasterSignalFromAdmin.mockResolvedValue({
      masterSignalId: "ms-audit-001",
      instructionsCreated: 1,
      skipped: 0,
      failed: 0,
      idempotent: false,
    });

    const response = await dispatchMasterSignalRoute(new Request("http://test.local"), {
      params: Promise.resolve({ masterSignalId: "ms-audit-001" }),
    });

    expect(response.status).toBe(200);
    expect(dispatchMasterSignalFromAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        masterSignalKey: "ms-audit-001",
        actorId: "admin-1",
      })
    );
  });

  it("callbackUrl rejeita open redirect externo e protocolo-relative", () => {
    expect(
      resolvePostLoginDestination({
        callbackUrl: "https://evil.example/admin",
        appRole: "ADMIN",
      })
    ).toBe("/admin");
    expect(
      resolvePostLoginDestination({
        callbackUrl: "//evil.example/admin",
        appRole: "ADMIN",
      })
    ).toBe("/admin");
    expect(
      resolvePostLoginDestination({
        callbackUrl: "/admin/master-signals",
        appRole: "ADMIN",
      })
    ).toBe("/admin/master-signals");
  });

  it("callbackUrl não permite trocar área entre ADMIN e CLIENT", () => {
    expect(
      resolvePostLoginDestination({
        callbackUrl: "/dashboard",
        appRole: "ADMIN",
      })
    ).toBe("/admin");
    expect(
      resolvePostLoginDestination({
        callbackUrl: "/admin",
        appRole: "CLIENT",
      })
    ).toBe("/dashboard");
  });
});
