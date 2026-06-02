import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, closeMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  closeMock: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/admin/real-manual-close-no-order", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/real-manual-close-no-order")>();
  return {
    ...actual,
    closeRealManualInstructionNoOrder: closeMock,
  };
});

import { POST } from "@/app/api/admin/real-trading/instructions/[instructionId]/close-no-order/route";
import {
  CLOSE_NO_ORDER_CONFIRM_PHRASE,
  CLOSE_NO_ORDER_REASON_CODE,
} from "@/lib/admin/real-manual-close-no-order";

const fullAttestation = {
  noPendingOrder: true,
  noOpenPosition: true,
  noRiskExposure: true,
  requiresNewPreflight: true,
};

describe("POST close-no-order", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    closeMock.mockResolvedValue({ ok: true, instructionId: "instr-1" });
  });

  it("CLIENT não acessa (401)", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ instructionId: "instr-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("ADMIN encerra com payload válido", async () => {
    authMock.mockResolvedValue({
      user: { id: "admin-1", appRole: "ADMIN", role: "OPS" },
    });
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          reasonCode: CLOSE_NO_ORDER_REASON_CODE,
          operatorNote:
            "Ordem LIMIT não foi apregoada no MT5 por falha/rejeição da bolsa.",
          operatorAttestation: fullAttestation,
          adminConfirmation: CLOSE_NO_ORDER_CONFIRM_PHRASE,
        }),
      }),
      { params: Promise.resolve({ instructionId: "instr-1" }) }
    );
    expect(res.status).toBe(200);
    expect(closeMock).toHaveBeenCalled();
  });
});
