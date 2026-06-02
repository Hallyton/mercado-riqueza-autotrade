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
  executionIndicatesOrderNotPlaced,
  hasClosedNoOrderInLogs,
  hasSuccessfulBrokerFill,
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
  requiresProtectionConfirmation: true,
  statusLogs: [],
  executions: [
    {
      id: "ex-1",
      status: ExecutionStatus.REJECTED,
      executedAt: new Date(),
      brokerTicket: null,
      errorCode: "BROKER_REJECT",
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

  it("exibe painel para EXECUTED + REJECTED + PROTECTION_PENDING", () => {
    const eligibility = evaluateCloseNoOrderEligibility({
      source: InstructionSource.REAL_MANUAL,
      currentStatus: OrderLogStatus.EXECUTED,
      statusLogs: [],
      executions: [{ status: ExecutionStatus.REJECTED, errorCode: "X" }],
      protectionReports: [{ protectionStatus: ProtectionStatus.PROTECTION_PENDING }],
      requiresProtectionConfirmation: true,
      exposure: noExposure,
    });
    expect(eligibility.showAdminActionsCard).toBe(true);
    expect(eligibility.canCloseNoOrder).toBe(true);
    expect(eligibility.canShowClosePanel).toBe(true);
  });

  it("mantém elegível com execução antiga FILLED e mais recente REJECTED", () => {
    const executions = [
      { status: ExecutionStatus.REJECTED, brokerTicket: null, errorCode: "ERR" },
      { status: ExecutionStatus.FILLED, brokerTicket: "12345" },
    ];
    expect(hasSuccessfulBrokerFill(executions)).toBe(false);
    expect(
      executionIndicatesOrderNotPlaced(executions, OrderLogStatus.EXECUTED)
    ).toBe(true);

    const eligibility = evaluateCloseNoOrderEligibility({
      source: InstructionSource.REAL_MANUAL,
      currentStatus: OrderLogStatus.EXECUTED,
      statusLogs: [],
      executions,
      protectionReports: [{ protectionStatus: ProtectionStatus.PROTECTION_PENDING }],
      requiresProtectionConfirmation: true,
      exposure: noExposure,
    });
    expect(eligibility.canCloseNoOrder).toBe(true);
  });

  it("não exibe card quando ORDER_NOT_PLACED", () => {
    const eligibility = evaluateCloseNoOrderEligibility({
      source: InstructionSource.REAL_MANUAL,
      currentStatus: OrderLogStatus.ORDER_NOT_PLACED,
      statusLogs: [],
      executions: [],
      protectionReports: [],
      exposure: noExposure,
    });
    expect(eligibility.showAdminActionsCard).toBe(false);
  });

  it("não permite encerrar com PROTECTION_CONFIRMED", () => {
    const eligibility = evaluateCloseNoOrderEligibility({
      source: InstructionSource.REAL_MANUAL,
      currentStatus: OrderLogStatus.EXECUTED,
      statusLogs: [],
      executions: [{ status: ExecutionStatus.REJECTED }],
      protectionReports: [{ protectionStatus: ProtectionStatus.PROTECTION_CONFIRMED }],
      exposure: noExposure,
    });
    expect(eligibility.showAdminActionsCard).toBe(true);
    expect(eligibility.canCloseNoOrder).toBe(false);
  });

  it("não exibe ação com PROTECTION_FAILED", () => {
    const eligibility = evaluateCloseNoOrderEligibility({
      source: InstructionSource.REAL_MANUAL,
      currentStatus: OrderLogStatus.EXECUTED,
      statusLogs: [],
      executions: [{ status: ExecutionStatus.REJECTED }],
      protectionReports: [{ protectionStatus: ProtectionStatus.PROTECTION_FAILED }],
      exposure: noExposure,
    });
    expect(eligibility.canCloseNoOrder).toBe(false);
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

  it("encerra com atestação e audit", async () => {
    const result = await closeRealManualInstructionNoOrder({
      instructionId,
      actorId: "admin-1",
      reasonCode: CLOSE_NO_ORDER_REASON_CODE,
      operatorNote:
        "Ordem LIMIT não foi apregoada no MT5 por falha/rejeição da bolsa. Nenhuma ordem pendente.",
      operatorAttestation: fullAttestation,
      adminConfirmation: CLOSE_NO_ORDER_CONFIRM_PHRASE,
    });

    expect(result.status).toBe(OrderLogStatus.ORDER_NOT_PLACED);
    expect(recordAdminAction).toHaveBeenCalled();
  });

  it("hasClosedNoOrderInLogs detecta CLOSED_NO_ORDER", () => {
    expect(
      hasClosedNoOrderInLogs([
        { status: OrderLogStatus.REJECTED, metadata: { event: "CLOSED_NO_ORDER" } },
      ])
    ).toBe(true);
  });
});
