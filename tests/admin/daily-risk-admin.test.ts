import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LicenseStatus,
  UserStatus,
  type DailyFinancialRiskLimit,
} from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  license: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  dailyFinancialRiskLimit: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  instruction: { create: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

vi.mock("@/lib/admin/record-action", () => ({
  recordAdminAction: vi.fn().mockResolvedValue({ id: "action1" }),
}));

vi.mock("@/lib/admin/normalize-fibo-daily-risk-records", () => ({
  normalizeFiboDailyRiskStrategyCodes: vi.fn().mockResolvedValue({
    limitsUpdated: 0,
    limitsDeleted: 0,
    statesUpdated: 0,
  }),
}));

import { recordAdminAction } from "@/lib/admin/record-action";
import {
  DailyFinancialRiskAdminError,
  upsertDailyFinancialRiskLimitValidated,
} from "@/lib/admin/daily-financial-risk-admin";
import {
  formatDailyRiskLicenseLabel,
  listDailyRiskEligibleLicenses,
} from "@/lib/admin/daily-risk-eligible-licenses";

const baseLicense = {
  id: "lic-eilane",
  userId: "user1",
  status: LicenseStatus.ACTIVE,
  expectedAccountLogin: "19583778",
  expectedAccountServer: "XPMT5-PRD",
  expectedSymbol: "WDON26",
  expectedMagicNumber: 910001,
  user: {
    email: "eilane.lobo21@gmail.com",
    name: "Eilane Rodrigues Lobo",
    status: UserStatus.ACTIVE,
  },
  mt5Account: { login: "19583778", server: "XPMT5-PRD" },
  robotInstances: [
    {
      id: "ri1",
      symbol: "WDON26",
      magicNumber: 910001,
      autonomousStrategyCode: "MR_FIBO_D1_GUARD",
      autonomousStrategyEnabled: true,
    },
  ],
  dailyFinancialRiskLimits: [] as DailyFinancialRiskLimit[],
};

describe("listDailyRiskEligibleLicenses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.license.findMany.mockResolvedValue([baseLicense]);
  });

  it("lists active licenses with linked MT5 account", async () => {
    const rows = await listDailyRiskEligibleLicenses();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      licenseId: "lic-eilane",
      accountLogin: "19583778",
      accountServer: "XPMT5-PRD",
      symbol: "WDON26",
      strategyCode: "MR_FIBO_D1_GUARD",
      selectable: true,
      operationalStatus: "NOT_CONFIGURED",
    });
  });

  it("formatDailyRiskLicenseLabel includes client account and strategy", () => {
    const label = formatDailyRiskLicenseLabel({
      licenseId: "lic-eilane",
      userId: "user1",
      clientName: "Eilane Rodrigues Lobo",
      clientEmail: "eilane.lobo21@gmail.com",
      accountLogin: "19583778",
      accountServer: "XPMT5-PRD",
      symbol: "WDON26",
      magicNumber: 910001,
      strategyCode: "MR_FIBO_D1_GUARD",
      licenseStatus: LicenseStatus.ACTIVE,
      robotInstanceId: "ri1",
      autonomousStrategyEnabled: true,
      existingDailyRiskLimit: null,
      operationalStatus: "NOT_CONFIGURED",
      selectable: true,
    });
    expect(label).toContain("Eilane Rodrigues Lobo");
    expect(label).toContain("19583778 @ XPMT5-PRD");
    expect(label).toContain("MR_FIBO_D1_GUARD");
  });

  it("marks license without MT5 as not selectable", async () => {
    prismaMock.license.findMany.mockResolvedValue([
      { ...baseLicense, mt5Account: null },
    ]);
    const rows = await listDailyRiskEligibleLicenses();
    expect(rows[0].operationalStatus).toBe("NO_MT5_ACCOUNT");
    expect(rows[0].selectable).toBe(false);
  });
});

