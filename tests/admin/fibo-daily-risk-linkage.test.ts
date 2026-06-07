import { beforeEach, describe, expect, it, vi } from "vitest";
import { LicenseStatus } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  license: { findMany: vi.fn(), findUnique: vi.fn() },
  device: { findFirst: vi.fn() },
  eaHeartbeat: { findFirst: vi.fn() },
  eaErrorReport: { findFirst: vi.fn() },
  dailyFinancialRiskLimit: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  dailyFinancialRiskState: { updateMany: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  eAOperationalSnapshot: { findFirst: vi.fn() },
  eAOperationalCommand: { findFirst: vi.fn() },
  instrumentPointValue: { findFirst: vi.fn() },
  strategyRuntimeConfig: { findFirst: vi.fn() },
  autonomousStrategyDecision: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

vi.mock("@/lib/admin/record-action", () => ({
  recordAdminAction: vi.fn().mockResolvedValue({ id: "action1" }),
}));

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

vi.mock("@/lib/risk/daily-financial-risk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/risk/daily-financial-risk")>();
  return {
    ...actual,
    evaluateDailyFinancialStopForEntry: vi.fn(),
    tradeDateKeySaoPaulo: vi.fn().mockReturnValue("2026-06-02"),
  };
});

vi.mock("@/lib/ea/status", () => ({
  isEaOffline: vi.fn().mockReturnValue(false),
}));

import { getPublishedStrategyConfigForEa } from "@/lib/admin/strategy-runtime-config";
import { upsertDailyFinancialRiskLimitValidated } from "@/lib/admin/daily-financial-risk-admin";
import { getFiboD1GuardOperationCenterView } from "@/lib/admin/fibo-d1-guard-operation-center";
import { evaluateDailyFinancialStopForEntry } from "@/lib/risk/daily-financial-risk";
import {
  normalizeFiboStrategyCode,
  isMrFiboD1GuardStrategyAlias,
} from "@/lib/strategy/normalize-strategy-code";
import { resolveFiboDailyRiskLimit } from "@/lib/admin/daily-risk-limit-resolver";

describe("normalizeStrategyCode", () => {
  it("normalizes fibo-d1-guard alias to MR_FIBO_D1_GUARD", () => {
    expect(normalizeFiboStrategyCode("fibo-d1-guard")).toBe("MR_FIBO_D1_GUARD");
    expect(normalizeFiboStrategyCode("MR Fibo D1 Guard")).toBe("MR_FIBO_D1_GUARD");
    expect(isMrFiboD1GuardStrategyAlias("fibo-d1-guard")).toBe(true);
  });
});

