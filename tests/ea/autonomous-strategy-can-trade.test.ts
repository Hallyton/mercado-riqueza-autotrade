import { beforeEach, describe, expect, it, vi } from "vitest";
import { LicenseStatus } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  license: { findFirst: vi.fn() },
  robotInstance: { findFirst: vi.fn() },
  device: { findFirst: vi.fn() },
  dailyFinancialRiskLimit: { findFirst: vi.fn() },
  autonomousStrategyDecision: { create: vi.fn() },
  licenseOperationControl: { findUnique: vi.fn().mockResolvedValue(null) },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

vi.mock("@/lib/ea/autonomous-strategy-preflight", () => ({
  isAutonomousStrategyServerEnabled: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/admin/strategy-runtime-config", () => ({
  getPublishedStrategyConfigForEa: vi.fn(),
}));

vi.mock("@/lib/risk/real-trading-guard", () => ({
  isRealTradingEnabled: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/risk/real-trade-preflight", () => ({
  findActiveRealTradingApproval: vi.fn().mockResolvedValue({ maxContracts: 5 }),
  hasPreMarketSnapshotToday: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/risk/daily-financial-risk", () => ({
  evaluateDailyFinancialStopForEntry: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/ea/status", () => ({
  isEaOffline: vi.fn().mockReturnValue(false),
}));

import { getPublishedStrategyConfigForEa } from "@/lib/admin/strategy-runtime-config";
import { runAutonomousStrategyCanTrade } from "@/lib/ea/autonomous-strategy-can-trade";

const ctx = {
  device: { id: "d1", deviceId: "dev1", status: "ACTIVE", lastSeenAt: new Date() },
  license: {
    id: "lic1",
    userId: "u1",
    status: LicenseStatus.ACTIVE,
    expectedTradeMode: "REAL",
    expectedSymbol: "WDON26",
    expectedMagicNumber: 910001,
    expectedAccountLogin: "123",
    expectedAccountServer: "XPMT5-PRD",
    mt5Account: { login: "123", server: "XPMT5-PRD" },
    subscription: {
      status: "ACTIVE",
      adminPaymentStatus: "CONFIRMED",
    },
  },
  requestId: null,
  deviceIdHeader: "dev1",
  eaVersion: "1.1.0",
} as never;

const baseBody = {
  strategy_code: "MR_FIBO_D1_GUARD" as const,
  license_id: "lic1",
  device_id: "dev1",
  account_login: "123",
  account_server: "XPMT5-PRD",
  symbol: "WDON26",
  trade_mode: "REAL" as const,
  magic_number: 910001,
  side: "BUY" as const,
  action: "ENTRY" as const,
  requested_contracts: 5,
  estimated_stop_points: 7,
  strategy_config_hash: "hash123",
};

describe("autonomous strategy can-trade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.robotInstance.findFirst.mockResolvedValue({
      id: "ri1",
      status: "OPERATIONAL_CONTROLLED",
      symbol: "WDON26",
      magicNumber: 910001,
      autonomousStrategyEnabled: true,
      robotProduct: {
        requiresDailyFinancialStop: true,
        requiresRealTradingApproval: true,
        requiresPreMarket: true,
      },
    });
    prismaMock.device.findFirst.mockResolvedValue({
      status: "ACTIVE",
      lastSeenAt: new Date(),
    });
    prismaMock.dailyFinancialRiskLimit.findFirst.mockResolvedValue({ enabled: true });
    vi.mocked(getPublishedStrategyConfigForEa).mockResolvedValue({
      version: 2,
      configHash: "hash123",
      strategyConfig: {
        risk: { lote_total: 5, stop_pontos: 7 },
      } as never,
    });
    prismaMock.autonomousStrategyDecision.create.mockResolvedValue({ id: "dec1" });
  });

  it("allows when all gates pass", async () => {
    const result = await runAutonomousStrategyCanTrade(ctx, baseBody);
    expect(result.allowed).toBe(true);
    expect(prismaMock.autonomousStrategyDecision.create).toHaveBeenCalled();
  });

  it("blocks when config missing", async () => {
    vi.mocked(getPublishedStrategyConfigForEa).mockResolvedValue(null);
    const result = await runAutonomousStrategyCanTrade(ctx, baseBody);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason_code).toBe("STRATEGY_CONFIG_MISSING");
    }
  });

  it("blocks hash mismatch", async () => {
    const result = await runAutonomousStrategyCanTrade(ctx, {
      ...baseBody,
      strategy_config_hash: "other",
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason_code).toBe("STRATEGY_CONFIG_HASH_MISMATCH");
    }
  });

  it("does not create instruction", async () => {
    await runAutonomousStrategyCanTrade(ctx, baseBody);
    const call = prismaMock.autonomousStrategyDecision.create.mock.calls[0][0];
    expect(call.data.instructionId).toBeNull();
  });
});
