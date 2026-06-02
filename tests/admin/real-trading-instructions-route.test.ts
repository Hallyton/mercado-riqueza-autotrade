import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, listMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  listMock: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/admin/real-trading-instructions", () => ({
  listRealTradingInstructionsAdmin: listMock,
  serializeRealTradingInstructionListItem: (row: { id: string }) => ({
    instructionId: row.id,
  }),
}));

import { GET } from "@/app/api/admin/real-trading/instructions/route";

describe("GET /api/admin/real-trading/instructions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue([{ id: "instr-real-1" }]);
  });

  it("exige sessão admin", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/admin/real-trading/instructions"));
    expect(res.status).toBe(401);
    expect(listMock).not.toHaveBeenCalled();
  });

  it("retorna lista REAL_MANUAL para admin", async () => {
    authMock.mockResolvedValue({
      user: { id: "admin-1", appRole: "ADMIN", role: "OPS" },
    });
    const res = await GET(new Request("http://localhost/api/admin/real-trading/instructions"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([{ instructionId: "instr-real-1" }]);
    expect(listMock).toHaveBeenCalled();
  });
});
