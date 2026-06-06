import { beforeEach, describe, expect, it, vi } from "vitest";
import { LicenseStatus, RealTradingApprovalStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  license: { findUnique: vi.fn() },
  realTradingApproval: {
    create: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

vi.mock("@/lib/admin/record-action", () => ({
  recordAdminAction: vi.fn().mockResolvedValue({ id: "action1" }),
}));

import { recordAdminAction } from "@/lib/admin/record-action";
import {
  createRealTradingApprovalTraced,
  mapApprovalCreateZodError,
  RealTradingApprovalCreateError,
} from "@/lib/admin/real-trading-approval-create";
import { REAL_TRADING_APPROVAL_CONFIRM_PHRASE } from "@/lib/admin/real-trading-approval";

const baseInput = {
  user_id: "u1",
  license_id: "l1",
  account_login: "19583778",
  account_server: "XPMT5-PRD",
  symbol: "WDON26",
  magic_number: 910001,
  max_contracts: 5,
  min_free_margin: 1500,
  margin_buffer_percent: 15,
  admin_confirmation: REAL_TRADING_APPROVAL_CONFIRM_PHRASE,
};

describe("createRealTradingApprovalTraced", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.license.findUnique.mockResolvedValue({
      id: "l1",
      userId: "u1",
      status: LicenseStatus.ACTIVE,
      mt5Account: { login: "19583778", server: "XPMT5-PRD" },
    });
    prismaMock.realTradingApproval.findUnique.mockResolvedValue(null);
    prismaMock.realTradingApproval.create.mockResolvedValue({
      id: "appr-new",
      status: RealTradingApprovalStatus.APPROVED,
    });
  });

  it("creates approval and records success audit", async () => {
    const result = await createRealTradingApprovalTraced({
      ...baseInput,
      actorId: "admin1",
      requestId: "req-ok-1",
    });

    expect(result.approval.id).toBe("appr-new");
    expect(result.requestId).toBe("req-ok-1");
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "real_trading.approval.created",
        metadata: expect.objectContaining({
          requestId: "req-ok-1",
          approvalId: "appr-new",
          maxContracts: 5,
        }),
      })
    );
  });

  it("returns LICENSE_NOT_FOUND when license/user mismatch", async () => {
    prismaMock.license.findUnique.mockResolvedValue(null);

    await expect(
      createRealTradingApprovalTraced({
        ...baseInput,
        actorId: "admin1",
        requestId: "req-lic-1",
      })
    ).rejects.toMatchObject({
      code: "LICENSE_NOT_FOUND",
    });

    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "real_trading.approval.create_failed" })
    );
  });

  it("returns APPROVAL_ALREADY_EXISTS with existingApprovalId", async () => {
    prismaMock.realTradingApproval.findUnique.mockResolvedValue({
      id: "appr-existing",
      status: RealTradingApprovalStatus.APPROVED,
      allowReal: true,
      revokedAt: null,
      maxContracts: 5,
    });

    await expect(
      createRealTradingApprovalTraced({
        ...baseInput,
        actorId: "admin1",
        requestId: "req-dup-1",
      })
    ).rejects.toMatchObject({
      code: "APPROVAL_ALREADY_EXISTS",
      options: expect.objectContaining({ existingApprovalId: "appr-existing" }),
    });
  });

  it("returns ACTIVE_APPROVAL_CONFLICT when maxContracts differs", async () => {
    prismaMock.realTradingApproval.findUnique.mockResolvedValue({
      id: "appr-existing",
      status: RealTradingApprovalStatus.APPROVED,
      allowReal: true,
      revokedAt: null,
      maxContracts: 1,
    });

    await expect(
      createRealTradingApprovalTraced({
        ...baseInput,
        max_contracts: 5,
        actorId: "admin1",
        requestId: "req-conflict-1",
      })
    ).rejects.toMatchObject({
      code: "ACTIVE_APPROVAL_CONFLICT",
    });
  });

  it("maps Prisma unique constraint to DATABASE_UNIQUE_CONSTRAINT", async () => {
    prismaMock.realTradingApproval.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique", {
        code: "P2002",
        clientVersion: "test",
      })
    );

    await expect(
      createRealTradingApprovalTraced({
        ...baseInput,
        actorId: "admin1",
        requestId: "req-db-1",
      })
    ).rejects.toMatchObject({
      code: "DATABASE_UNIQUE_CONSTRAINT",
    });
  });

  it("maps invalid confirmation to ADMIN_CONFIRMATION_INVALID", () => {
    const parsed = mapApprovalCreateZodError(
      {
        issues: [
          {
            code: "custom",
            message: "Invalid",
            path: ["admin_confirmation"],
          },
        ],
      } as never,
      "req-zod-1",
      { ...baseInput, admin_confirmation: "ERRADO" }
    );

    expect(parsed.code).toBe("ADMIN_CONFIRMATION_INVALID");
    expect(parsed.toPayload().requestId).toBe("req-zod-1");
  });

  it("payload does not include confirmation phrase in audit metadata", async () => {
    await createRealTradingApprovalTraced({
      ...baseInput,
      actorId: "admin1",
      requestId: "req-redact-1",
    });

    const call = vi.mocked(recordAdminAction).mock.calls.find(
      (c) => c[0].action === "real_trading.approval.created"
    );
    expect(call?.[0].metadata).not.toHaveProperty("admin_confirmation");
    expect(JSON.stringify(call?.[0].metadata)).not.toContain(
      REAL_TRADING_APPROVAL_CONFIRM_PHRASE
    );
  });
});

describe("RealTradingApprovalCreateError payload", () => {
  it("includes links for existing approval", () => {
    const err = new RealTradingApprovalCreateError(
      "dup",
      "APPROVAL_ALREADY_EXISTS",
      409,
      {
        requestId: "req-1",
        existingApprovalId: "appr-1",
        links: {
          existingApproval: "/admin/real-trading/approvals/appr-1",
        },
      }
    );
    expect(err.toPayload().links?.existingApproval).toContain("appr-1");
  });
});
