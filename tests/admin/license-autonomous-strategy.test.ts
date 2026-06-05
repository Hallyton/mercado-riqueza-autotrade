import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  license: { findUnique: vi.fn() },
  robotInstance: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  dailyFinancialRiskLimit: { findFirst: vi.fn() },
  device: { findFirst: vi.fn() },
  eaHeartbeat: { findFirst: vi.fn() },
  realTradingApproval: { findFirst: vi.fn() },
  adminAction: { create: vi.fn() },
  auditLog: { create: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

vi.mock("@/lib/admin/record-action", () => ({
  recordAdminAction: vi.fn().mockResolvedValue({ id: "action1" }),
}));

vi.mock("@/lib/commercial/robot-instance", () => ({
  linkRobotInstanceToLicense: vi.fn().mockResolvedValue({ id: "ri1" }),
}));

import { recordAdminAction } from "@/lib/admin/record-action";
import {
  AUTONOMOUS_STRATEGY_DISABLE_CONFIRM_PHRASE,
  AUTONOMOUS_STRATEGY_ENABLE_CONFIRM_PHRASE,
  getLicenseAutonomousStrategyAdminView,
  updateLicenseAutonomousStrategy,
} from "@/lib/admin/license-autonomous-strategy";
import { LicenseStatus } from "@prisma/client";

function readRepoFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const baseLicense = {
  id: "lic1",
  status: LicenseStatus.ACTIVE,
  expectedSymbol: "WDON26",
  expectedMagicNumber: 910001,
  user: { id: "u1", email: "a@b.com", name: "Cliente" },
  mt5Account: { login: "19583778", server: "XPMT5-PRD" },
  subscription: { id: "sub1", status: "ACTIVE", adminPaymentStatus: "CONFIRMED" },
  exposureProfile: null,
  robotInstances: [
    {
      id: "ri1",
      autonomousStrategyCode: null,
      autonomousStrategyEnabled: false,
      magicNumber: 910001,
      symbol: "WDON26",
      robotProduct: {
        id: "rp1",
        slug: "autotrade-single-robot",
        name: "AutoTrade",
        strategyCode: null,
        defaultSymbol: "WDO",
      },
    },
  ],
};

describe("license autonomous strategy admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.license.findUnique.mockResolvedValue(baseLicense);
    prismaMock.dailyFinancialRiskLimit.findFirst.mockResolvedValue({
      enabled: true,
      dailyLossLimitCents: 30000,
    });
    prismaMock.device.findFirst.mockResolvedValue({
      status: "ACTIVE",
      lastSeenAt: new Date(),
    });
    prismaMock.eaHeartbeat.findFirst.mockResolvedValue({
      tradeMode: "REAL",
      receivedAt: new Date(),
    });
    prismaMock.realTradingApproval.findFirst.mockResolvedValue({
      maxContracts: 2,
    });
    prismaMock.robotInstance.findFirst.mockResolvedValue(null);
    prismaMock.robotInstance.findUnique.mockResolvedValue({
      id: "ri1",
      autonomousStrategyEnabled: false,
      autonomousStrategyCode: null,
    });
    prismaMock.robotInstance.update.mockResolvedValue({
      id: "ri1",
      autonomousStrategyEnabled: true,
      autonomousStrategyCode: "MR_FIBO_D1_GUARD",
    });
  });

  it("página da licença renderiza card entre daily risk e modo operacional", () => {
    const page = readRepoFile("app/admin/licenses/[licenseId]/page.tsx");
    const card = readRepoFile(
      "components/admin/license-autonomous-strategy-card.tsx"
    );
    expect(page).toContain("LicenseAutonomousStrategyCard");
    expect(page).toContain("getLicenseAutonomousStrategyAdminView");
    expect(card).toContain("Estratégia autônoma");
    expect(card).not.toContain("PercentualFibo");
    expect(card).not.toContain("fibo");
    const dailyIdx = page.indexOf("<LicenseDailyRiskCard");
    const autoIdx = page.indexOf("<LicenseAutonomousStrategyCard");
    const modeIdx = page.indexOf("<LicenseOperationalModeCard");
    expect(dailyIdx).toBeLessThan(autoIdx);
    expect(autoIdx).toBeLessThan(modeIdx);
  });

  it("view expõe blockers quando daily risk ausente", async () => {
    prismaMock.dailyFinancialRiskLimit.findFirst.mockResolvedValue(null);
    const view = await getLicenseAutonomousStrategyAdminView("lic1");
    expect(view?.blockers).toContain("DAILY_FINANCIAL_STOP_NOT_CONFIGURED");
    expect(view?.canEnable).toBe(false);
  });

  it("habilitar exige confirmação textual correta", async () => {
    await expect(
      updateLicenseAutonomousStrategy({
        licenseId: "lic1",
        strategyCode: "MR_FIBO_D1_GUARD",
        autonomousStrategyEnabled: true,
        adminConfirmation: "ERRADO",
        actorId: "admin1",
      })
    ).rejects.toMatchObject({ code: "ADMIN_CONFIRMATION_INVALID" });
  });

  it("strategyCode inválido bloqueia", async () => {
    await expect(
      updateLicenseAutonomousStrategy({
        licenseId: "lic1",
        strategyCode: "OUTRA",
        autonomousStrategyEnabled: true,
        adminConfirmation: AUTONOMOUS_STRATEGY_ENABLE_CONFIRM_PHRASE,
        actorId: "admin1",
      })
    ).rejects.toMatchObject({ code: "STRATEGY_CODE_INVALID" });
  });

  it("habilitar atualiza RobotInstance e registra audit", async () => {
    const result = await updateLicenseAutonomousStrategy({
      licenseId: "lic1",
      strategyCode: "MR_FIBO_D1_GUARD",
      autonomousStrategyEnabled: true,
      adminConfirmation: AUTONOMOUS_STRATEGY_ENABLE_CONFIRM_PHRASE,
      actorId: "admin1",
    });
    expect(result.autonomousStrategyEnabled).toBe(true);
    expect(prismaMock.robotInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ri1" },
        data: expect.objectContaining({
          autonomousStrategyEnabled: true,
          autonomousStrategyCode: "MR_FIBO_D1_GUARD",
        }),
      })
    );
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "license.autonomous_strategy.enable",
        targetId: "lic1",
      })
    );
  });

  it("desabilitar atualiza RobotInstance", async () => {
    prismaMock.robotInstance.findUnique.mockResolvedValue({
      id: "ri1",
      autonomousStrategyEnabled: true,
      autonomousStrategyCode: "MR_FIBO_D1_GUARD",
    });
    prismaMock.robotInstance.update.mockResolvedValue({
      id: "ri1",
      autonomousStrategyEnabled: false,
      autonomousStrategyCode: null,
    });

    await updateLicenseAutonomousStrategy({
      licenseId: "lic1",
      strategyCode: "MR_FIBO_D1_GUARD",
      autonomousStrategyEnabled: false,
      adminConfirmation: AUTONOMOUS_STRATEGY_DISABLE_CONFIRM_PHRASE,
      actorId: "admin1",
    });

    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "license.autonomous_strategy.disable",
      })
    );
  });

  it("ROBOT_INSTANCE_MISSING bloqueia habilitar", async () => {
    prismaMock.license.findUnique.mockResolvedValue({
      ...baseLicense,
      robotInstances: [],
    });

    await expect(
      updateLicenseAutonomousStrategy({
        licenseId: "lic1",
        strategyCode: "MR_FIBO_D1_GUARD",
        autonomousStrategyEnabled: true,
        adminConfirmation: AUTONOMOUS_STRATEGY_ENABLE_CONFIRM_PHRASE,
        actorId: "admin1",
      })
    ).rejects.toMatchObject({ code: "ROBOT_INSTANCE_MISSING" });
  });
});
