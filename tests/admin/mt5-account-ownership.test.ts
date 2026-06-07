import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DeviceStatus,
  EAOperationalCommandStatus,
  LicenseStatus,
  RealTradingApprovalStatus,
  SubscriptionStatus,
  UserStatus,
} from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  mt5Account: {
    findUnique: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  },
  license: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  device: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  eAOperationalSnapshot: { findMany: vi.fn() },
  eAOperationalCommand: { findFirst: vi.fn() },
  realTradingApproval: { findFirst: vi.fn() },
  eaHeartbeat: { findFirst: vi.fn() },
  activationCode: { updateMany: vi.fn() },
  robotInstance: { update: vi.fn(), updateMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

vi.mock("@/lib/admin/record-action", () => ({
  recordAdminAction: vi.fn(),
}));

import { recordAdminAction } from "@/lib/admin/record-action";
import {
  MT5_OWNERSHIP_RELEASE_CONFIRM_PHRASE,
  MT5_OWNERSHIP_TRANSFER_CONFIRM_PHRASE,
  releaseMt5AccountOwnership,
  traceMt5AccountOwnership,
  transferMt5AccountOwnership,
} from "@/lib/admin/mt5-account-ownership";

const inactiveOwnerMt5 = {
  id: "mt5-1",
  login: "4598526",
  server: "BancoBTGPactual-PRD",
  userId: "old-user",
  user: {
    id: "old-user",
    email: "old@test.com",
    status: UserStatus.INACTIVE,
  },
  licenses: [
    {
      id: "old-lic",
      status: LicenseStatus.REVOKED,
      expectedAccountLogin: "4598526",
      expectedAccountServer: "BancoBTGPactual-PRD",
      subscription: { status: SubscriptionStatus.CANCELLED },
      robotInstances: [{ id: "robot-1" }],
      devices: [],
    },
  ],
};

describe("mt5 account ownership trace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.device.findMany.mockResolvedValue([]);
    prismaMock.eAOperationalSnapshot.findMany.mockResolvedValue([]);
    prismaMock.eAOperationalCommand.findFirst.mockResolvedValue(null);
    prismaMock.realTradingApproval.findFirst.mockResolvedValue(null);
    prismaMock.eaHeartbeat.findFirst.mockResolvedValue(null);
  });

  it("conta livre retorna MT5_ACCOUNT_AVAILABLE", async () => {
    prismaMock.mt5Account.findUnique.mockResolvedValue(null);

    const trace = await traceMt5AccountOwnership({
      accountLogin: "4598526",
      accountServer: "BancoBTGPactual-PRD",
      actorId: "admin-1",
    });

    expect(trace.reasonCode).toBe("MT5_ACCOUNT_AVAILABLE");
    expect(trace.canRelease).toBe(false);
  });

  it("conta vinculada a usuário cancelado retorna canRelease true", async () => {
    prismaMock.mt5Account.findUnique.mockResolvedValue(inactiveOwnerMt5);

    const trace = await traceMt5AccountOwnership({
      accountLogin: "4598526",
      accountServer: "BancoBTGPactual-PRD",
      actorId: "admin-1",
    });

    expect(trace.reasonCode).toBe("MT5_ACCOUNT_HELD_BY_DELETED_USER");
    expect(trace.canRelease).toBe(true);
    expect(trace.canTransfer).toBe(true);
  });

  it("conta vinculada a usuário ativo bloqueia release", async () => {
    prismaMock.mt5Account.findUnique.mockResolvedValue({
      ...inactiveOwnerMt5,
      user: { ...inactiveOwnerMt5.user, status: UserStatus.ACTIVE },
      licenses: [
        {
          ...inactiveOwnerMt5.licenses[0],
          status: LicenseStatus.ACTIVE,
          subscription: { status: SubscriptionStatus.ACTIVE },
        },
      ],
    });

    const trace = await traceMt5AccountOwnership({
      accountLogin: "4598526",
      accountServer: "BancoBTGPactual-PRD",
      actorId: "admin-1",
    });

    expect(trace.reasonCode).toBe("MT5_ACCOUNT_OWNED_BY_ACTIVE_LICENSE");
    expect(trace.canRelease).toBe(false);
  });

  it("release bloqueia com device ativo recente", async () => {
    prismaMock.mt5Account.findUnique.mockResolvedValue(inactiveOwnerMt5);
    prismaMock.device.findMany.mockResolvedValue([
      { lastSeenAt: new Date(), lastActivityAt: new Date() },
    ]);

    const trace = await traceMt5AccountOwnership({
      accountLogin: "4598526",
      accountServer: "BancoBTGPactual-PRD",
      actorId: "admin-1",
    });

    expect(trace.canRelease).toBe(false);
    expect(trace.blockReasons).toContain(
      "EA com atividade autenticada recente."
    );
  });

  it("release bloqueia com posição aberta em snapshot", async () => {
    prismaMock.mt5Account.findUnique.mockResolvedValue(inactiveOwnerMt5);
    prismaMock.eAOperationalSnapshot.findMany.mockResolvedValue([
      { hasOpenPosition: true, hasPendingOrders: false, pendingOrdersCount: 0 },
    ]);

    const trace = await traceMt5AccountOwnership({
      accountLogin: "4598526",
      accountServer: "BancoBTGPactual-PRD",
      actorId: "admin-1",
    });

    expect(trace.canRelease).toBe(false);
    expect(trace.blockReasons).toContain(
      "Snapshot operacional indica posição aberta."
    );
  });
});

