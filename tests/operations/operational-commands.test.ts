import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  EAOperationalCommandStatus,
  EAOperationalCommandType,
  LicenseStatus,
} from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  license: { findUnique: vi.fn() },
  device: { findFirst: vi.fn() },
  eAOperationalCommand: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  eAOperationalSnapshot: { findUnique: vi.fn(), updateMany: vi.fn() },
  licenseOperationControl: { findUnique: vi.fn(), upsert: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

vi.mock("@/lib/admin/record-action", () => ({
  recordAdminAction: vi.fn(),
}));

vi.mock("@/lib/operations/operational-audit", () => ({
  recordOperationalAudit: vi.fn(),
}));

vi.mock("@/lib/admin/commands", () => ({
  pauseLicenseNewEntries: vi.fn(),
}));

vi.mock("@/lib/admin/ea-liveness-trace", () => ({
  loadEaLivenessForLicense: vi.fn().mockResolvedValue({
    liveness: {
      computedStatus: "ONLINE",
      blocksTrading: false,
      message: "EA online",
    },
  }),
}));

vi.mock("@/lib/ea/device-activity", () => ({
  touchEaDeviceActivity: vi.fn(),
}));

import {
  createOperationalCommand,
  listPendingCommandsForEa,
  ackOperationalCommand,
  completeOperationalCommand,
  OperationalCommandError,
} from "@/lib/operations/operational-command-service";
import { pauseLicenseNewEntries } from "@/lib/admin/commands";
import { recordAdminAction } from "@/lib/admin/record-action";

const licenseContext = {
  id: "lic1",
  status: LicenseStatus.ACTIVE,
  adminHaltNewEntries: false,
  expectedAccountLogin: null,
  expectedAccountServer: null,
  expectedSymbol: null,
  expectedMagicNumber: null,
  user: { email: "a@test.com", name: "Admin Client" },
  mt5Account: { login: "123", server: "Broker" },
  robotInstances: [
    {
      symbol: "WDON26",
      magicNumber: 910001,
      autonomousStrategyEnabled: true,
    },
  ],
};

describe("operational commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.license.findUnique.mockResolvedValue(licenseContext);
    prismaMock.device.findFirst.mockResolvedValue({
      deviceId: "dev1",
      lastSeenAt: new Date(),
    });
    prismaMock.eAOperationalCommand.findFirst.mockResolvedValue(null);
    prismaMock.licenseOperationControl.findUnique.mockResolvedValue(null);
    prismaMock.eAOperationalSnapshot.findUnique.mockResolvedValue(null);
    prismaMock.eAOperationalCommand.create.mockImplementation(async ({ data }) => ({
      id: "cmd1",
      ...data,
      requestedAt: new Date(),
    }));
  });

  it("cria comando PAUSE com confirmação correta", async () => {
    const result = await createOperationalCommand({
      licenseId: "lic1",
      commandType: EAOperationalCommandType.PAUSE_NEW_ENTRIES,
      adminConfirmation: "PAUSAR NOVAS ENTRADAS",
      actorId: "admin1",
    });

    expect(result.command.commandType).toBe("PAUSE_NEW_ENTRIES");
    expect(pauseLicenseNewEntries).toHaveBeenCalledWith(
      expect.objectContaining({ pause: true })
    );
    expect(recordAdminAction).toHaveBeenCalled();
  });

  it("bloqueia confirmação incorreta", async () => {
    await expect(
      createOperationalCommand({
        licenseId: "lic1",
        commandType: EAOperationalCommandType.PAUSE_NEW_ENTRIES,
        adminConfirmation: "ERRADO",
        actorId: "admin1",
      })
    ).rejects.toBeInstanceOf(OperationalCommandError);
  });

  it("não duplica comando PENDING", async () => {
    prismaMock.eAOperationalCommand.findFirst.mockResolvedValue({
      id: "existing",
      status: EAOperationalCommandStatus.PENDING,
    });

    await expect(
      createOperationalCommand({
        licenseId: "lic1",
        commandType: EAOperationalCommandType.REFRESH_STATUS,
        adminConfirmation: "ATUALIZAR STATUS",
        actorId: "admin1",
      })
    ).rejects.toMatchObject({ code: "DUPLICATE_PENDING_COMMAND" });
  });

  it("HEALTH_CHECK sem confirmação forte cria comando", async () => {
    const result = await createOperationalCommand({
      licenseId: "lic1",
      commandType: EAOperationalCommandType.HEALTH_CHECK,
      adminConfirmation: "",
      actorId: "admin1",
    });

    expect(result.command.commandType).toBe("HEALTH_CHECK");
    expect(result.reused).toBe(false);
  });

  it("HEALTH_CHECK duplicado pendente retorna existente", async () => {
    prismaMock.eAOperationalCommand.findFirst.mockResolvedValue({
      id: "existing-hc",
      status: EAOperationalCommandStatus.PENDING,
      commandType: EAOperationalCommandType.HEALTH_CHECK,
    });

    const result = await createOperationalCommand({
      licenseId: "lic1",
      commandType: EAOperationalCommandType.HEALTH_CHECK,
      adminConfirmation: "",
      actorId: "admin1",
    });

    expect(result.reused).toBe(true);
    expect(result.command.id).toBe("existing-hc");
  });

  it("GET pending retorna só comandos da licença/conta", async () => {
    prismaMock.eAOperationalCommand.findMany.mockResolvedValue([
      { id: "c1", commandType: "REFRESH_STATUS" },
    ]);

    const rows = await listPendingCommandsForEa({
      licenseId: "lic1",
      deviceId: "dev1",
      accountLogin: "123",
      accountServer: "Broker",
      symbol: "WDON26",
    });

    expect(rows).toHaveLength(1);
    expect(prismaMock.eAOperationalCommand.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          licenseId: "lic1",
          accountLogin: "123",
          symbol: "WDON26",
        }),
      })
    );
  });

  it("ACK atualiza status", async () => {
    prismaMock.eAOperationalCommand.findUnique.mockResolvedValue({
      id: "cmd1",
      licenseId: "lic1",
      status: EAOperationalCommandStatus.PENDING,
      expiresAt: new Date(Date.now() + 60_000),
      commandType: EAOperationalCommandType.REFRESH_STATUS,
    });
    prismaMock.eAOperationalCommand.update.mockResolvedValue({
      id: "cmd1",
      status: EAOperationalCommandStatus.ACKED,
      licenseId: "lic1",
      commandType: EAOperationalCommandType.REFRESH_STATUS,
    });

    const updated = await ackOperationalCommand({
      commandId: "cmd1",
      licenseId: "lic1",
      deviceId: "dev1",
    });

    expect(updated.status).toBe("ACKED");
  });

  it("RESULT EXECUTED atualiza status", async () => {
    prismaMock.eAOperationalCommand.findUnique.mockResolvedValue({
      id: "cmd1",
      licenseId: "lic1",
      status: EAOperationalCommandStatus.ACKED,
      commandType: EAOperationalCommandType.CANCEL_PENDING_ORDERS,
    });
    prismaMock.eAOperationalCommand.update.mockResolvedValue({
      id: "cmd1",
      licenseId: "lic1",
      status: EAOperationalCommandStatus.EXECUTED,
      commandType: EAOperationalCommandType.CANCEL_PENDING_ORDERS,
    });

    const updated = await completeOperationalCommand({
      commandId: "cmd1",
      licenseId: "lic1",
      status: "EXECUTED",
      resultCode: "OK",
      resultMessage: "ok",
    });

    expect(updated.status).toBe("EXECUTED");
  });

  it("RESULT FAILED persiste erro", async () => {
    prismaMock.eAOperationalCommand.findUnique.mockResolvedValue({
      id: "cmd1",
      licenseId: "lic1",
      status: EAOperationalCommandStatus.ACKED,
      commandType: EAOperationalCommandType.CLOSE_OPEN_POSITION,
    });
    prismaMock.eAOperationalCommand.update.mockResolvedValue({
      id: "cmd1",
      licenseId: "lic1",
      status: EAOperationalCommandStatus.FAILED,
      commandType: EAOperationalCommandType.CLOSE_OPEN_POSITION,
    });

    const updated = await completeOperationalCommand({
      commandId: "cmd1",
      licenseId: "lic1",
      status: "FAILED",
      resultCode: "NO_OPEN_POSITION",
      resultMessage: "sem posição",
    });

    expect(updated.status).toBe("FAILED");
  });
});
