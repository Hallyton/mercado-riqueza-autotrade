import { describe, expect, it, vi, beforeEach } from "vitest";
import { InstructionPurpose, OrderLogStatus } from "@prisma/client";

const {
  licenseFind,
  instructionCreate,
  statusLogCreate,
  transaction,
  recordAdminAction,
  assertInstructionAllowed,
} = vi.hoisted(() => ({
  licenseFind: vi.fn(),
  instructionCreate: vi.fn(),
  statusLogCreate: vi.fn(),
  transaction: vi.fn(),
  recordAdminAction: vi.fn(),
  assertInstructionAllowed: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    license: { findUnique: licenseFind },
    $transaction: transaction,
  },
}));

vi.mock("@/lib/admin/record-action", () => ({
  recordAdminAction,
}));

vi.mock("@/lib/licensing/instruction-policy", () => ({
  assertInstructionAllowed,
  LicensePolicyError: class LicensePolicyError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  },
}));

import {
  AdminInstructionDispatchError,
  createAdminDispatchedInstruction,
  createAdminInstructionSchema,
  normalizeOptionalPositiveNumber,
} from "@/lib/admin/instruction-dispatch";
import { LicensePolicyError } from "@/lib/licensing/instruction-policy";

describe("createAdminInstructionSchema", () => {
  it("validates required fields", () => {
    const ok = createAdminInstructionSchema.safeParse({
      license_id: "lic_1",
      source: "TEST",
      symbol: "PETR4",
      side: "BUY",
      quantity: 100,
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.purpose).toBe("ENTRY");
      expect(ok.data.order_type).toBe("MARKET");
      expect(ok.data.expires_in_minutes).toBe(60);
    }
  });

  it("rejects invalid source", () => {
    const bad = createAdminInstructionSchema.safeParse({
      license_id: "lic_1",
      source: "LIVE",
      symbol: "PETR4",
      side: "BUY",
      quantity: 100,
    });
    expect(bad.success).toBe(false);
  });

  it("aceita payload sem take_profit nem stop_loss", () => {
    const ok = createAdminInstructionSchema.safeParse({
      license_id: "lic_1",
      source: "TEST",
      symbol: "PETR4",
      side: "BUY",
      quantity: 100,
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.take_profit).toBeUndefined();
      expect(ok.data.stop_loss).toBeUndefined();
    }
  });

  it("trata string vazia e null como ausente no preprocess", () => {
    expect(normalizeOptionalPositiveNumber("")).toBeUndefined();
    expect(normalizeOptionalPositiveNumber(null)).toBeUndefined();
    expect(normalizeOptionalPositiveNumber(undefined)).toBeUndefined();
    expect(normalizeOptionalPositiveNumber(0)).toBe(0);
  });

  it("rejeita take_profit 0 quando informado", () => {
    const bad = createAdminInstructionSchema.safeParse({
      license_id: "lic_1",
      source: "TEST",
      symbol: "PETR4",
      side: "BUY",
      quantity: 100,
      take_profit: 0,
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.path.includes("take_profit"))).toBe(
        true
      );
    }
  });

  it("rejeita take_profit negativo quando informado", () => {
    const bad = createAdminInstructionSchema.safeParse({
      license_id: "lic_1",
      source: "TEST",
      symbol: "PETR4",
      side: "BUY",
      quantity: 100,
      take_profit: -1,
    });
    expect(bad.success).toBe(false);
  });

  it("aceita take_profit positivo quando informado", () => {
    const ok = createAdminInstructionSchema.safeParse({
      license_id: "lic_1",
      source: "TEST",
      symbol: "PETR4",
      side: "BUY",
      quantity: 100,
      take_profit: 32.5,
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.take_profit).toBe(32.5);
    }
  });
});

describe("createAdminDispatchedInstruction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertInstructionAllowed.mockResolvedValue(undefined);
    recordAdminAction.mockResolvedValue({ id: "act_1" });
  });

  it("creates instruction with TEST source and audit", async () => {
    licenseFind.mockResolvedValue({
      id: "lic_1",
      user: { email: "client@example.com" },
      subscription: { plan: { name: "Pro" } },
    });

    const created = {
      id: "inst_1",
      currentStatus: OrderLogStatus.RECEIVED,
      symbol: "PETR4",
    };

    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        instruction: { create: instructionCreate },
        instructionStatusLog: { create: statusLogCreate },
      };
      instructionCreate.mockResolvedValue(created);
      statusLogCreate.mockResolvedValue({});
      return fn(tx);
    });

    const result = await createAdminDispatchedInstruction({
      license_id: "lic_1",
      source: "TEST",
      symbol: "petr4",
      side: "BUY",
      purpose: "ENTRY",
      order_type: "MARKET",
      quantity: 50,
      expires_in_minutes: 30,
      actorId: "admin_1",
      ipAddress: "127.0.0.1",
    });

    expect(assertInstructionAllowed).toHaveBeenCalledWith(
      "lic_1",
      InstructionPurpose.ENTRY
    );
    expect(instructionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          licenseId: "lic_1",
          source: "TEST",
          symbol: "PETR4",
          currentStatus: OrderLogStatus.RECEIVED,
        }),
      })
    );
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.instruction.dispatch",
        targetType: "instruction",
        targetId: "inst_1",
      })
    );
    expect(result.instructionId).toBe("inst_1");
    expect(result.source).toBe("TEST");
  });

  it("returns 404 when license missing", async () => {
    licenseFind.mockResolvedValue(null);
    await expect(
      createAdminDispatchedInstruction({
        license_id: "missing",
        source: "HOMOLOGATION",
        symbol: "VALE3",
        side: "SELL",
        purpose: "ENTRY",
        order_type: "MARKET",
        quantity: 10,
        expires_in_minutes: 60,
        actorId: "admin_1",
      })
    ).rejects.toMatchObject({
      code: "LICENSE_NOT_FOUND",
      status: 404,
    });
  });

  it("maps license policy errors to 403", async () => {
    licenseFind.mockResolvedValue({
      id: "lic_1",
      user: { email: "c@x.com" },
      subscription: {},
    });
    assertInstructionAllowed.mockRejectedValue(
      new LicensePolicyError("Entradas pausadas", "ENTRIES_HALTED")
    );

    await expect(
      createAdminDispatchedInstruction({
        license_id: "lic_1",
        source: "TEST",
        symbol: "PETR4",
        side: "BUY",
        purpose: "ENTRY",
        order_type: "MARKET",
        quantity: 1,
        expires_in_minutes: 60,
        actorId: "admin_1",
      })
    ).rejects.toBeInstanceOf(AdminInstructionDispatchError);
  });
});
