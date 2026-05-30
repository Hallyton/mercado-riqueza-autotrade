import { describe, expect, it, vi, beforeEach } from "vitest";
import { RealTradingApprovalStatus } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  default: {
    license: { findUnique: vi.fn() },
    realTradingApproval: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/admin/record-action", () => ({
  recordAdminAction: vi.fn(),
}));

import prisma from "@/lib/prisma";
import {
  applyRealTradingApprovalAction,
  createRealTradingApproval,
  createRealTradingApprovalSchema,
  REAL_TRADING_APPROVAL_CONFIRM_PHRASE,
  RealTradingApprovalError,
} from "@/lib/admin/real-trading-approval";

const validInput = {
  user_id: "u1",
  license_id: "l1",
  account_login: "52609973",
  account_server: "XPMT5-REAL",
  symbol: "WDOM26",
  magic_number: 910001,
  max_contracts: 1,
  min_free_margin: 5000,
  margin_buffer_percent: 15,
  admin_confirmation: REAL_TRADING_APPROVAL_CONFIRM_PHRASE,
};

describe("createRealTradingApproval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejeita magicNumber fora da faixa", async () => {
    await expect(
      createRealTradingApproval({
        ...validInput,
        magic_number: 1,
        actorId: "admin-1",
      })
    ).rejects.toBeInstanceOf(RealTradingApprovalError);
  });

  it("não cria sem frase AUTORIZO REAL CONTROLADO", () => {
    const parsed = createRealTradingApprovalSchema.safeParse({
      ...validInput,
      admin_confirmation: "ERRADO",
    });
    expect(parsed.success).toBe(false);
  });

  it("cria approval APPROVED com confirmação correta", async () => {
    vi.mocked(prisma.license.findUnique).mockResolvedValue({
      id: "l1",
      userId: "u1",
    } as never);
    vi.mocked(prisma.realTradingApproval.create).mockResolvedValue({
      id: "appr-1",
      status: RealTradingApprovalStatus.APPROVED,
      allowReal: true,
    } as never);

    const approval = await createRealTradingApproval({
      ...validInput,
      actorId: "admin-1",
    });

    expect(approval.allowReal).toBe(true);
    expect(prisma.realTradingApproval.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: RealTradingApprovalStatus.APPROVED,
          allowReal: true,
          maxContracts: 1,
        }),
      })
    );
  });

  it("exige min_free_margin positivo no schema", () => {
    const parsed = createRealTradingApprovalSchema.safeParse({
      ...validInput,
      min_free_margin: 0,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("applyRealTradingApprovalAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não suspende sem frase correta", async () => {
    vi.mocked(prisma.realTradingApproval.findUnique).mockResolvedValue({
      id: "appr-1",
      status: RealTradingApprovalStatus.APPROVED,
      licenseId: "l1",
    } as never);

    await expect(
      applyRealTradingApprovalAction("appr-1", {
        action: "suspend",
        adminConfirmation: "errado",
        actorId: "admin-1",
      })
    ).rejects.toBeInstanceOf(RealTradingApprovalError);
  });

  it("suspende com confirmação correta", async () => {
    vi.mocked(prisma.realTradingApproval.findUnique).mockResolvedValue({
      id: "appr-1",
      status: RealTradingApprovalStatus.APPROVED,
      licenseId: "l1",
      revokedAt: null,
    } as never);
    vi.mocked(prisma.realTradingApproval.update).mockResolvedValue({
      id: "appr-1",
      status: RealTradingApprovalStatus.SUSPENDED,
      allowReal: false,
    } as never);

    const result = await applyRealTradingApprovalAction("appr-1", {
      action: "suspend",
      adminConfirmation: "SUSPENDER REAL",
      actorId: "admin-1",
    });

    expect(result.status).toBe(RealTradingApprovalStatus.SUSPENDED);
    expect(result.allowReal).toBe(false);
  });
});
