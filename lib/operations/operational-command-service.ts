import {
  EAOperationalCommandStatus,
  LicenseStatus,
  type EAOperationalCommand,
  type EAOperationalCommandType,
  type Prisma,
} from "@prisma/client";
import { recordAdminAction } from "@/lib/admin/record-action";
import { recordOperationalAudit } from "@/lib/operations/operational-audit";
import { pauseLicenseNewEntries } from "@/lib/admin/commands";
import { setLicenseOperationPaused } from "@/lib/operations/license-operation-control-service";
import {
  CRITICAL_OPERATIONAL_COMMANDS,
  HEALTH_CHECK_COMMAND_EXPIRY_MS,
  NON_CONFIRMATION_OPERATIONAL_COMMANDS,
  OPERATIONAL_COMMAND_CONFIRMATIONS,
  OPERATIONAL_COMMAND_EXPIRY_MS,
} from "@/lib/operations/operational-command-constants";
import { loadEaLivenessForLicense } from "@/lib/admin/ea-liveness-trace";
import { touchEaDeviceActivity } from "@/lib/ea/device-activity";
import { ACTIVE_DEVICE_WHERE } from "@/lib/licensing/device-lifecycle";
import { MR_FIBO_D1_GUARD_CODE } from "@/lib/risk/autonomous-strategy-reasons";
import { maskAccountLogin } from "@/lib/risk/real-trading-guard-status";
import { normalizeFiboStrategyCode } from "@/lib/strategy/normalize-strategy-code";
import prisma from "@/lib/prisma";

export class OperationalCommandError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly detail?: string
  ) {
    super(message);
  }

  toPayload() {
    return {
      ok: false as const,
      code: this.code,
      message: this.message,
      detail: this.detail,
    };
  }
}

