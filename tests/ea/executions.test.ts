import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  ExecutionStatus,
  InstructionPurpose,
  OrderLogStatus,
  LicenseStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

vi.mock("@/lib/prisma", () => ({
  default: {
    instruction: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    execution: { create: vi.fn(), findFirst: vi.fn() },
    instructionStatusLog: { create: vi.fn() },
    eaHeartbeat: { findFirst: vi.fn() },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));

vi.mock("@/lib/audit/log", () => ({
  createAuditLog: vi.fn(),
}));

vi.mock("@/lib/licensing/instruction-policy", () => ({
  assertInstructionAllowed: vi.fn(),
}));

import prisma from "@/lib/prisma";
import {
  executionBodySchema,
  normalizeEaExecutedAt,
} from "@/lib/ea/schemas";
import { reportExecution } from "@/lib/ea/instructions";
import { assertInstructionAllowed } from "@/lib/licensing/instruction-policy";

const ctx = {
  license: {
    id: "lic1",
    userId: "user1",
    status: LicenseStatus.ACTIVE,
  },
  requestId: "req-exec-1",
} as const;

/** Payload equivalente ao EA em DebugMode após correção. */
const debugModePayload = {
  instruction_id: "inst-debug-1",
  status: "FILLED" as const,
  broker_ticket: "DEBUG",
  fill_price: 28.5,
  fill_quantity: 100,
  executed_at: "2026-05-20T18:30:00Z",
};

describe("executionBodySchema", () => {
  it("aceita payload DebugMode (FILLED + broker_ticket DEBUG)", () => {
    const parsed = executionBodySchema.safeParse(debugModePayload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.status).toBe("FILLED");
      expect(parsed.data.broker_ticket).toBe("DEBUG");
    }
  });

  it("normaliza executed_at formato MT5 legado", () => {
    expect(normalizeEaExecutedAt("2026.05.20 18:30:00")).toBe(
      "2026-05-20T18:30:00Z"
    );
    const parsed = executionBodySchema.safeParse({
      ...debugModePayload,
      executed_at: "2026.05.20 18:30:00",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejeita status inválido", () => {
    const bad = executionBodySchema.safeParse({
      ...debugModePayload,
      status: "EXECUTED",
    });
    expect(bad.success).toBe(false);
  });

  it("rejeita executed_at inválido", () => {
    const bad = executionBodySchema.safeParse({
      ...debugModePayload,
      executed_at: "not-a-date",
    });
    expect(bad.success).toBe(false);
  });
});

describe("reportExecution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertInstructionAllowed).mockResolvedValue(undefined);
    vi.mocked(prisma.eaHeartbeat.findFirst).mockResolvedValue({
      tradeMode: "DEMO",
    } as never);
    vi.mocked(prisma.execution.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.instruction.findFirst).mockResolvedValue({
      id: "inst-debug-1",
      licenseId: "lic1",
      purpose: InstructionPurpose.ENTRY,
      currentStatus: OrderLogStatus.SENT,
      magicNumber: null,
      protectionBlocked: false,
    } as never);
    vi.mocked(prisma.execution.create).mockResolvedValue({ id: "ex1" } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (ops) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return ops(prisma);
    });
  });

  it("cria execution e status EXECUTED para FILLED", async () => {
    const result = await reportExecution(ctx as never, debugModePayload);

    expect(result.ok).toBe(true);
    expect(result.orderStatus).toBe(OrderLogStatus.EXECUTED);
    expect(prisma.execution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          instructionId: "inst-debug-1",
          status: "FILLED",
          brokerTicket: "DEBUG",
        }),
      })
    );
    expect(prisma.instruction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inst-debug-1" },
        data: { currentStatus: OrderLogStatus.EXECUTED },
      })
    );
  });

  it("não duplica execution FILLED para o mesmo instruction_id", async () => {
    vi.mocked(prisma.execution.findFirst).mockResolvedValue({
      id: "ex-existing",
      instructionId: "inst-debug-1",
      status: ExecutionStatus.FILLED,
      executedAt: new Date(),
    } as never);

    const result = await reportExecution(ctx as never, debugModePayload);

    expect(result.ok).toBe(true);
    expect(result.idempotent).toBe(true);
    expect(result.orderStatus).toBe(OrderLogStatus.EXECUTED);
    expect(prisma.execution.create).not.toHaveBeenCalled();
    expect(prisma.instruction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inst-debug-1" },
        data: { currentStatus: OrderLogStatus.EXECUTED },
      })
    );
  });

  it("não duplica execution REJECTED em retry de OrderSend rejeitado", async () => {
    vi.mocked(prisma.execution.findFirst).mockResolvedValue({
      id: "ex-rejected",
      instructionId: "inst-debug-1",
      status: ExecutionStatus.REJECTED,
      executedAt: new Date(),
    } as never);

    const result = await reportExecution(ctx as never, {
      instruction_id: "inst-debug-1",
      status: "REJECTED",
      error_code: "BROKER_REJECT",
      error_message: "Mercado fechado",
    });

    expect(result.ok).toBe(true);
    expect(result.idempotent).toBe(true);
    expect(result.orderStatus).toBe(OrderLogStatus.REJECTED);
    expect(prisma.execution.create).not.toHaveBeenCalled();
    expect(prisma.instruction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inst-debug-1" },
        data: { currentStatus: OrderLogStatus.REJECTED },
      })
    );
  });

  it("não sobrescreve terminal REJECTED com retry posterior FILLED", async () => {
    vi.mocked(prisma.execution.findFirst).mockResolvedValue({
      id: "ex-rejected",
      instructionId: "inst-debug-1",
      status: ExecutionStatus.REJECTED,
      executedAt: new Date(),
    } as never);
    vi.mocked(prisma.instruction.findFirst).mockResolvedValue({
      id: "inst-debug-1",
      licenseId: "lic1",
      purpose: InstructionPurpose.ENTRY,
      currentStatus: OrderLogStatus.REJECTED,
    } as never);

    const result = await reportExecution(ctx as never, debugModePayload);

    expect(result.ok).toBe(true);
    expect(result.idempotent).toBe(true);
    expect(result.orderStatus).toBe(OrderLogStatus.REJECTED);
    expect(prisma.execution.create).not.toHaveBeenCalled();
    expect(prisma.instruction.update).not.toHaveBeenCalled();
  });

  it("redige erro sensível de OrderSend antes de persistir execution e status log", async () => {
    const result = await reportExecution(ctx as never, {
      instruction_id: "inst-debug-1",
      status: "REJECTED",
      error_code: "BROKER_REJECT",
      error_message: "OrderSend failed Authorization: Bearer raw-token AUTH_SECRET=raw",
    });

    expect(result.ok).toBe(true);
    expect(result.orderStatus).toBe(OrderLogStatus.REJECTED);
    expect(prisma.execution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          errorMessage: "[REDACTED]",
        }),
      })
    );
    expect(prisma.instructionStatusLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: OrderLogStatus.REJECTED,
          message: "[REDACTED]",
        }),
      })
    );
  });

  it("idempotente quando instrução já está EXECUTED", async () => {
    vi.mocked(prisma.execution.findFirst).mockResolvedValue({
      id: "ex-existing",
      instructionId: "inst-debug-1",
      status: ExecutionStatus.FILLED,
      executedAt: new Date(),
    } as never);
    vi.mocked(prisma.instruction.findFirst).mockResolvedValue({
      id: "inst-debug-1",
      licenseId: "lic1",
      purpose: InstructionPurpose.ENTRY,
      currentStatus: OrderLogStatus.EXECUTED,
    } as never);

    const result = await reportExecution(ctx as never, debugModePayload);

    expect(result.ok).toBe(true);
    expect(result.idempotent).toBe(true);
    expect(prisma.execution.create).not.toHaveBeenCalled();
    expect(prisma.instruction.update).not.toHaveBeenCalled();
  });
});
