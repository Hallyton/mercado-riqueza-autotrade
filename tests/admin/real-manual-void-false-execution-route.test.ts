import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, voidMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  voidMock: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/admin/real-manual-void-false-execution", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/admin/real-manual-void-false-execution")>();
  return {
    ...actual,
    voidRealManualFalseExecution: voidMock,
  };
});

import { POST } from "@/app/api/admin/real-trading/instructions/[instructionId]/void-false-execution/route";
import {
  RealManualVoidFalseExecutionError,
  VOID_FALSE_EXECUTION_CONFIRM_PHRASE,
  VOID_FALSE_EXECUTION_REASON_CODE,
} from "@/lib/admin/real-manual-void-false-execution";

const fullAttestation = {
  checkedMt5: true,
  noPendingOrder: true,
  noOpenPosition: true,
  noRiskExposure: true,
  brokerExecutionWasFalsePositive: true,
  requiresNewPreflight: true,
};

describe("POST void-false-execution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    voidMock.mockResolvedValue({
      ok: true,
      instructionId: "instr-1",
      status: "VOIDED_FALSE_EXECUTION",
    });
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

  it("ADMIN anula com payload válido", async () => {
    authMock.mockResolvedValue({
      user: { id: "admin-1", appRole: "ADMIN", role: "OPS" },
    });
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          reasonCode: VOID_FALSE_EXECUTION_REASON_CODE,
          operatorNote:
            "Retorno de execução preenchida foi falso positivo por falha/rejeição interna da B3/bolsa/broker. Verificado no MT5: nenhuma ordem pendente, nenhuma posição aberta e nenhuma exposição de risco.",
          operatorAttestation: fullAttestation,
          adminConfirmation: VOID_FALSE_EXECUTION_CONFIRM_PHRASE,
        }),
      }),
      { params: Promise.resolve({ instructionId: "instr-1" }) }
    );
    expect(res.status).toBe(200);
    expect(voidMock).toHaveBeenCalled();
  });

  it("confirmação textual incorreta retorna 400", async () => {
    voidMock.mockRejectedValueOnce(
      new RealManualVoidFalseExecutionError(
        "Confirmação inválida",
        "CONFIRMATION_MISMATCH",
        400
      )
    );
    authMock.mockResolvedValue({
      user: { id: "admin-1", appRole: "ADMIN", role: "OPS" },
    });
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          reasonCode: VOID_FALSE_EXECUTION_REASON_CODE,
          operatorNote:
            "Retorno de execução preenchida foi falso positivo por falha/rejeição interna da B3/bolsa/broker. Verificado no MT5: nenhuma ordem pendente, nenhuma posição aberta e nenhuma exposição de risco.",
          operatorAttestation: fullAttestation,
          adminConfirmation: "ERRADO",
        }),
      }),
      { params: Promise.resolve({ instructionId: "instr-1" }) }
    );
    expect(res.status).toBe(400);
  });
});
