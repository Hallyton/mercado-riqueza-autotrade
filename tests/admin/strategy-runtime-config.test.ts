import { beforeEach, describe, expect, it, vi } from "vitest";
import { StrategyRuntimeConfigStatus } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  license: { findUnique: vi.fn() },
  robotInstance: { findFirst: vi.fn() },
  dailyFinancialRiskLimit: { findFirst: vi.fn(), findMany: vi.fn() },
  dailyFinancialRiskState: { findMany: vi.fn() },
  instrumentPointValue: { findFirst: vi.fn() },
  strategyRuntimeConfig: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  strategyRuntimeConfigHistory: {
    create: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
  adminAction: { create: vi.fn() },
  auditLog: { create: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

vi.mock("@/lib/admin/record-action", () => ({
  recordAdminAction: vi.fn().mockResolvedValue({ id: "action1" }),
}));

import { recordAdminAction } from "@/lib/admin/record-action";
import {
  getPublishedStrategyConfigForEa,
  getStrategyConfigAdminView,
  publishStrategyConfig,
  resetStrategyConfigDefault,
  saveStrategyConfigDraft,
} from "@/lib/admin/strategy-runtime-config";
import { buildDefaultMrFiboD1GuardConfig } from "@/lib/strategy/mr-fibo-d1-guard-config";

const baseLicense = {
  id: "lic1",
  expectedSymbol: "WDON26",
  expectedMagicNumber: 910001,
  expectedAccountLogin: "123",
  expectedAccountServer: "XPMT5-PRD",
  mt5Account: { login: "123", server: "XPMT5-PRD" },
  robotInstances: [
    {
      id: "ri1",
      magicNumber: 910001,
      symbol: "WDON26",
      autonomousStrategyEnabled: true,
      autonomousStrategyCode: "MR_FIBO_D1_GUARD",
      robotProduct: {
        requiresDailyFinancialStop: true,
        requiresPreMarket: true,
        requiresRealTradingApproval: true,
      },
    },
  ],
  realTradingApprovals: [{ maxContracts: 5 }],
};

describe("strategy runtime config admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.license.findUnique.mockResolvedValue(baseLicense);
    prismaMock.dailyFinancialRiskLimit.findFirst.mockResolvedValue({
      enabled: true,
      dailyLossLimitCents: 50000,
    });
    prismaMock.dailyFinancialRiskLimit.findMany.mockResolvedValue([
      {
        enabled: true,
        dailyLossLimitCents: 50000,
        includeOpenPnL: true,
        symbol: "WDON26",
        accountLogin: "123",
        accountServer: "XPMT5-PRD",
        strategyCode: "MR_FIBO_D1_GUARD",
      },
    ]);
    prismaMock.dailyFinancialRiskState.findMany.mockResolvedValue([
      {
        totalPnlCents: -1000,
        remainingLossCents: 49000,
        status: "OK",
      },
    ]);
    prismaMock.instrumentPointValue.findFirst.mockResolvedValue({
      centsPerPointPerContract: 50,
    });
    prismaMock.strategyRuntimeConfig.findFirst.mockResolvedValue(null);
    prismaMock.strategyRuntimeConfigHistory.count.mockResolvedValue(0);
  });

  it("loads admin view", async () => {
    const view = await getStrategyConfigAdminView("lic1");
    expect(view.strategyCode).toBe("MR_FIBO_D1_GUARD");
    expect(view.identification.maxContracts).toBe(5);
    expect(view.config.risk.loteTotal).toBe(5);
  });

  it("creates draft and records audit", async () => {
    const cfg = buildDefaultMrFiboD1GuardConfig();
    prismaMock.strategyRuntimeConfig.create.mockResolvedValue({
      id: "cfg1",
      version: 1,
      status: StrategyRuntimeConfigStatus.DRAFT,
      config: cfg,
      configHash: "abc",
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      publishedAt: null,
      publishedBy: null,
      createdBy: { id: "admin1", name: "Admin", email: "a@b.com" },
    });

    await saveStrategyConfigDraft({
      licenseId: "lic1",
      config: cfg,
      actorId: "admin1",
    });

    expect(prismaMock.strategyRuntimeConfig.create).toHaveBeenCalled();
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "strategy_config.draft_saved" })
    );
  });

  it("blocks publish without daily stop", async () => {
    prismaMock.dailyFinancialRiskLimit.findFirst.mockResolvedValue(null);
    prismaMock.strategyRuntimeConfig.findFirst.mockImplementation(async (args) => {
      if (args?.where?.status === StrategyRuntimeConfigStatus.DRAFT) {
        return {
          id: "cfg1",
          version: 1,
          status: StrategyRuntimeConfigStatus.DRAFT,
          config: buildDefaultMrFiboD1GuardConfig(),
          configHash: "abc",
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          publishedAt: null,
          publishedBy: null,
          createdBy: { id: "admin1", name: "Admin", email: "a@b.com" },
        };
      }
      return null;
    });

    await expect(
      publishStrategyConfig({ licenseId: "lic1", actorId: "admin1" })
    ).rejects.toMatchObject({ code: "DAILY_FINANCIAL_STOP_NOT_CONFIGURED" });
  });

  it("reset default creates draft", async () => {
    prismaMock.strategyRuntimeConfig.create.mockResolvedValue({
      id: "cfg2",
      version: 1,
      status: StrategyRuntimeConfigStatus.DRAFT,
      config: buildDefaultMrFiboD1GuardConfig(),
      configHash: "def",
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      publishedAt: null,
      publishedBy: null,
      createdBy: { id: "admin1", name: "Admin", email: "a@b.com" },
    });

    await resetStrategyConfigDefault({ licenseId: "lic1", actorId: "admin1" });
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "strategy_config.reset_default" })
    );
  });

  it("blocks publish when loteTotal exceeds maxContracts", async () => {
    prismaMock.license.findUnique.mockResolvedValue({
      ...baseLicense,
      realTradingApprovals: [{ id: "ap1", maxContracts: 1 }],
    });
    const cfg = buildDefaultMrFiboD1GuardConfig();
    prismaMock.strategyRuntimeConfig.findFirst.mockImplementation(async (args) => {
      if (args?.where?.status === StrategyRuntimeConfigStatus.DRAFT) {
        return {
          id: "cfg1",
          version: 1,
          status: StrategyRuntimeConfigStatus.DRAFT,
          config: cfg,
          configHash: "abc",
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          publishedAt: null,
          publishedBy: null,
          createdBy: { id: "admin1", name: "Admin", email: "a@b.com" },
        };
      }
      return null;
    });

    await expect(
      publishStrategyConfig({ licenseId: "lic1", actorId: "admin1" })
    ).rejects.toMatchObject({ code: "LOT_TOTAL_EXCEEDS_MAX_CONTRACTS" });
  });

  it("loads readiness with maxContracts in admin view", async () => {
    prismaMock.license.findUnique.mockResolvedValue({
      ...baseLicense,
      realTradingApprovals: [{ id: "ap1", maxContracts: 1 }],
    });
    const view = await getStrategyConfigAdminView("lic1");
    expect(view.operationalLimit.approvedMaxContracts).toBe(1);
    expect(view.operationalLimit.approvalHref).toBe(
      "/admin/real-trading/approvals/ap1"
    );
    expect(view.readiness.contractLimit.exceedsLimit).toBe(true);
    expect(view.identification.maxContracts).toBe(1);
  });

  it("allows draft save when loteTotal exceeds maxContracts", async () => {
    const cfg = buildDefaultMrFiboD1GuardConfig();
    prismaMock.license.findUnique.mockResolvedValue({
      ...baseLicense,
      realTradingApprovals: [{ id: "ap1", maxContracts: 1 }],
    });
    prismaMock.strategyRuntimeConfig.create.mockResolvedValue({
      id: "cfg1",
      version: 1,
      status: StrategyRuntimeConfigStatus.DRAFT,
      config: cfg,
      configHash: "abc",
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      publishedAt: null,
      publishedBy: null,
      createdBy: { id: "admin1", name: "Admin", email: "a@b.com" },
    });

    await saveStrategyConfigDraft({
      licenseId: "lic1",
      config: cfg,
      actorId: "admin1",
    });

    expect(prismaMock.strategyRuntimeConfig.create).toHaveBeenCalled();
  });

  it("returns published config for EA", async () => {
    const cfg = buildDefaultMrFiboD1GuardConfig();
    prismaMock.strategyRuntimeConfig.findFirst.mockResolvedValue({
      version: 2,
      configHash: "hash123",
      config: cfg,
    });

    const published = await getPublishedStrategyConfigForEa("lic1");
    expect(published?.version).toBe(2);
    expect(published?.strategyConfig.risk.lote_total).toBe(5);
  });
});