describe("mt5 account ownership release", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.device.findMany.mockResolvedValue([]);
    prismaMock.eAOperationalSnapshot.findMany.mockResolvedValue([]);
    prismaMock.eAOperationalCommand.findFirst.mockResolvedValue(null);
    prismaMock.realTradingApproval.findFirst.mockResolvedValue(null);
    prismaMock.eaHeartbeat.findFirst.mockResolvedValue(null);
    prismaMock.license.findMany.mockResolvedValue(inactiveOwnerMt5.licenses);
    prismaMock.license.update.mockResolvedValue({});
    prismaMock.device.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.activationCode.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.mt5Account.delete.mockResolvedValue({});
  });

  it("release libera conta órfã segura", async () => {
    prismaMock.mt5Account.findUnique
      .mockResolvedValueOnce(inactiveOwnerMt5)
      .mockResolvedValueOnce(inactiveOwnerMt5)
      .mockResolvedValueOnce(inactiveOwnerMt5);

    const result = await releaseMt5AccountOwnership({
      accountLogin: "4598526",
      accountServer: "BancoBTGPactual-PRD",
      adminConfirmation: MT5_OWNERSHIP_RELEASE_CONFIRM_PHRASE,
      adminNote: "Usuário antigo inativo.",
      actorId: "admin-1",
    });

    expect(result.released).toBe(true);
    expect(prismaMock.mt5Account.delete).toHaveBeenCalled();
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "mt5_account.ownership.released" })
    );
  });

  it("release bloqueia com approval REAL ativa", async () => {
    prismaMock.mt5Account.findUnique.mockResolvedValue(inactiveOwnerMt5);
    prismaMock.realTradingApproval.findFirst.mockResolvedValue({
      id: "appr-1",
      status: RealTradingApprovalStatus.APPROVED,
    });

    await expect(
      releaseMt5AccountOwnership({
        accountLogin: "4598526",
        accountServer: "BancoBTGPactual-PRD",
        adminConfirmation: MT5_OWNERSHIP_RELEASE_CONFIRM_PHRASE,
        adminNote: "Tentativa bloqueada.",
        actorId: "admin-1",
      })
    ).rejects.toMatchObject({ code: "MT5_ACCOUNT_HELD_BY_DELETED_USER" });

    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "mt5_account.ownership.release_failed" })
    );
  });
});

describe("mt5 account ownership transfer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.device.findMany.mockResolvedValue([]);
    prismaMock.eAOperationalSnapshot.findMany.mockResolvedValue([]);
    prismaMock.eAOperationalCommand.findFirst.mockResolvedValue(null);
    prismaMock.realTradingApproval.findFirst.mockResolvedValue(null);
    prismaMock.eaHeartbeat.findFirst.mockResolvedValue(null);
    prismaMock.license.findMany.mockResolvedValue(inactiveOwnerMt5.licenses);
    prismaMock.license.update.mockResolvedValue({
      id: "new-lic",
      expectedTradeMode: "REAL",
    });
    prismaMock.device.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.activationCode.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.robotInstance.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.mt5Account.update.mockResolvedValue({});
  });

  it("transfer move conta para nova licença", async () => {
    prismaMock.license.findUnique
      .mockResolvedValueOnce({
        id: "old-lic",
        userId: "old-user",
        mt5AccountId: "mt5-1",
        user: { id: "old-user", email: "old@test.com" },
        mt5Account: inactiveOwnerMt5,
      })
      .mockResolvedValueOnce({
        id: "new-lic",
        userId: "new-user",
        status: LicenseStatus.ACTIVE,
        mt5Account: null,
        user: { id: "new-user", email: "new@test.com" },
      });
    prismaMock.mt5Account.findUnique
      .mockResolvedValueOnce(inactiveOwnerMt5)
      .mockResolvedValueOnce(inactiveOwnerMt5)
      .mockResolvedValueOnce(inactiveOwnerMt5);

    const result = await transferMt5AccountOwnership({
      fromLicenseId: "old-lic",
      toLicenseId: "new-lic",
      accountLogin: "4598526",
      accountServer: "BancoBTGPactual-PRD",
      symbol: "WDON26",
      magicNumber: 910003,
      environment: "REAL",
      adminConfirmation: MT5_OWNERSHIP_TRANSFER_CONFIRM_PHRASE,
      adminNote: "Transferência após cancelamento.",
      actorId: "admin-1",
    });

    expect(result.transferred).toBe(true);
    expect(prismaMock.mt5Account.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: "new-user" },
      })
    );
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "mt5_account.ownership.transfered" })
    );
  });

  it("transfer bloqueia se destino já tem conta conflitante", async () => {
    prismaMock.license.findUnique
      .mockResolvedValueOnce({
        id: "old-lic",
        userId: "old-user",
        mt5AccountId: "mt5-1",
        user: { id: "old-user", email: "old@test.com" },
        mt5Account: inactiveOwnerMt5,
      })
      .mockResolvedValueOnce({
        id: "new-lic",
        userId: "new-user",
        status: LicenseStatus.ACTIVE,
        mt5Account: { login: "999", server: "Other" },
        user: { id: "new-user", email: "new@test.com" },
      });
    prismaMock.mt5Account.findUnique.mockResolvedValue(inactiveOwnerMt5);

    await expect(
      transferMt5AccountOwnership({
        fromLicenseId: "old-lic",
        toLicenseId: "new-lic",
        accountLogin: "4598526",
        accountServer: "BancoBTGPactual-PRD",
        symbol: "WDON26",
        magicNumber: 910003,
        environment: "REAL",
        adminConfirmation: MT5_OWNERSHIP_TRANSFER_CONFIRM_PHRASE,
        adminNote: "Conflito destino.",
        actorId: "admin-1",
      })
    ).rejects.toMatchObject({ code: "TO_LICENSE_MT5_CONFLICT" });
  });
});
