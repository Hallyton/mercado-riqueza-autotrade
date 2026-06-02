import { beforeEach, describe, expect, it, vi } from "vitest";
import { LicenseStatus, TradeMode } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  default: {
    license: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    mt5Account: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    device: { updateMany: vi.fn(), create: vi.fn() },
    activationCode: { updateMany: vi.fn() },
    robotInstance: { update: vi.fn() },
    adminAction: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/admin/record-action", () => ({
  recordAdminAction: vi.fn(),
}));

vi.mock("@/lib/ea/activate", () => ({
  createActivationCodeForLicense: vi.fn(),
}));

vi.mock("@/lib/commercial/magic-number", () => ({
  allocateMagicNumber: vi.fn().mockResolvedValue(910001),
  assertMagicNumberAvailable: vi.fn().mockResolvedValue(undefined),
  MagicNumberError: class MagicNumberError extends Error {
    code = "MAGIC_NUMBER_COLLISION";
  },
}));

import prisma from "@/lib/prisma";
import { recordAdminAction } from "@/lib/admin/record-action";
import { createActivationCodeForLicense } from "@/lib/ea/activate";
import {
  issueActivationCodeForAdmin,
  ADMIN_ACTIVATION_CODE_CONFIRM_PHRASE,
} from "@/lib/admin/license-devices";
import {
  bindLicenseMt5Account,
  MT5_ACCOUNT_REAL_CONFIRM_PHRASE,
  MT5_ACCOUNT_DEMO_CONFIRM_PHRASE,
} from "@/lib/admin/license-mt5-account";

const baseLicense = {
  id: "lic-1",
  userId: "user-1",
  status: LicenseStatus.ACTIVE,
  mt5AccountId: null,
  mt5Account: null,
  expectedSymbol: null,
  expectedMagicNumber: null,
  subscription: { plan: { maxMt5Accounts: 2 } },
  robotInstances: [] as { id: string; magicNumber: number | null; symbol: string | null }[],
};

describe("admin license MT5 account binding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.device.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.activationCode.updateMany).mockResolvedValue({ count: 0 });
  });

  it("vincula conta MT5 e sincroniza campos expected", async () => {
    vi.mocked(prisma.license.findUnique).mockResolvedValue(baseLicense as never);
    vi.mocked(prisma.mt5Account.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.mt5Account.create).mockResolvedValue({
      id: "mt5-1",
      login: "19583778",
      server: "XPMTS-PRD",
    } as never);
    vi.mocked(prisma.license.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.license.update).mockResolvedValue({
      id: "lic-1",
      expectedTradeMode: TradeMode.REAL,
      expectedSymbol: "WDOM26",
      expectedMagicNumber: 910001,
      mt5Account: { login: "19583778", server: "XPMTS-PRD" },
    } as never);

    const result = await bindLicenseMt5Account({
      licenseId: "lic-1",
      actorId: "admin-1",
      adminConfirmation: MT5_ACCOUNT_REAL_CONFIRM_PHRASE,
      accountLogin: "19583778",
      accountServer: "XPMTS-PRD",
      expectedTradeMode: TradeMode.REAL,
      expectedSymbol: "WDOM26",
      expectedMagicNumber: 910001,
    });

    expect(result.linked).toBe(true);
    expect(prisma.license.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          expectedAccountLogin: "19583778",
          expectedAccountServer: "XPMTS-PRD",
          expectedTradeMode: TradeMode.REAL,
          expectedMagicNumber: 910001,
        }),
      })
    );
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "license.mt5_account_bound" })
    );
    expect(prisma.device.create).not.toHaveBeenCalled();
  });

  it("REAL exige confirmação textual correta", async () => {
    vi.mocked(prisma.license.findUnique).mockResolvedValue(baseLicense as never);

    await expect(
      bindLicenseMt5Account({
        licenseId: "lic-1",
        actorId: "admin-1",
        adminConfirmation: "errado",
        accountLogin: "1",
        accountServer: "S",
        expectedTradeMode: TradeMode.REAL,
      })
    ).rejects.toMatchObject({ code: "CONFIRMATION_MISMATCH" });
  });

  it("DEMO exige frase DEMO", async () => {
    vi.mocked(prisma.license.findUnique).mockResolvedValue(baseLicense as never);

    await expect(
      bindLicenseMt5Account({
        licenseId: "lic-1",
        actorId: "admin-1",
        adminConfirmation: MT5_ACCOUNT_REAL_CONFIRM_PHRASE,
        accountLogin: "1",
        accountServer: "S",
        expectedTradeMode: TradeMode.DEMO,
      })
    ).rejects.toMatchObject({ code: "CONFIRMATION_MISMATCH" });

    vi.mocked(prisma.mt5Account.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.mt5Account.create).mockResolvedValue({
      id: "mt5-d",
      login: "1",
      server: "S",
    } as never);
    vi.mocked(prisma.license.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.license.update).mockResolvedValue({
      id: "lic-1",
      mt5Account: { login: "1", server: "S" },
    } as never);

    await bindLicenseMt5Account({
      licenseId: "lic-1",
      actorId: "admin-1",
      adminConfirmation: MT5_ACCOUNT_DEMO_CONFIRM_PHRASE,
      accountLogin: "1",
      accountServer: "S",
      expectedTradeMode: TradeMode.DEMO,
    });

    expect(recordAdminAction).toHaveBeenCalled();
  });

  it("não cria Device ao vincular conta", async () => {
    vi.mocked(prisma.license.findUnique).mockResolvedValue(baseLicense as never);
    vi.mocked(prisma.mt5Account.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.mt5Account.create).mockResolvedValue({
      id: "mt5-1",
      login: "1",
      server: "S",
    } as never);
    vi.mocked(prisma.license.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.license.update).mockResolvedValue({
      id: "lic-1",
      mt5Account: { login: "1", server: "S" },
    } as never);

    await bindLicenseMt5Account({
      licenseId: "lic-1",
      actorId: "admin-1",
      adminConfirmation: MT5_ACCOUNT_DEMO_CONFIRM_PHRASE,
      accountLogin: "1",
      accountServer: "S",
      expectedTradeMode: TradeMode.DEMO,
    });

    expect(prisma.device.create).not.toHaveBeenCalled();
  });
});

describe("activation code after MT5 bind", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não gera código sem conta vinculada", async () => {
    vi.mocked(prisma.license.findUnique).mockResolvedValue({
      id: "lic-1",
      status: LicenseStatus.ACTIVE,
      mt5Account: null,
      subscription: {
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 86400000),
      },
    } as never);

    await expect(
      issueActivationCodeForAdmin({
        licenseId: "lic-1",
        actorId: "admin-1",
        adminConfirmation: ADMIN_ACTIVATION_CODE_CONFIRM_PHRASE,
      })
    ).rejects.toMatchObject({ code: "MT5_NOT_LINKED" });

    expect(createActivationCodeForLicense).not.toHaveBeenCalled();
  });
});
