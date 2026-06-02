import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ExecutionStatus,
  InstructionSource,
  OrderLogStatus,
  ProtectionStatus,
} from "@prisma/client";

const { recordAdminAction } = vi.hoisted(() => ({
  recordAdminAction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    instruction: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    instructionStatusLog: { create: vi.fn() },
    execution: { update: vi.fn() },
    executionProtectionReport: { update: vi.fn(), create: vi.fn() },
    eaHeartbeat: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/admin/record-action", () => ({ recordAdminAction }));

import prisma from "@/lib/prisma";
import {
  CLOSE_NO_ORDER_CONFIRM_PHRASE,
  CLOSE_NO_ORDER_REASON_CODE,
  closeRealManualInstructionNoOrder,
  evaluateCloseNoOrderEligibility,
  hasClosedNoOrderInLogs,
} from "@/lib/admin/real-manual-close-no-order";

const instructionId = "cmpwldiz6002vlb04igy5692o";

const fullAttestation = {
  noPendingOrder: true as const,
  noOpenPosition: true as const,
  noRiskExposure: true as const,
  requiresNewPreflight: true as const,
};

const baseInstruction = {
  id: instructionId,
  source: InstructionSource.REAL_MANUAL,
  licenseId: "lic-1",
  symbol: "WDON26",
  magicNumber: 910001,
  accountLogin: "19583778",
  accountServer: "XPMT5-PRD",
  currentStatus: OrderLogStatus.EXECUTED,
  statusLogs: [],
  executions: [
    {
      id: "ex-1",
      status: ExecutionStatus.REJECTED,
      executedAt: new Date(),
      brokerTicket: null,
    },
  ],
  executionProtectionReports: [
    {
      id: "prot-1",
      protectionStatus: ProtectionStatus.PROTECTION_PENDING,
    },
  ],
};

const noExposure = {
  hasOpenPosition: false,
  hasPendingBrokerOrder: false,
  hasOtherArmedInstruction: false,
  heartbeatAvailable: false,
};

describe("real manual close no order", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.instruction.findUnique).mockResolvedValue(baseInstruction as never);
    vi.mocked(prisma.eaHeartbeat.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.instruction.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma)
    );
    vi.mocked(prisma.instruction.update).mockResolvedValue({} as never);
    vi.mocked(prisma.instructionStatusLog.create).mockResolvedValue({} as never);
    vi.mocked(prisma.execution.update).mockResolvedValue({} as never);
    vi.mocked(prisma.executionProtectionReport.update).mockResolvedValue({} as never);
  });

  it("exibe painel para EXECUTED + REJECTED + PROTECTION_PENDING sem heartbeat", () => {
    const eligibility = evaluateCloseNoOrderEligibility({
      source: InstructionSource.REAL_MANUAL,
      currentStatus: OrderLogStatus.EXECUTED,
      statusLogs: [],
      executions: [{ status: ExecutionStatus.REJECTED }],
      protectionReports: [{ protectionStatus: ProtectionStatus.PROTECTION_PENDING }],
      exposure: noExposure,
    });
    expect(eligibility.canShowClosePanel).toBe(true);
    expect(eligibility.heartbeatWarning).toContain("Sem heartbeat recente");
  });

  it("exibe painel para EXECUTED + PROTECTION_PENDING sem registro de execução", () => {
    const eligibility = evaluateCloseNoOrderEligibility({
      source: InstructionSource.REAL_MANUAL,
      currentStatus: OrderLogStatus.EXECUTED,
      statusLogs: [],
      executions: [],
      protectionReports: [{ protectionStatus: ProtectionStatus.PROTECTION_PENDING }],
      exposure: noExposure,
    });
    expect(eligibility.canShowClosePanel).toBe(true);
  });

  it("mantém painel visível com heartbeat reportando posição (somente aviso)", () => {
    const eligibility = evaluateCloseNoOrderEligibility({
      source: InstructionSource.REAL_MANUAL,
      currentStatus: OrderLogStatus.EXECUTED,
      statusLogs: [],
      executions: [{ status: ExecutionStatus.REJECTED }],
      protectionReports: [{ protectionStatus: ProtectionStatus.PROTECTION_PENDING }],
      exposure: {
        ...noExposure,
        hasOpenPosition: true,
        heartbeatAvailable: true,
      },
    });
    expect(eligibility.canShowClosePanel).toBe(true);
    expect(eligibility.heartbeatWarning).toMatch(/posição aberta/i);
  });

  it("não exibe painel quando já ORDER_NOT_PLACED", () => {
    const eligibility = evaluateCloseNoOrderEligibility({
      source: InstructionSource.REAL_MANUAL,
      currentStatus: OrderLogStatus.ORDER_NOT_PLACED,
      statusLogs: [{ status: OrderLogStatus.ORDER_NOT_PLACED, metadata: null }],
      executions: [{ status: ExecutionStatus.REJECTED }],
      protectionReports: [{ protectionStatus: ProtectionStatus.SKIPPED_NO_POSITION }],
      exposure: noExposure,
    });
    expect(eligibility.canShowClosePanel).toBe(false);
  });

  it("não exibe painel quando há PROTECTION_CONFIRMED", () => {
    const eligibility = evaluateCloseNoOrderEligibility({
      source: InstructionSource.REAL_MANUAL,
      currentStatus: OrderLogStatus.EXECUTED,
      statusLogs: [],
      executions: [{ status: ExecutionStatus.REJECTED }],
      protectionReports: [
        { protectionStatus: ProtectionStatus.PROTECTION_PENDING },
        { protectionStatus: ProtectionStatus.PROTECTION_CONFIRMED },
      ],
      exposure: noExposure,
    });
    expect(eligibility.canShowClosePanel).toBe(false);
  });

  it("não exibe painel quando há PROTECTION_FAILED", () => {
    const eligibility = evaluateCloseNoOrderEligibility({
      source: InstructionSource.REAL_MANUAL,
      currentStatus: OrderLogStatus.EXECUTED,
      statusLogs: [],
      executions: [{ status: ExecutionStatus.REJECTED }],
      protectionReports: [{ protectionStatus: ProtectionStatus.PROTECTION_FAILED }],
      exposure: noExposure,
    });
    expect(eligibility.canShowClosePanel).toBe(false);
  });

  it("bloqueia confirmação incorreta", async () => {
    await expect(
      closeRealManualInstructionNoOrder({
        instructionId,
        actorId: "admin-1",
        reasonCode: CLOSE_NO_ORDER_REASON_CODE,
        operatorNote: "Nota operacional válida para encerramento.",
        operatorAttestation: fullAttestation,
        adminConfirmation: "ERRADO",
      })
    ).rejects.toMatchObject({ code: "CONFIRMATION_MISMATCH" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("bloqueia atestação incompleta", async () => {
    await expect(
      closeRealManualInstructionNoOrder({
        instructionId,
        actorId: "admin-1",
        reasonCode: CLOSE_NO_ORDER_REASON_CODE,
        operatorNote: "Nota operacional válida para encerramento.",
        operatorAttestation: {
          noPendingOrder: true,
          noOpenPosition: false,
          noRiskExposure: true,
          requiresNewPreflight: true,
        },
        adminConfirmation: CLOSE_NO_ORDER_CONFIRM_PHRASE,
      })
    ).rejects.toMatchObject({ code: "OPERATOR_ATTESTATION_INCOMPLETE" });
  });

  it("encerra REAL_MANUAL e registra admin action com atestação", async () => {
    const result = await closeRealManualInstructionNoOrder({
      instructionId,
      actorId: "admin-1",
      reasonCode: CLOSE_NO_ORDER_REASON_CODE,
      operatorNote:
        "Ordem LIMIT não foi apregoada no MT5 por falha/rejeição da bolsa. Nenhuma ordem pendente.",
      operatorAttestation: fullAttestation,
      adminConfirmation: CLOSE_NO_ORDER_CONFIRM_PHRASE,
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(OrderLogStatus.ORDER_NOT_PLACED);
    expect(prisma.executionProtectionReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          protectionStatus: ProtectionStatus.SKIPPED_NO_POSITION,
        }),
      })
    );
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "real_trading.instruction.close_no_order",
        metadata: expect.objectContaining({
          operatorAttestation: fullAttestation,
          previousStatus: OrderLogStatus.EXECUTED,
          newStatus: OrderLogStatus.ORDER_NOT_PLACED,
        }),
      })
    );
  });

  it("não marca PROTECTION_FAILED nem PROTECTION_CONFIRMED", async () => {
    await closeRealManualInstructionNoOrder({
      instructionId,
      actorId: "admin-1",
      reasonCode: CLOSE_NO_ORDER_REASON_CODE,
      operatorNote: "Nota operacional válida para encerramento completa.",
      operatorAttestation: fullAttestation,
      adminConfirmation: CLOSE_NO_ORDER_CONFIRM_PHRASE,
    });

    const updateCalls = vi.mocked(prisma.executionProtectionReport.update).mock.calls;
    for (const call of updateCalls) {
      const status = call[0]?.data?.protectionStatus;
      expect(status).not.toBe(ProtectionStatus.PROTECTION_FAILED);
      expect(status).not.toBe(ProtectionStatus.PROTECTION_CONFIRMED);
    }
  });

  it("rejeita TEST/HOMOLOGATION", async () => {
    vi.mocked(prisma.instruction.findUnique).mockResolvedValue({
      ...baseInstruction,
      source: InstructionSource.TEST,
    } as never);

    await expect(
      closeRealManualInstructionNoOrder({
        instructionId,
        actorId: "admin-1",
        reasonCode: CLOSE_NO_ORDER_REASON_CODE,
        operatorNote: "Nota operacional válida para encerramento.",
        operatorAttestation: fullAttestation,
        adminConfirmation: CLOSE_NO_ORDER_CONFIRM_PHRASE,
      })
    ).rejects.toMatchObject({ code: "SOURCE_NOT_REAL_MANUAL" });
  });

  it("REAL_MANUAL_ALREADY_CLOSED em segundo encerramento", async () => {
    vi.mocked(prisma.instruction.findUnique).mockResolvedValue({
      ...baseInstruction,
      currentStatus: OrderLogStatus.ORDER_NOT_PLACED,
      statusLogs: [{ status: OrderLogStatus.ORDER_NOT_PLACED, metadata: null }],
    } as never);

    await expect(
      closeRealManualInstructionNoOrder({
        instructionId,
        actorId: "admin-1",
        reasonCode: CLOSE_NO_ORDER_REASON_CODE,
        operatorNote: "Nota operacional válida para encerramento.",
        operatorAttestation: fullAttestation,
        adminConfirmation: CLOSE_NO_ORDER_CONFIRM_PHRASE,
      })
    ).rejects.toMatchObject({ code: "REAL_MANUAL_ALREADY_CLOSED" });
  });

  it("hasClosedNoOrderInLogs detecta evento CLOSED_NO_ORDER", () => {
    expect(
      hasClosedNoOrderInLogs([
        {
          status: OrderLogStatus.REJECTED,
          metadata: { event: "CLOSED_NO_ORDER" },
        },
      ])
    ).toBe(true);
  });
});
