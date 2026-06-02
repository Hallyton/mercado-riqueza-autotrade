import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  RealTradePreflightSource,
  RealTradePreflightStatus,
  TradeMode,
} from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  default: {
    realTradePreflight: { findUnique: vi.fn() },
    eaHeartbeat: { findFirst: vi.fn() },
    device: { findFirst: vi.fn() },
    instruction: { create: vi.fn() },
    instructionStatusLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/admin/record-action", () => ({ recordAdminAction: vi.fn() }));
vi.mock("@/lib/risk/real-trade-preflight", () => ({
  findActiveRealTradingApproval: vi.fn(),
  hasPreMarketSnapshotToday: vi.fn(),
  isEaExecutorOnline: vi.fn(),
}));
vi.mock("@/lib/risk/execution-protection", () => ({
  hasUnresolvedProtectionBlock: vi.fn(),
}));
vi.mock("@/lib/risk/real-trading-config", () => ({
  isAutoDispatchEnabled: vi.fn(() => false),
}));

import prisma from "@/lib/prisma";
import { createFirstRealManualInstruction } from "@/lib/admin/real-manual-dispatch";
import {
  findActiveRealTradingApproval,
  hasPreMarketSnapshotToday,
  isEaExecutorOnline,
} from "@/lib/risk/real-trade-preflight";
import { hasUnresolvedProtectionBlock } from "@/lib/risk/execution-protection";

const baseInput = {
  actorId: "admin-1",
  preflightId: "pf-1",
  licenseId: "lic-1",
  accountLogin: "19583778",
  accountServer: "XPMT5-PRD",
  symbol: "WDON26",
  side: "BUY" as const,
  requestedContracts: 1,
  magicNumber: 910001,
  adminConfirmation: "AUTORIZO PRIMEIRA ORDEM REAL",
  stopLossPrice: 5643.5,
  takeProfitPrice: 5660.5,
};

describe("real manual dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(prisma as any));
    vi.mocked(prisma.realTradePreflight.findUnique).mockResolvedValue({
      id: "pf-1",
      source: RealTradePreflightSource.DRY_RUN,
      status: RealTradePreflightStatus.PASSED,
      createdAt: new Date(),
      licenseId: "lic-1",
      accountLogin: "19583778",
      accountServer: "XPMT5-PRD",
      symbol: "WDON26",
      magicNumber: 910001,
      requestedContracts: 1,
      license: { id: "lic-1", userId: "u-1", status: "ACTIVE", mt5Account: null },
    } as never);
    vi.mocked(findActiveRealTradingApproval).mockResolvedValue({ id: "a-1" } as never);
    vi.mocked(hasPreMarketSnapshotToday).mockResolvedValue({ ok: true, snapshotId: "s-1" });
    vi.mocked(isEaExecutorOnline).mockResolvedValue(true);
    vi.mocked(prisma.eaHeartbeat.findFirst).mockResolvedValue({
      tradeMode: TradeMode.REAL,
      deviceId: "dev-1",
    } as never);
    vi.mocked(prisma.device.findFirst).mockResolvedValue({ id: "dev-1" } as never);
    vi.mocked(hasUnresolvedProtectionBlock).mockResolvedValue(false);
    vi.mocked(prisma.instruction.create).mockResolvedValue({
      id: "i-1",
      source: "REAL_MANUAL",
      currentStatus: "RECEIVED",
    } as never);
  });

  it("cria REAL_MANUAL LIMIT com orderPrice e SL/TP", async () => {
    const result = await createFirstRealManualInstruction({
      ...baseInput,
      orderType: "LIMIT",
      orderPrice: 5650.5,
    });

    expect(result.ok).toBe(true);
    expect(prisma.instruction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: "REAL_MANUAL",
          orderType: "LIMIT",
          orderPrice: 5650.5,
          stopLoss: 5643.5,
          takeProfit: 5660.5,
          requiresProtectionConfirmation: true,
        }),
      })
    );
  });

  it("MARKET aceita sem orderPrice mas exige SL/TP", async () => {
    await createFirstRealManualInstruction({
      ...baseInput,
      orderType: "MARKET",
    });
    expect(prisma.instruction.create).toHaveBeenCalled();
  });

  it("bloqueia LIMIT sem orderPrice", async () => {
    await expect(
      createFirstRealManualInstruction({ ...baseInput, orderType: "LIMIT" })
    ).rejects.toMatchObject({ code: "ORDER_PRICE_REQUIRED_FOR_PENDING_ORDER" });
    expect(prisma.instruction.create).not.toHaveBeenCalled();
  });

  it("bloqueia sem stopLossPrice", async () => {
    await expect(
      createFirstRealManualInstruction({
        ...baseInput,
        orderType: "MARKET",
        stopLossPrice: undefined as unknown as number,
      })
    ).rejects.toMatchObject({ code: "STOP_LOSS_REQUIRED" });
  });

  it("bloqueia sem takeProfitPrice", async () => {
    await expect(
      createFirstRealManualInstruction({
        ...baseInput,
        orderType: "MARKET",
        takeProfitPrice: undefined as unknown as number,
      })
    ).rejects.toMatchObject({ code: "TAKE_PROFIT_REQUIRED" });
  });

  it("bloqueia quando preflight diverge", async () => {
    await expect(
      createFirstRealManualInstruction({
        ...baseInput,
        orderType: "MARKET",
        accountLogin: "999",
      })
    ).rejects.toMatchObject({ code: "PREFLIGHT_PAYLOAD_MISMATCH" });
  });
});
