import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  license: { findUnique: vi.fn() },
  robotInstance: { findFirst: vi.fn() },
  robotProduct: { findFirst: vi.fn() },
  autonomousStrategyDecision: {
    count: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  instruction: { create: vi.fn() },
  instructionStatusLog: { create: vi.fn() },
  dailyFinancialRiskLimit: { findUnique: vi.fn() },
  dailyFinancialRiskState: { findUnique: vi.fn() },
  instrumentPointValue: { findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  default: prismaMock,
}));

vi.mock("@/lib/admin/real-manual-bulk-eligibility", () => ({
  evaluateBulkLicenseEligibility: vi.fn().mockResolvedValue({
    eligible: true,
    userId: "u1",
    licenseId: "lic1",
    approvalId: "ap1",
    magicNumber: 910001,
    maxContracts: 5,
  }),
}));

vi.mock("@/lib/risk/real-trading-config", () => ({
  isAutoDispatchEnabled: vi.fn().mockReturnValue(false),
  isRealTradingEnabled: vi.fn().mockReturnValue(true),
}));

import { createDefaultManagementPlan } from "@/lib/admin/real-manual-management-plan";
import { evaluateBulkLicenseEligibility } from "@/lib/admin/real-manual-bulk-eligibility";
import {
  isAutonomousStrategyServerEnabled,
  runAutonomousStrategyPreflight,
} from "@/lib/ea/autonomous-strategy-preflight";
import { evaluateDailyFinancialStopForEntry } from "@/lib/risk/daily-financial-risk";

vi.mock("@/lib/risk/daily-financial-risk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/risk/daily-financial-risk")>();
  return {
    ...actual,
    evaluateDailyFinancialStopForEntry: vi.fn(),
  };
});

const baseCtx = {
  license: {
    id: "lic1",
    userId: "u1",
    status: "ACTIVE",
  },
  device: {
    deviceId: "dev1",
    tradeMode: "REAL",
  },
} as const;

const baseInput = {
  strategy_code: "MR_FIBO_D1_GUARD",
  strategy_version: "1.0.0",
  license_id: "lic1",
  device_id: "dev1",
  account_login: "19583778",
  account_server: "XPMT5-PRD",
  symbol: "WDON26",
  trade_mode: "REAL" as const,
  magic_number: 910001,
  side: "BUY" as const,
  order_type: "MARKET" as const,
  requested_contracts: 1,
  planned_management_plan: (() => {
    const plan = createDefaultManagementPlan();
    return {
      version: 1,
      initial_stop_loss: 4999,
      takes: [
        { label: "T1", enabled: true, price: 5001, quantity: 1 },
        { label: "T2", enabled: false, price: null, quantity: 0 },
      ],
      break_even: {
        enabled: true,
        trigger: "TAKE1_FILLED",
        trigger_price: null,
        offset: 0,
      },
      trailing_stop: {
        enabled: true,
        trigger_price: 5002,
        distance: 1,
        step: 0.5,
      },
    };
  })(),
};

describe("autonomous-strategy-preflight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENABLE_AUTONOMOUS_STRATEGY = "true";
    prismaMock.robotInstance.findFirst.mockResolvedValue({
      autonomousStrategyCode: "MR_FIBO_D1_GUARD",
      robotProduct: { strategyCode: "MR_FIBO_D1_GUARD" },
    });
    prismaMock.robotProduct.findFirst.mockResolvedValue({
      requiresDailyFinancialStop: true,
    });
    prismaMock.autonomousStrategyDecision.count.mockResolvedValue(0);
    prismaMock.autonomousStrategyDecision.findFirst.mockResolvedValue(null);
    prismaMock.autonomousStrategyDecision.create.mockImplementation(({ data }) => ({
      id: "dec1",
      ...data,
    }));
    prismaMock.autonomousStrategyDecision.update.mockResolvedValue({});
    prismaMock.instruction.create.mockResolvedValue({ id: "instr1" });
    prismaMock.instructionStatusLog.create.mockResolvedValue({});
    vi.mocked(evaluateDailyFinancialStopForEntry).mockResolvedValue({
      ok: true,
      snapshot: {
        enabled: true,
        limitCents: 30000,
        currentRealizedPnlCents: 0,
        openPnlCents: 0,
        totalPnlCents: 0,
        remainingLossCents: 30000,
        status: "OK",
        tradeDate: "2026-06-02",
        lastUpdatedAt: new Date().toISOString(),
      },
    });
  });

  it("isAutonomousStrategyServerEnabled reads env", () => {
    process.env.ENABLE_AUTONOMOUS_STRATEGY = "false";
    expect(isAutonomousStrategyServerEnabled()).toBe(false);
    process.env.ENABLE_AUTONOMOUS_STRATEGY = "true";
    expect(isAutonomousStrategyServerEnabled()).toBe(true);
  });

  it("blocks when server autonomous disabled", async () => {
    process.env.ENABLE_AUTONOMOUS_STRATEGY = "false";
    const result = await runAutonomousStrategyPreflight(baseCtx as never, baseInput);
    expect(result.allowed).toBe(false);
    expect(result.reason_code).toBe("AUTONOMOUS_STRATEGY_DISABLED");
  });

  it("blocks when strategy not enabled for license", async () => {
    prismaMock.robotInstance.findFirst.mockResolvedValue(null);
    const result = await runAutonomousStrategyPreflight(baseCtx as never, baseInput);
    expect(result.allowed).toBe(false);
    expect(result.reason_code).toBe("STRATEGY_NOT_ENABLED_FOR_LICENSE");
  });

  it("authorizes when eligibility and daily risk OK", async () => {
    const result = await runAutonomousStrategyPreflight(baseCtx as never, baseInput);
    expect(result.allowed).toBe(true);
    expect(result.decision).toBe("AUTONOMOUS_STRATEGY_ALLOWED");
    expect(evaluateBulkLicenseEligibility).toHaveBeenCalled();
    expect(prismaMock.instruction.create).toHaveBeenCalled();
  });

  it("blocks when daily financial stop reached", async () => {
    vi.mocked(evaluateDailyFinancialStopForEntry).mockResolvedValue({
      ok: false,
      reasonCode: "DAILY_FINANCIAL_STOP_REACHED",
      detail: "Stop atingido",
      snapshot: {
        enabled: true,
        limitCents: 30000,
        currentRealizedPnlCents: -30000,
        openPnlCents: 0,
        totalPnlCents: -30000,
        remainingLossCents: 0,
        status: "BLOCKED",
        tradeDate: "2026-06-02",
        lastUpdatedAt: new Date().toISOString(),
      },
    });
    const result = await runAutonomousStrategyPreflight(baseCtx as never, baseInput);
    expect(result.allowed).toBe(false);
    expect(result.reason_code).toBe("DAILY_FINANCIAL_STOP_REACHED");
  });
});