async function resolveLicenseContext(licenseId: string) {
  const license = await prisma.license.findUnique({
    where: { id: licenseId },
    include: {
      user: { select: { email: true, name: true } },
      mt5Account: true,
      robotInstances: {
        where: { autonomousStrategyEnabled: true },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!license || license.status !== LicenseStatus.ACTIVE) {
    throw new OperationalCommandError(
      "Licença não encontrada ou inativa.",
      "LICENSE_NOT_ACTIVE",
      409
    );
  }

  const robot = license.robotInstances[0];
  const accountLogin =
    license.mt5Account?.login ?? license.expectedAccountLogin ?? null;
  const accountServer =
    license.mt5Account?.server ?? license.expectedAccountServer ?? null;
  const symbol = robot?.symbol ?? license.expectedSymbol ?? null;
  const magicNumber = robot?.magicNumber ?? license.expectedMagicNumber ?? null;

  if (!accountLogin || !accountServer || !symbol) {
    throw new OperationalCommandError(
      "Licença sem conta MT5/símbolo configurado.",
      "LICENSE_CONTEXT_INCOMPLETE",
      409
    );
  }

  const device = await prisma.device.findFirst({
    where: { licenseId, ...ACTIVE_DEVICE_WHERE },
    orderBy: { lastSeenAt: "desc" },
  });

  const livenessTrace = await loadEaLivenessForLicense(licenseId);
  const livenessStatus = livenessTrace?.liveness.computedStatus ?? "OFFLINE";
  const eaOnline =
    livenessStatus === "ONLINE" || livenessStatus === "DEGRADED";

  return {
    license,
    robot,
    accountLogin,
    accountServer,
    symbol: symbol.trim().toUpperCase(),
    magicNumber,
    device,
    eaOnline,
    livenessStatus,
  };
}

export async function expireStaleOperationalCommands(now = new Date()) {
  const stale = await prisma.eAOperationalCommand.findMany({
    where: {
      status: {
        in: [EAOperationalCommandStatus.PENDING, EAOperationalCommandStatus.ACKED],
      },
      expiresAt: { lt: now },
    },
    select: { id: true, licenseId: true, commandType: true },
  });

  if (stale.length === 0) return 0;

  const expired = await prisma.eAOperationalCommand.updateMany({
    where: {
      id: { in: stale.map((row) => row.id) },
    },
    data: { status: EAOperationalCommandStatus.EXPIRED },
  });

  for (const row of stale) {
    await recordOperationalAudit({
      action:
        row.commandType === "HEALTH_CHECK"
          ? "operation.health_check.expired"
          : "operation.command.expired",
      entityType: "ea_operational_command",
      entityId: row.id,
      licenseId: row.licenseId,
      metadata: { commandId: row.id, commandType: row.commandType },
    });
  }

  return expired.count;
}

export async function createOperationalCommand(input: {
  licenseId: string;
  commandType: EAOperationalCommandType;
  adminConfirmation: string;
  adminNote?: string | null;
  actorId: string;
  ipAddress?: string | null;
  strategyCode?: string;
  allowOffline?: boolean;
}) {
  await expireStaleOperationalCommands();

  if (!NON_CONFIRMATION_OPERATIONAL_COMMANDS.has(input.commandType)) {
    const expected = OPERATIONAL_COMMAND_CONFIRMATIONS[input.commandType];
    if (input.adminConfirmation.trim() !== expected) {
      throw new OperationalCommandError(
        "Confirmação textual inválida.",
        "CONFIRMATION_INVALID",
        400,
        `Digite exatamente: ${expected}`
      );
    }
  }

  const ctx = await resolveLicenseContext(input.licenseId);
  const strategyCode = normalizeFiboStrategyCode(
    input.strategyCode ?? MR_FIBO_D1_GUARD_CODE
  );

  const existingPending = await prisma.eAOperationalCommand.findFirst({
    where: {
      licenseId: input.licenseId,
      commandType: input.commandType,
      status: {
        in: [EAOperationalCommandStatus.PENDING, EAOperationalCommandStatus.ACKED],
      },
    },
  });
  if (existingPending) {
    if (input.commandType === "HEALTH_CHECK") {
      return {
        command: existingPending,
        eaOnline: ctx.eaOnline,
        warning: "Health check já pendente — aguardando resposta do EA.",
        reused: true,
      };
    }
    throw new OperationalCommandError(
      "Já existe comando pendente deste tipo para a licença.",
      "DUPLICATE_PENDING_COMMAND",
      409,
      existingPending.id
    );
  }

  const control = await prisma.licenseOperationControl.findUnique({
    where: {
      licenseId_strategyCode: {
        licenseId: input.licenseId,
        strategyCode,
      },
    },
  });

  if (
    input.commandType === "RESUME_TRADING" &&
    !control?.paused &&
    !ctx.license.adminHaltNewEntries
  ) {
    throw new OperationalCommandError(
      "Licença não está pausada pelo centro de operações.",
      "NOT_PAUSED",
      409
    );
  }

  const snapshot = await prisma.eAOperationalSnapshot.findUnique({
    where: {
      licenseId_accountLogin_accountServer_symbol_strategyCode: {
        licenseId: input.licenseId,
        accountLogin: ctx.accountLogin,
        accountServer: ctx.accountServer,
        symbol: ctx.symbol,
        strategyCode,
      },
    },
  });

  if (
    input.commandType === "CLOSE_OPEN_POSITION" &&
    snapshot &&
    !snapshot.hasOpenPosition
  ) {
    throw new OperationalCommandError(
      "Snapshot indica ausência de posição aberta.",
      "NO_OPEN_POSITION",
      409
    );
  }

  if (
    input.commandType === "CANCEL_PENDING_ORDERS" &&
    snapshot &&
    !snapshot.hasPendingOrders
  ) {
    throw new OperationalCommandError(
      "Snapshot indica zero ordens pendentes.",
      "NO_PENDING_ORDERS",
      409
    );
  }

  if (
    CRITICAL_OPERATIONAL_COMMANDS.has(input.commandType) &&
    !ctx.eaOnline &&
    !input.allowOffline
  ) {
    throw new OperationalCommandError(
      "EA offline — comando crítico bloqueado.",
      "EA_OFFLINE",
      409
    );
  }

  const expiresAt = new Date(
    Date.now() +
      (input.commandType === "HEALTH_CHECK"
        ? HEALTH_CHECK_COMMAND_EXPIRY_MS
        : OPERATIONAL_COMMAND_EXPIRY_MS)
  );
  const command = await prisma.eAOperationalCommand.create({
    data: {
      licenseId: input.licenseId,
      deviceId: ctx.device?.deviceId ?? null,
      accountLogin: ctx.accountLogin,
      accountServer: ctx.accountServer,
      symbol: ctx.symbol,
      strategyCode,
      magicNumber: ctx.magicNumber,
      commandType: input.commandType,
      status: EAOperationalCommandStatus.PENDING,
      requestedByAdminId: input.actorId,
      expiresAt,
      confirmationText: input.adminConfirmation.trim(),
      adminNote: input.adminNote ?? null,
      requestPayloadJson: {
        eaOnline: ctx.eaOnline,
        allowOffline: input.allowOffline ?? false,
      },
      auditMetadataJson: {
        accountLogin: maskAccountLogin(ctx.accountLogin),
        symbol: ctx.symbol,
        strategyCode,
      },
    },
  });

  if (
    input.commandType === "PAUSE_NEW_ENTRIES" ||
    input.commandType === "FLATTEN_AND_PAUSE"
  ) {
    await setLicenseOperationPaused({
      licenseId: input.licenseId,
      strategyCode,
      paused: true,
      pausedByAdminId: input.actorId,
      reason: input.adminNote ?? "Pausado via centro de operações",
    });
    await pauseLicenseNewEntries({
      licenseId: input.licenseId,
      actorId: input.actorId,
      pause: true,
      ipAddress: input.ipAddress,
      reason: input.adminNote ?? undefined,
    });
    await recordAdminAction({
      actorId: input.actorId,
      action: "operation.pause.enabled",
      targetType: "license_operation_control",
      targetId: input.licenseId,
      ipAddress: input.ipAddress,
      metadata: {
        licenseId: input.licenseId,
        strategyCode,
        commandId: command.id,
        commandType: input.commandType,
      },
    });
  }

  if (input.commandType === "RESUME_TRADING") {
    await setLicenseOperationPaused({
      licenseId: input.licenseId,
      strategyCode,
      paused: false,
      pausedByAdminId: input.actorId,
    });
    await pauseLicenseNewEntries({
      licenseId: input.licenseId,
      actorId: input.actorId,
      pause: false,
      ipAddress: input.ipAddress,
      reason: input.adminNote ?? undefined,
    });
    await recordAdminAction({
      actorId: input.actorId,
      action: "operation.pause.disabled",
      targetType: "license_operation_control",
      targetId: input.licenseId,
      ipAddress: input.ipAddress,
      metadata: {
        licenseId: input.licenseId,
        strategyCode,
        commandId: command.id,
        commandType: input.commandType,
      },
    });
  }

  await recordAdminAction({
    actorId: input.actorId,
    action:
      input.commandType === "HEALTH_CHECK"
        ? "operation.health_check.created"
        : "operation.command.created",
    targetType: "ea_operational_command",
    targetId: command.id,
    ipAddress: input.ipAddress,
    metadata: {
      commandId: command.id,
      licenseId: input.licenseId,
      commandType: input.commandType,
      accountLogin: maskAccountLogin(ctx.accountLogin),
      symbol: ctx.symbol,
      strategyCode,
      eaOnline: ctx.eaOnline,
    },
  });

  return {
    command,
    eaOnline: ctx.eaOnline,
    warning: ctx.eaOnline
      ? null
      : "EA offline — comando ficará PENDING até o EA buscar.",
    reused: false,
  };
}

export async function listPendingCommandsForEa(input: {
  licenseId: string;
  deviceId: string;
  accountLogin: string;
  accountServer: string;
  symbol: string;
}) {
  await expireStaleOperationalCommands();
  const symbol = input.symbol.trim().toUpperCase();
  const login = input.accountLogin.trim();

  return prisma.eAOperationalCommand.findMany({
    where: {
      licenseId: input.licenseId,
      status: EAOperationalCommandStatus.PENDING,
      expiresAt: { gt: new Date() },
      accountLogin: login,
      accountServer: input.accountServer.trim(),
      symbol,
      OR: [{ deviceId: null }, { deviceId: input.deviceId }],
    },
    orderBy: { requestedAt: "asc" },
    take: 10,
  });
}

export async function ackOperationalCommand(input: {
  commandId: string;
  licenseId: string;
  deviceId: string;
  message?: string;
}) {
  const command = await prisma.eAOperationalCommand.findUnique({
    where: { id: input.commandId },
  });
  if (!command || command.licenseId !== input.licenseId) {
    throw new OperationalCommandError("Comando não encontrado.", "NOT_FOUND", 404);
  }
  if (command.status !== EAOperationalCommandStatus.PENDING) {
    return command;
  }
  if (command.expiresAt < new Date()) {
    return prisma.eAOperationalCommand.update({
      where: { id: command.id },
      data: { status: EAOperationalCommandStatus.EXPIRED },
    });
  }

  const updated = await prisma.eAOperationalCommand.update({
    where: { id: command.id },
    data: {
      status: EAOperationalCommandStatus.ACKED,
      ackedAt: new Date(),
      deviceId: input.deviceId,
      eaResponseJson: { ackMessage: input.message ?? null },
    },
  });

  const deviceRow = await prisma.device.findFirst({
    where: { licenseId: input.licenseId, deviceId: input.deviceId },
  });
  if (deviceRow) {
    await touchEaDeviceActivity({
      deviceId: deviceRow.id,
      licenseId: input.licenseId,
      source:
        command.commandType === "HEALTH_CHECK"
          ? "HEALTH_CHECK_ACK"
          : "COMMAND_ACK",
      requestId: command.id,
    });
  }

  await recordOperationalAudit({
    action:
      command.commandType === "HEALTH_CHECK"
        ? "operation.health_check.acked"
        : "operation.command.acked",
    entityType: "ea_operational_command",
    entityId: updated.id,
    licenseId: updated.licenseId,
    metadata: { commandId: updated.id, commandType: updated.commandType },
  });

  return updated;
}

export async function completeOperationalCommand(input: {
  commandId: string;
  licenseId: string;
  status: "EXECUTED" | "FAILED";
  resultCode: string;
  resultMessage: string;
  details?: Record<string, unknown>;
}) {
  const command = await prisma.eAOperationalCommand.findUnique({
    where: { id: input.commandId },
  });
  if (!command || command.licenseId !== input.licenseId) {
    throw new OperationalCommandError("Comando não encontrado.", "NOT_FOUND", 404);
  }

  const now = new Date();
  const updated = await prisma.eAOperationalCommand.update({
    where: { id: command.id },
    data: {
      status:
        input.status === "EXECUTED"
          ? EAOperationalCommandStatus.EXECUTED
          : EAOperationalCommandStatus.FAILED,
      executedAt: input.status === "EXECUTED" ? now : null,
      failedAt: input.status === "FAILED" ? now : null,
      resultCode: input.resultCode,
      resultMessage: input.resultMessage,
      eaResponseJson: (input.details ?? {}) as Prisma.InputJsonValue,
    },
  });

  await prisma.eAOperationalSnapshot.updateMany({
    where: { licenseId: input.licenseId },
    data: {
      lastCommandId: updated.id,
      lastCommandStatus: updated.status,
      lastExecutionError:
        input.status === "FAILED" ? input.resultMessage : null,
    },
  });

  const deviceRow = await prisma.device.findFirst({
    where: {
      licenseId: input.licenseId,
      ...(updated.deviceId ?? command.deviceId
        ? { deviceId: updated.deviceId ?? command.deviceId ?? undefined }
        : ACTIVE_DEVICE_WHERE),
    },
    orderBy: { lastActivityAt: "desc" },
  });
  if (deviceRow) {
    await touchEaDeviceActivity({
      deviceId: deviceRow.id,
      licenseId: input.licenseId,
      source:
        command.commandType === "HEALTH_CHECK"
          ? "HEALTH_CHECK_RESULT"
          : "COMMAND_RESULT",
      requestId: command.id,
    });
  }

  await recordOperationalAudit({
    action:
      input.status === "EXECUTED"
        ? command.commandType === "HEALTH_CHECK"
          ? "operation.health_check.executed"
          : "operation.command.executed"
        : command.commandType === "HEALTH_CHECK"
          ? "operation.health_check.failed"
          : "operation.command.failed",
    entityType: "ea_operational_command",
    entityId: updated.id,
    licenseId: updated.licenseId,
    metadata: {
      commandId: updated.id,
      resultCode: input.resultCode,
      commandType: updated.commandType,
    },
  });

  return updated;
}

export async function listOperationalCommandsForLicense(
  licenseId: string,
  take = 30
): Promise<EAOperationalCommand[]> {
  return prisma.eAOperationalCommand.findMany({
    where: { licenseId },
    orderBy: { requestedAt: "desc" },
    take,
  });
}
