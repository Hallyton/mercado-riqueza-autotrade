import { describe, expect, it, vi, beforeEach } from "vitest";
import { RealTradingApprovalStatus } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  default: {
    license: { findUnique: vi.fn() },
    realTradingApproval: { create: vi.fn() },
  },
}));

vi.mock("@/lib/admin/record-action", () => ({
  recordAdminAction: vi.fn(),
}));

import prisma from "@/lib/prisma";
import {
  createRealTradingApproval,
  RealTradingApprovalError,
} from "@/lib/admin/real-trading-approval";

describe("createRealTradingApproval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejeita magicNumber fora da faixa", async () => {
    await expect(
      createRealTradingApproval({
        user_id: "u1",
        license_id: "l1",
        account_login: "1",
        account_server: "S",
        symbol: "WIN",
        magic_number: 1,
        actorId: "admin-1",
      })
    ).rejects.toBeInstanceOf(RealTradingApprovalError);
  });

  it("cria approval aprovado quando solicitado", async () => {
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
      user_id: "u1",
      license_id: "l1",
      account_login: "52609973",
      account_server: "XPMT5-REAL",
      symbol: "WDOM26",
      magic_number: 910001,
      approve_immediately: true,
      actorId: "admin-1",
    });

    expect(approval.allowReal).toBe(true);
    expect(prisma.realTradingApproval.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: RealTradingApprovalStatus.APPROVED,
          allowReal: true,
        }),
      })
    );
  });
});