describe("resolveFiboDailyRiskLimit", () => {
  it("detects strategy mismatch when only alias limit exists", () => {
    const resolution = resolveFiboDailyRiskLimit(
      [
        {
          id: "l1",
          licenseId: "lic1",
          accountLogin: "19583778",
          accountServer: "XPMT5-PRD",
          symbol: "WDON26",
          strategyCode: "fibo-d1-guard",
          enabled: true,
          dailyLossLimitCents: 50000,
          includeOpenPnL: true,
          resetTimezone: "America/Sao_Paulo",
          resetAtTime: "00:00",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {
        accountLogin: "19583778",
        accountServer: "XPMT5-PRD",
        symbol: "WDON26",
      }
    );

    expect(resolution.strategyMismatch).toBe(true);
    expect(resolution.canonical).toBeNull();
  });
});

describe("fibo operation center daily risk linkage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.dailyFinancialRiskState.findUnique.mockResolvedValue(null);
    prismaMock.dailyFinancialRiskState.findMany.mockResolvedValue([]);
    prismaMock.dailyFinancialRiskState.findFirst.mockResolvedValue(null);
    prismaMock.eAOperationalSnapshot.findFirst.mockResolvedValue(null);
    prismaMock.eAOperationalCommand.findFirst.mockResolvedValue(null);
    prismaMock.eaHeartbeat.findFirst.mockResolvedValue(null);
    vi.mocked(evaluateDailyFinancialStopForEntry).mockResolvedValue({
      ok: true,
      snapshot: {
        enabled: true,
        limitCents: 50000,
        remainingLossCents: 50000,
        status: "OK",
        tradeDate: "2026-06-02",
        lastUpdatedAt: null,
        currentRealizedPnlCents: 0,
        openPnlCents: 0,
        totalPnlCents: 0,
      },
    });
    prismaMock.license.findMany.mockResolvedValue([
      {
        id: "lic1",
        status: LicenseStatus.ACTIVE,
        expectedSymbol: "WDON26",
        expectedMagicNumber: 910001,
        expectedAccountLogin: "19583778",
        expectedAccountServer: "XPMT5-PRD",
        user: { email: "eilane@test.com", name: "Eilane" },
        mt5Account: { login: "19583778", server: "XPMT5-PRD" },
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
            accountLogin: "19583778",
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
    prismaMock.device.findFirst.mockResolvedValue({ lastSeenAt: new Date() });
    prismaMock.eaHeartbeat.findFirst.mockResolvedValue({
      reportPayload: { autonomous_strategy: { auto_trading_allowed: true } },
    });
    prismaMock.eaErrorReport.findFirst.mockResolvedValue(null);
    prismaMock.strategyRuntimeConfig.findFirst.mockResolvedValue(null);
    prismaMock.autonomousStrategyDecision.findMany.mockResolvedValue([]);
    vi.mocked(getPublishedStrategyConfigForEa).mockResolvedValue({
      strategyConfig: { risk: { lote_total: 5, stop_pontos: 100 } },
      configHash: "hash1",
      version: 1,
    } as Awaited<ReturnType<typeof getPublishedStrategyConfigForEa>>);
  });

  it("recognizes saved DailyFinancialRiskLimit with canonical strategyCode", async () => {
    const view = await getFiboD1GuardOperationCenterView();
    const row = [...view.clients.blocked, ...view.clients.ready, ...view.clients.eaNotReady].find(
      (client) => client.licenseId === "lic1"
    );

    expect(row?.dailyRiskDiagnostic?.foundDailyRiskLimit).toBe(true);
    expect(row?.dailyRiskDiagnostic?.foundDailyRiskStrategyCode).toBe(
      "MR_FIBO_D1_GUARD"
    );
    expect(row?.reasonCodes).not.toContain("DAILY_FINANCIAL_STOP_NOT_CONFIGURED");
    expect(row?.reasonCodes).not.toContain("DAILY_FINANCIAL_STOP_STRATEGY_MISMATCH");
  });

  it("shows stop configured and missing report when state is absent", async () => {
    vi.mocked(evaluateDailyFinancialStopForEntry).mockResolvedValue({
      ok: false,
      reasonCode: "DAILY_RISK_REPORT_MISSING",
      detail:
        "DailyFinancialRiskLimit está configurado, mas nenhum DailyFinancialRiskState recente foi encontrado.",
      snapshot: {
        enabled: true,
        limitCents: 40000,
        remainingLossCents: 40000,
        status: "OK",
        tradeDate: "2026-06-02",
        lastUpdatedAt: null,
        currentRealizedPnlCents: 0,
        openPnlCents: 0,
        totalPnlCents: 0,
      },
    });

    const view = await getFiboD1GuardOperationCenterView();
    const blocked = view.clients.blocked.find((row) => row.licenseId === "lic1");
    expect(blocked?.reasonCodes).toContain("DAILY_RISK_REPORT_MISSING");
    expect(blocked?.dailyRiskDiagnostic?.stopConfigured).toBe(true);
    expect(blocked?.dailyRiskDiagnostic?.reportTrace?.reportStatus).toBe("MISSING");
    expect(blocked?.dailyRiskDiagnostic?.operationalMessage).toContain(
      "Stop financeiro diário configurado"
    );
  });

  it("shows DAILY_FINANCIAL_STOP_STRATEGY_MISMATCH for alias-only limit", async () => {
    prismaMock.license.findMany.mockResolvedValue([
      {
        id: "lic1",
        status: LicenseStatus.ACTIVE,
        expectedSymbol: "WDON26",
        expectedAccountLogin: "19583778",
        expectedAccountServer: "XPMT5-PRD",
        user: { email: "eilane@test.com", name: "Eilane" },
        mt5Account: { login: "19583778", server: "XPMT5-PRD" },
        robotInstances: [
          {
            symbol: "WDON26",
            magicNumber: 910001,
            autonomousStrategyEnabled: true,
            robotProduct: { requiresDailyFinancialStop: true },
          },
        ],
        realTradingApprovals: [],
        dailyFinancialRiskLimits: [
          {
            id: "dr-alias",
            licenseId: "lic1",
            accountLogin: "19583778",
            accountServer: "XPMT5-PRD",
            symbol: "WDON26",
            strategyCode: "fibo-d1-guard",
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

    const view = await getFiboD1GuardOperationCenterView();
    const blocked = view.clients.blocked.find((row) => row.licenseId === "lic1");
    expect(blocked?.reasonCodes).toContain("DAILY_FINANCIAL_STOP_STRATEGY_MISMATCH");
    expect(blocked?.dailyRiskDiagnostic?.detailMessage).toContain("fibo-d1-guard");
  });
});

describe("daily-risk upsert saves canonical strategyCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.license.findUnique.mockResolvedValue({
      id: "lic1",
      status: LicenseStatus.ACTIVE,
      user: { status: "ACTIVE" },
      mt5Account: { login: "19583778", server: "XPMT5-PRD" },
    });
    prismaMock.dailyFinancialRiskLimit.findUnique.mockResolvedValue(null);
    prismaMock.dailyFinancialRiskLimit.findMany.mockResolvedValue([]);
    prismaMock.dailyFinancialRiskLimit.upsert.mockResolvedValue({
      id: "limit1",
      licenseId: "lic1",
      strategyCode: "MR_FIBO_D1_GUARD",
      dailyLossLimitCents: 50000,
      enabled: true,
      includeOpenPnL: true,
      accountLogin: "19583778",
      accountServer: "XPMT5-PRD",
      symbol: "WDON26",
    });
    prismaMock.dailyFinancialRiskState.updateMany.mockResolvedValue({ count: 0 });
  });

  it("uses MR_FIBO_D1_GUARD when alias is submitted", async () => {
    await upsertDailyFinancialRiskLimitValidated({
      licenseId: "lic1",
      accountLogin: "19583778",
      accountServer: "XPMT5-PRD",
      symbol: "WDON26",
      strategyCode: "fibo-d1-guard",
      enabled: true,
      dailyLossLimitBrl: 500,
      includeOpenPnL: true,
      actorId: "admin1",
    });

    expect(prismaMock.dailyFinancialRiskLimit.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          licenseId_accountLogin_accountServer_strategyCode_symbol: expect.objectContaining({
            strategyCode: "MR_FIBO_D1_GUARD",
          }),
        }),
      })
    );
  });
});