describe("upsertDailyFinancialRiskLimitValidated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.license.findUnique.mockResolvedValue(baseLicense);
    prismaMock.dailyFinancialRiskLimit.findUnique.mockResolvedValue(null);
    prismaMock.dailyFinancialRiskLimit.upsert.mockResolvedValue({
      id: "limit1",
      licenseId: "lic-eilane",
      accountLogin: "19583778",
      accountServer: "XPMT5-PRD",
      symbol: "WDON26",
      strategyCode: "MR_FIBO_D1_GUARD",
      enabled: true,
      dailyLossLimitCents: 50000,
      includeOpenPnL: true,
    });
  });

  const validInput = {
    licenseId: "lic-eilane",
    accountLogin: "19583778",
    accountServer: "XPMT5-PRD",
    symbol: "WDON26",
    strategyCode: "MR_FIBO_D1_GUARD",
    enabled: true,
    dailyLossLimitBrl: 500,
    includeOpenPnL: true,
    actorId: "admin1",
  };

  it("creates DailyFinancialRiskLimit and audit", async () => {
    const result = await upsertDailyFinancialRiskLimitValidated(validInput);
    expect(result.created).toBe(true);
    expect(prismaMock.dailyFinancialRiskLimit.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          licenseId_accountLogin_accountServer_strategyCode_symbol: expect.objectContaining({
            strategyCode: "MR_FIBO_D1_GUARD",
          }),
        }),
      })
    );
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "daily_risk.limit.created" })
    );
    expect(prismaMock.instruction.create).not.toHaveBeenCalled();
  });

  it("updates existing without duplicate", async () => {
    prismaMock.dailyFinancialRiskLimit.findUnique.mockResolvedValue({
      id: "limit1",
      dailyLossLimitCents: 30000,
    });
    const result = await upsertDailyFinancialRiskLimitValidated(validInput);
    expect(result.created).toBe(false);
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "daily_risk.limit.updated",
        metadata: expect.objectContaining({
          previousLimitCents: 30000,
          newLimitCents: 50000,
        }),
      })
    );
  });

  it("blocks nonexistent license", async () => {
    prismaMock.license.findUnique.mockResolvedValue(null);
    await expect(
      upsertDailyFinancialRiskLimitValidated(validInput)
    ).rejects.toMatchObject({ code: "LICENSE_NOT_FOUND" });
  });

  it("blocks inactive license", async () => {
    prismaMock.license.findUnique.mockResolvedValue({
      ...baseLicense,
      status: LicenseStatus.SUSPENDED,
    });
    await expect(
      upsertDailyFinancialRiskLimitValidated(validInput)
    ).rejects.toMatchObject({ code: "LICENSE_NOT_ACTIVE" });
  });

  it("blocks mismatched MT5 account", async () => {
    await expect(
      upsertDailyFinancialRiskLimitValidated({
        ...validInput,
        accountLogin: "99999999",
      })
    ).rejects.toMatchObject({ code: "MT5_ACCOUNT_MISMATCH" });
  });

  it("blocks invalid daily limit", async () => {
    await expect(
      upsertDailyFinancialRiskLimitValidated({
        ...validInput,
        dailyLossLimitBrl: 0,
      })
    ).rejects.toMatchObject({ code: "DAILY_LIMIT_INVALID" });
  });

  it("error payload is structured", () => {
    const err = new DailyFinancialRiskAdminError(
      "fail",
      "LICENSE_NOT_FOUND",
      404,
      { actionHint: "Selecione licença" }
    );
    expect(err.toPayload()).toMatchObject({
      code: "LICENSE_NOT_FOUND",
      actionHint: "Selecione licença",
    });
  });
});

describe("fibo operation center daily risk link", () => {
  it("uses licenseId query param", async () => {
    const { getFiboD1GuardOperationCenterView } = await import(
      "@/lib/admin/fibo-d1-guard-operation-center"
    );
    // Link shape is tested statically in fibo test; verify export exists
    expect(getFiboD1GuardOperationCenterView).toBeDefined();
  });
});

describe("DailyRiskAdminPanel contract", () => {
  it("exports panel component", async () => {
    const mod = await import("@/components/admin/daily-risk-admin-panel");
    expect(mod.DailyRiskAdminPanel).toBeDefined();
  });
});
