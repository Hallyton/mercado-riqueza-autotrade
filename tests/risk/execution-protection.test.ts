import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  OrderLogStatus,
  ProtectionStatus,
  TradeMode,
} from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  default: {
    instruction: { findFirst: vi.fn(), update: vi.fn() },
    executionProtectionReport: { create: vi.fn(), findFirst: vi.fn() },
    instructionStatusLog: { create: vi.fn() },
    eaHeartbeat: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/audit/log", () => ({ createAuditLog: vi.fn() }));

import prisma from "@/lib/prisma";
import {
  hasUnresolvedProtectionBlock,
  reportExecutionProtection,
} from "@/lib/risk/execution-protection";

const ctx = {
  license: { id: "lic-1", userId: "user-1" },
  requestId: "req-1",
} as const;

describe("execution protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detecta bloqueio por instruction protectionBlocked", async () => {
    vi.mocked(prisma.instruction.findFirst).mockResolvedValue({
      id: "i1",
      protectionBlocked: true,
    } as never);
    const blocked = await hasUnresolvedProtectionBlock("lic-1", 910001);
    expect(blocked).toBe(true);
  });

  it("PROTECTION_CONFIRMED não bloqueia instrução", async () => {
    vi.mocked(prisma.instruction.findFirst).mockResolvedValue({
      id: "inst-1",
      licenseId: "lic-1",
      symbol: "WDOM26",
      accountLogin: "1",
      accountServer: "S",
    } as never);
    vi.mocked(prisma.eaHeartbeat.findFirst).mockResolvedValue({
      tradeMode: TradeMode.REAL,
    } as never);
    vi.mocked(prisma.executionProtectionReport.create).mockResolvedValue({
      id: "rep-1",
    } as never);
    vi.mocked(prisma.instruction.update).mockResolvedValue({} as never);

    const result = await reportExecutionProtection(ctx, {
      instruction_id: "inst-1",
      account_login: "1",
      account_server: "S",
      symbol: "WDOM26",
      magic_number: 910001,
      stop_loss_present: true,
      take_profit_present: true,
      stop_loss_price: 100,
      take_profit_price: 110,
      protection_mode: "ATTACHED_SL_TP",
      protection_status: "PROTECTION_CONFIRMED",
    });

    expect(result.ok).toBe(true);
    expect(prisma.instruction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ protectionBlocked: false }),
      })
    );
  });

  it("PROTECTION_FAILED em conta real bloqueia e redige erro sensível", async () => {
    vi.mocked(prisma.instruction.findFirst).mockResolvedValue({
      id: "inst-1",
      licenseId: "lic-1",
      symbol: "WDOM26",
    } as never);
    vi.mocked(prisma.eaHeartbeat.findFirst).mockResolvedValue({
      tradeMode: TradeMode.REAL,
    } as never);
    vi.mocked(prisma.executionProtectionReport.create).mockResolvedValue({
      id: "rep-2",
    } as never);
    vi.mocked(prisma.instruction.update).mockResolvedValue({} as never);
    vi.mocked(prisma.instructionStatusLog.create).mockResolvedValue({} as never);

    await reportExecutionProtection(ctx, {
      instruction_id: "inst-1",
      account_login: "1",
      account_server: "S",
      symbol: "WDOM26",
      magic_number: 910001,
      stop_loss_present: false,
      take_profit_present: false,
      protection_mode: "UNKNOWN",
      protection_status: "PROTECTION_FAILED",
      error_message: "Bearer secret-token leaked",
    });

    expect(prisma.executionProtectionReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          errorMessageRedacted: "[REDACTED]",
          protectionStatus: ProtectionStatus.PROTECTION_FAILED,
        }),
      })
    );
    expect(prisma.instruction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          protectionBlocked: true,
          currentStatus: OrderLogStatus.REJECTED,
        }),
      })
    );
  });

  it("conta real exige stop e take no payload quando não FAILED", async () => {
    vi.mocked(prisma.instruction.findFirst).mockResolvedValue({
      id: "inst-1",
      licenseId: "lic-1",
    } as never);
    vi.mocked(prisma.eaHeartbeat.findFirst).mockResolvedValue({
      tradeMode: TradeMode.REAL,
    } as never);

    const result = await reportExecutionProtection(ctx, {
      instruction_id: "inst-1",
      account_login: "1",
      account_server: "S",
      symbol: "WDOM26",
      magic_number: 910001,
      stop_loss_present: false,
      take_profit_present: true,
      protection_mode: "ATTACHED_SL_TP",
      protection_status: "PROTECTION_CONFIRMED",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PROTECTION_INCOMPLETE");
  });
});
