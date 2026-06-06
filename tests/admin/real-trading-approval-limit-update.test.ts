import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, RealTradingApprovalStatus } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  realTradingApproval: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  instruction: { create: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

vi.mock("@/lib/admin/record-action", () => ({
  recordAdminAction: vi.fn().mockResolvedValue({ id: "action1" }),
}));

import { recordAdminAction } from "@/lib/admin/record-action";
import {
  REAL_TRADING_APPROVAL_LIMIT_EDIT_PHRASE,
  updateRealTradingApprovalLimits,
  updateRealTradingApprovalLimitsSchema,
  RealTradingApprovalLimitUpdateError,
  isRealTradingApprovalLimitPatchBody,
  mapApprovalLimitUpdateZodError,
} from "@/lib/admin/real-trading-approval-limit-update";

const baseApproval = {
  id: "appr-1",
  userId: "u1",
  licenseId: "lic1",
  accountLogin: "19583778",
  accountServer: "XPMT5-PRD",
  symbol: "WDON26",
  magicNumber: 910001,
  maxContracts: 1,
  minFreeMargin: new Prisma.Decimal(1500),
  marginBufferPercent: new Prisma.Decimal(15),
  allowReal: true,
  status: RealTradingApprovalStatus.APPROVED,
  revokedAt: null,
  notes: "nota antiga",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-02"),
};

const validInput = {
  max_contracts: 5,
  min_free_margin: 1500,
  margin_buffer_percent: 15,
  admin_notes: "Aumento para Fibo D1",
  admin_confirmation: REAL_TRADING_APPROVAL_LIMIT_EDIT_PHRASE,
};

describe("updateRealTradingApprovalLimits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.realTradingApproval.findUnique.mockResolvedValue(baseApproval);
    prismaMock.realTradingApproval.update.mockImplementation(async ({ data }) => ({
      ...baseApproval,
      ...data,
      minFreeMargin: new Prisma.Decimal(data.minFreeMargin ?? 1500),
      marginBufferPercent: new Prisma.Decimal(data.marginBufferPercent ?? 15),
      updatedAt: new Date(),
    }));
  });

  it("updates maxContracts from 1 to 5 and records audit", async () => {
    const result = await updateRealTradingApprovalLimits("appr-1", {
      ...validInput,
      actorId: "admin1",
      requestId: "req-update-1",
    });

    expect(result.previous.maxContracts).toBe(1);
    expect(result.current.maxContracts).toBe(5);
    expect(prismaMock.realTradingApproval.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "appr-1" },
        data: expect.objectContaining({
          maxContracts: 5,
        }),
      })
    );
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "real_trading.approval.limit_updated",
        metadata: expect.objectContaining({
          requestId: "req-update-1",
          previousMaxContracts: 1,
          newMaxContracts: 5,
          previousMarginFreeMin: 1500,
          newMarginFreeMin: 1500,
        }),
      })
    );
    expect(prismaMock.instruction.create).not.toHaveBeenCalled();
  });

  it("returns APPROVAL_NOT_FOUND when missing", async () => {
    prismaMock.realTradingApproval.findUnique.mockResolvedValue(null);

    await expect(
      updateRealTradingApprovalLimits("missing", {
        ...validInput,
        actorId: "admin1",
        requestId: "req-nf",
      })
    ).rejects.toMatchObject({ code: "APPROVAL_NOT_FOUND" });
  });

  it("blocks non-editable approval status", async () => {
    prismaMock.realTradingApproval.findUnique.mockResolvedValue({
      ...baseApproval,
      status: RealTradingApprovalStatus.REVOKED,
      allowReal: false,
    });

    await expect(
      updateRealTradingApprovalLimits("appr-1", {
        ...validInput,
        actorId: "admin1",
        requestId: "req-ne",
      })
    ).rejects.toMatchObject({ code: "APPROVAL_NOT_EDITABLE" });
  });

  it("schema rejects wrong confirmation phrase", () => {
    const parsed = updateRealTradingApprovalLimitsSchema.safeParse({
      ...validInput,
      admin_confirmation: "ERRADO",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const err = mapApprovalLimitUpdateZodError(parsed.error, "req-zod");
      expect(err.code).toBe("ADMIN_CONFIRMATION_INVALID");
    }
  });

  it("schema rejects invalid maxContracts", () => {
    const parsed = updateRealTradingApprovalLimitsSchema.safeParse({
      ...validInput,
      max_contracts: 0,
    });
    expect(parsed.success).toBe(false);
  });

  it("schema rejects identity fields in payload (strict)", () => {
    const parsed = updateRealTradingApprovalLimitsSchema.safeParse({
      ...validInput,
      license_id: "other",
      account_login: "999",
    });
    expect(parsed.success).toBe(false);
  });

  it("does not change identity columns in update data", async () => {
    await updateRealTradingApprovalLimits("appr-1", {
      ...validInput,
      actorId: "admin1",
      requestId: "req-id",
    });

    const updateCall = prismaMock.realTradingApproval.update.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty("accountLogin");
    expect(updateCall.data).not.toHaveProperty("licenseId");
    expect(updateCall.data).not.toHaveProperty("symbol");
    expect(updateCall.data).not.toHaveProperty("magicNumber");
    expect(updateCall.data).not.toHaveProperty("accountServer");
  });

  it("error payload includes requestId", () => {
    const err = new RealTradingApprovalLimitUpdateError(
      "fail",
      "MAX_CONTRACTS_INVALID",
      400,
      { requestId: "req-err" }
    );
    expect(err.toPayload().requestId).toBe("req-err");
  });
});

describe("isRealTradingApprovalLimitPatchBody", () => {
  it("detects limit patch payload", () => {
    expect(
      isRealTradingApprovalLimitPatchBody({
        max_contracts: 5,
        admin_confirmation: REAL_TRADING_APPROVAL_LIMIT_EDIT_PHRASE,
      })
    ).toBe(true);
  });

  it("rejects lifecycle action payload", () => {
    expect(
      isRealTradingApprovalLimitPatchBody({
        action: "revoke",
        admin_confirmation: "REVOGAR",
      })
    ).toBe(false);
  });
});

describe("RealTradingApprovalLimitEditPanel (UI contract)", () => {
  it("exports panel component and edit phrase", async () => {
    const mod = await import("@/components/admin/real-trading-approval-limit-edit");
    expect(mod.RealTradingApprovalLimitEditPanel).toBeDefined();
    expect(REAL_TRADING_APPROVAL_LIMIT_EDIT_PHRASE).toBe(
      "ALTERAR LIMITE OPERACIONAL REAL"
    );
  });
});

describe("creation conflict links to approval detail", () => {
  it("existingApproval link targets detail page", async () => {
    const { RealTradingApprovalCreateError } = await import(
      "@/lib/admin/real-trading-approval-create"
    );
    const err = new RealTradingApprovalCreateError(
      "conflict",
      "ACTIVE_APPROVAL_CONFLICT",
      409,
      {
        requestId: "req-c",
        existingApprovalId: "appr-eilane",
        links: {
          existingApproval: "/admin/real-trading/approvals/appr-eilane",
        },
      }
    );
    expect(err.toPayload().links?.existingApproval).toBe(
      "/admin/real-trading/approvals/appr-eilane"
    );
  });
});
