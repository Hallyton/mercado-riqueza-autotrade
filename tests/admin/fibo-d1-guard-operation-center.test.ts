import { beforeEach, describe, expect, it, vi } from "vitest";
import { LicenseStatus } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  license: { findMany: vi.fn() },
  device: { findFirst: vi.fn() },
  eaHeartbeat: { findFirst: vi.fn() },
  eaErrorReport: { findFirst: vi.fn() },
  dailyFinancialRiskLimit: { findFirst: vi.fn() },
  instrumentPointValue: { findFirst: vi.fn() },
  strategyRuntimeConfig: { findFirst: vi.fn() },
  autonomousStrategyDecision: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

vi.mock("@/lib/admin/strategy-runtime-config", () => ({
  getPublishedStrategyConfigForEa: vi.fn(),
}));

vi.mock("@/lib/admin/normalize-fibo-daily-risk-records", () => ({
  normalizeFiboDailyRiskStrategyCodes: vi.fn().mockResolvedValue({
    limitsUpdated: 0,
    limitsDeleted: 0,
    statesUpdated: 0,
  }),
}));

vi.mock("@/lib/ea/autonomous-strategy-preflight", () => ({
  isAutonomousStrategyServerEnabled: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/risk/real-trading-guard", () => ({
  isRealTradingEnabled: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/risk/daily-financial-risk", () => ({
  evaluateDailyFinancialStopForEntry: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/ea/status", () => ({
  isEaOffline: vi.fn().mockReturnValue(false),
}));

import { getPublishedStrategyConfigForEa } from "@/lib/admin/strategy-runtime-config";
import { getFiboD1GuardOperationCenterView } from "@/lib/admin/fibo-d1-guard-operation-center";
import { LOT_TOTAL_EXCEEDS_MAX_CONTRACTS } from "@/lib/strategy/mr-fibo-d1-guard-readiness";

describe("fibo d1 guard operation center", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.license.findMany.mockResolvedValue([
      {
        id: "lic1",
        status: LicenseStatus.ACTIVE,
        expectedSymbol: "WDON26",
        expectedMagicNumber: 910001,
        expectedAccountLogin: "123",
        expectedAccountServer: "XPMT5-PRD",
        user: { email: "cliente@test.com", name: "Cliente" },
        mt5Account: { login: "123", server: "XPMT5-PRD" },
        robotInstances: [
          {
            symbol: "WDON26",
            magicNumber: 910001,
            autonomousStrategyEnabled: true,
            robotProduct: { requiresDailyFinancialStop: true },
          },
        ],
        realTradingApprovals: [{ id: "ap1", maxContracts: 1 }],
        dailyFinancialRiskLimits: [
          {
            id: "dr1",
            licenseId: "lic1",
            accountLogin: "123",
            accountServer: "XPMT5-PRD",
            symbol: "WDON26",
            strategyCode: "MR_FIBO_D1_GUARD",
            enabled: true,
            dailyLossLimitCents: 50000,
            includeOpenPnL: true,
            resetTimezone: "America/Sao_Paulo",
            resetAtTime: "00:00",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
    ]);
    prismaMock.instrumentPointValue.findFirst.mockResolvedValue({
      centsPerPointPerContract: 1000,
    });
    prismaMock.device.findFirst.mockResolvedValue({
      lastSeenAt: new Date(),
    });
    prismaMock.eaHeartbeat.findFirst.mockResolvedValue(null);
    prismaMock.eaErrorReport.findFirst.mockResolvedValue(null);
    prismaMock.strategyRuntimeConfig.findFirst.mockResolvedValue(null);
    prismaMock.autonomousStrategyDecision.findMany.mockResolvedValue([]);
    vi.mocked(getPublishedStrategyConfigForEa).mockResolvedValue(null);
  });

  it("classifies client blocked by LOT_TOTAL_EXCEEDS_MAX_CONTRACTS", async () => {
    const view = await getFiboD1GuardOperationCenterView();
    const blocked = view.clients.blocked.find((row) => row.licenseId === "lic1");
    expect(blocked).toBeDefined();
    expect(blocked?.reasonCodes).toContain(LOT_TOTAL_EXCEEDS_MAX_CONTRACTS);
    expect(blocked?.strategyConfigHref).toBe("/admin/licenses/lic1/strategy-config");
    expect(blocked?.approvalHref).toBe("/admin/real-trading/approvals/ap1");
    expect(blocked?.dailyRiskHref).toBe(
      "/admin/real-trading/daily-risk?licenseId=lic1"
    );
  });

  it("clears LOT_TOTAL_EXCEEDS after approval maxContracts raised to match loteTotal", async () => {
    prismaMock.license.findMany.mockResolvedValue([
      {
        id: "lic1",
        status: LicenseStatus.ACTIVE,
        expectedSymbol: "WDON26",
        expectedMagicNumber: 910001,
        expectedAccountLogin: "123",
        expectedAccountServer: "XPMT5-PRD",
        user: { email: "cliente@test.com", name: "Cliente" },
        mt5Account: { login: "123", server: "XPMT5-PRD" },
        robotInstances: [
          {
            symbol: "WDON26",
            magicNumber: 910001,
            autonomousStrategyEnabled: true,
            robotProduct: { requiresDailyFinancialStop: true },
          },
        ],
        realTradingApprovals: [{ id: "ap1", maxContracts: 5 }],
        dailyFinancialRiskLimits: [
          {
            id: "dr1",
            licenseId: "lic1",
            accountLogin: "123",
            accountServer: "XPMT5-PRD",
            symbol: "WDON26",
            strategyCode: "MR_FIBO_D1_GUARD",
            enabled: true,
            dailyLossLimitCents: 50000,
            includeOpenPnL: true,
            resetTimezone: "America/Sao_Paulo",
            resetAtTime: "00:00",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
    ]);
    vi.mocked(getPublishedStrategyConfigForEa).mockResolvedValue({
      strategyConfig: {
        risk: { lote_total: 5, stop_pontos: 100 },
      },
      configHash: "hash1",
      version: 1,
    } as Awaited<ReturnType<typeof getPublishedStrategyConfigForEa>>);

    const view = await getFiboD1GuardOperationCenterView();
    const blocked = view.clients.blocked.find((row) => row.licenseId === "lic1");
    expect(blocked?.reasonCodes ?? []).not.toContain(LOT_TOTAL_EXCEEDS_MAX_CONTRACTS);
  });
});
