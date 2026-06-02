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
    executionProtectionReport: { update: vi.fn() },
    eaHeartbeat: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/admin/record-action", () => ({ recordAdminAction }));

import prisma from "@/lib/prisma";
import {
  VOID_FALSE_EXECUTION_CONFIRM_PHRASE,
  VOID_FALSE_EXECUTION_REASON_CODE,
  evaluateVoidFalseExecutionEligibility,
  hasVoidedFalseExecutionInLogs,
  voidRealManualFalseExecution,
} from "@/lib/admin/real-manual-void-false-execution";

const instructionId = "cmpwldiz6002vlb04igy5692o";

const fullAttestation = {
  checkedMt5: true as const,
  noPendingOrder: true as const,
  noOpenPosition: true as const,
  noRiskExposure: true as const,
  brokerExecutionWasFalsePositive: true as const,
  requiresNewPreflight: true as const,
};

const baseInstruction = {
  id: instructionId,
  source: InstructionSource.REAL_MANUAL,
  licenseId: "lic-1",
  symbol: "WDON26",
  magicNumber: 910001,
  currentStatus: OrderLogStatus.EXECUTED,
  requiresProtectionConfirmation: true,
  statusLogs: [],
  executions: [
    {
      id: "ex-1",
      status: ExecutionStatus.FILLED,
      executedAt: new Date(),
      brokerTicket: "99999",
      errorCode: null,
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
  heartbeatAvailable: true,
};

describe("real manual void false execution", () => {
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

  it("exibe painel para EXECUTED + FILLED + PROTECTION_PENDING", () => {
    const eligibility = evaluateVoidFalseExecutionEligibility({
      source: InstructionSource.REAL_MANUAL,
      currentStatus: OrderLogStatus.EXECUTED,
      statusLogs: [],
      executions: [{ status: ExecutionStatus.FILLED, brokerTicket: "1" }],
      protectionReports: [{ protectionStatus: ProtectionStatus.PROTECTION_PENDING }],
      requiresProtectionConfirmation: true,
      exposure: noExposure,
    });
    expect(eligibility.showAdminActionsCard).toBe(true);
    expect(eligibility.canVoidFalseExecution).toBe(true);
  });

  it("não permite anular HOMOLOGATION source", () => {
    const eligibility = evaluateVoidFalseExecutionEligibility({
      source: InstructionSource.HOMOLOGATION,
      currentStatus: OrderLogStatus.EXECUTED,
      statusLogs: [],
      executions: [{ status: ExecutionStatus.FILLED }],
      protectionReports: [{ protectionStatus: ProtectionStatus.PROTECTION_PENDING }],
      exposure: noExposure,
    });
    expect(eligibility.canVoidFalseExecution).toBe(false);
  });

  it("não permite anular TEST source", () => {
    const eligibility = evaluateVoidFalseExecutionEligibility({
      source: InstructionSource.TEST,
      currentStatus: OrderLogStatus.EXECUTED,
      statusLogs: [],
      executions: [{ status: ExecutionStatus.FILLED }],
      protectionReports: [{ protectionStatus: ProtectionStatus.PROTECTION_PENDING }],
      exposure: noExposure,
    });
    expect(eligibility.canVoidFalseExecution).toBe(false);
  });

  it("não permite anular com PROTECTION_CONFIRMED", () => {
    const eligibility = evaluateVoidFalseExecutionEligibility({
      source: InstructionSource.REAL_MANUAL,
      currentStatus: OrderLogStatus.EXECUTED,
      statusLogs: [],
      executions: [{ status: ExecutionStatus.FILLED }],
      protectionReports: [{ protectionStatus: ProtectionStatus.PROTECTION_CONFIRMED }],
      exposure: noExposure,
    });
    expect(eligibility.canVoidFalseExecution).toBe(false);
  });

  it("não marca PROTECTION_FAILED nem PROTECTION_CONFIRMED após void", async () => {
    await voidRealManualFalseExecution({
      instructionId,
      actorId: "admin-1",
      reasonCode: VOID_FALSE_EXECUTION_REASON_CODE,
      operatorNote:
        "Retorno de execução preenchida foi falso positivo por falha/rejeição interna da B3/bolsa/broker. Verificado no MT5: nenhuma ordem pendente, nenhuma posição aberta e nenhuma exposição de risco.",
      operatorAttestation: fullAttestation,
      adminConfirmation: VOID_FALSE_EXECUTION_CONFIRM_PHRASE,
    });

    const protUpdate = vi.mocked(prisma.executionProtectionReport.update).mock.calls[0]?.[0];
    expect(protUpdate?.data?.protectionStatus).toBe(ProtectionStatus.SKIPPED_NO_POSITION);
    expect(protUpdate?.data?.protectionStatus).not.toBe(ProtectionStatus.PROTECTION_FAILED);
    expect(protUpdate?.data?.protectionStatus).not.toBe(ProtectionStatus.PROTECTION_CONFIRMED);
  });

  it("bloqueia confirmação textual incorreta", async () => {
    await expect(
      voidRealManualFalseExecution({
        instructionId,
        actorId: "admin-1",
        reasonCode: VOID_FALSE_EXECUTION_REASON_CODE,
        operatorNote: "Nota operacional válida para anulação de falso positivo.",
        operatorAttestation: fullAttestation,
        adminConfirmation: "CONFIRMACAO ERRADA",
      })
    ).rejects.toMatchObject({ code: "CONFIRMATION_MISMATCH" });
  });

  it("bloqueia atestação incompleta", async () => {
    await expect(
      voidRealManualFalseExecution({
        instructionId,
        actorId: "admin-1",
        reasonCode: VOID_FALSE_EXECUTION_REASON_CODE,
        operatorNote: "Nota operacional válida para anulação de falso positivo.",
        operatorAttestation: {
          ...fullAttestation,
          checkedMt5: false as unknown as true,
        },
        adminConfirmation: VOID_FALSE_EXECUTION_CONFIRM_PHRASE,
      })
    ).rejects.toMatchObject({ code: "OPERATOR_ATTESTATION_INCOMPLETE" });
  });

  it("bloqueia operatorNote vazia", async () => {
    await expect(
      voidRealManualFalseExecution({
        instructionId,
        actorId: "admin-1",
        reasonCode: VOID_FALSE_EXECUTION_REASON_CODE,
        operatorNote: "   ",
        operatorAttestation: fullAttestation,
        adminConfirmation: VOID_FALSE_EXECUTION_CONFIRM_PHRASE,
      })
    ).rejects.toMatchObject({ code: "OPERATOR_NOTE_REQUIRED" });
  });

  it("instruction inexistente retorna 404", async () => {
    vi.mocked(prisma.instruction.findUnique).mockResolvedValue(null);
    await expect(
      voidRealManualFalseExecution({
        instructionId: "missing",
        actorId: "admin-1",
        reasonCode: VOID_FALSE_EXECUTION_REASON_CODE,
        operatorNote: "Nota operacional válida para anulação de falso positivo.",
        operatorAttestation: fullAttestation,
        adminConfirmation: VOID_FALSE_EXECUTION_CONFIRM_PHRASE,
      })
    ).rejects.toMatchObject({ code: "INSTRUCTION_NOT_FOUND", status: 404 });
  });

  it("instruction já anulada não pode ser anulada de novo", async () => {
    vi.mocked(prisma.instruction.findUnique).mockResolvedValue({
      ...baseInstruction,
      currentStatus: OrderLogStatus.VOIDED_FALSE_EXECUTION,
      statusLogs: [{ status: OrderLogStatus.VOIDED_FALSE_EXECUTION, metadata: {} }],
    } as never);

    await expect(
      voidRealManualFalseExecution({
        instructionId,
        actorId: "admin-1",
        reasonCode: VOID_FALSE_EXECUTION_REASON_CODE,
        operatorNote: "Nota operacional válida para anulação de falso positivo.",
        operatorAttestation: fullAttestation,
        adminConfirmation: VOID_FALSE_EXECUTION_CONFIRM_PHRASE,
      })
    ).rejects.toMatchObject({ code: "REAL_MANUAL_ALREADY_VOIDED" });
  });

  it("anula com status VOIDED_FALSE_EXECUTION e audit", async () => {
    const result = await voidRealManualFalseExecution({
      instructionId,
      actorId: "admin-1",
      reasonCode: VOID_FALSE_EXECUTION_REASON_CODE,
      operatorNote:
        "Retorno de execução preenchida foi falso positivo por falha/rejeição interna da B3/bolsa/broker. Verificado no MT5: nenhuma ordem pendente, nenhuma posição aberta e nenhuma exposição de risco.",
      operatorAttestation: fullAttestation,
      adminConfirmation: VOID_FALSE_EXECUTION_CONFIRM_PHRASE,
    });

    expect(result.status).toBe(OrderLogStatus.VOIDED_FALSE_EXECUTION);
    expect(result.executionStatus).toBe(ExecutionStatus.VOIDED);
    expect(result.protectionStatus).toBe(ProtectionStatus.SKIPPED_NO_POSITION);
    expect(result.reasonCode).toBe(VOID_FALSE_EXECUTION_REASON_CODE);
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "real_trading.instruction.void_false_execution",
      })
    );

    const instUpdate = vi.mocked(prisma.instruction.update).mock.calls[0]?.[0];
    expect(instUpdate?.data?.currentStatus).toBe(OrderLogStatus.VOIDED_FALSE_EXECUTION);

    const exUpdate = vi.mocked(prisma.execution.update).mock.calls[0]?.[0];
    expect(exUpdate?.data?.status).toBe(ExecutionStatus.VOIDED);
  });

  it("hasVoidedFalseExecutionInLogs detecta VOIDED_FALSE_EXECUTION", () => {
    expect(
      hasVoidedFalseExecutionInLogs([
        { status: OrderLogStatus.VOIDED_FALSE_EXECUTION, metadata: null },
      ])
    ).toBe(true);
  });
});
