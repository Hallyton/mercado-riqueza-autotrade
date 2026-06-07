import {
  DeviceStatus,
  LicenseStatus,
  TradeMode,
} from "@prisma/client";
import { z } from "zod";
import {
  assertMt5AccountAvailableForLicense,
} from "@/lib/admin/mt5-account-ownership";
import { recordAdminAction } from "@/lib/admin/record-action";
import { LicenseDeviceAdminError } from "@/lib/admin/license-devices";
import {
  MAGIC_NUMBER_MAX,
  MAGIC_NUMBER_MIN,
} from "@/lib/commercial/constants";
import {
  allocateMagicNumber,
  assertMagicNumberAvailable,
  MagicNumberError,
} from "@/lib/commercial/magic-number";
import { ACTIVE_DEVICE_WHERE } from "@/lib/licensing/device-lifecycle";
import prisma from "@/lib/prisma";
import { maskLicenseId } from "@/lib/risk/real-trading-guard-status";

export const MT5_ACCOUNT_REAL_CONFIRM_PHRASE = "CONFIGURAR CONTA REAL MT5";
export const MT5_ACCOUNT_DEMO_CONFIRM_PHRASE = "CONFIGURAR CONTA DEMO MT5";

export const licenseMt5AccountSchema = z.object({
  admin_confirmation: z.string().min(1),
  account_login: z.string().min(1).max(32),
  account_server: z.string().min(1).max(128),
  expected_trade_mode: z.enum(["DEMO", "REAL"]),
  expected_symbol: z.string().min(1).max(32).optional(),
  expected_magic_number: z.coerce.number().int().positive().optional(),
});

function normalizeMt5Credentials(login: string, server: string) {
  const normalizedLogin = login.trim();
  const normalizedServer = server.trim();

  if (!normalizedLogin || !normalizedServer) {
    throw new LicenseDeviceAdminError(
      "Login e servidor MT5 são obrigatórios.",
      "VALIDATION_ERROR",
      400
    );
  }

  if (!/^\d+$/.test(normalizedLogin)) {
    throw new LicenseDeviceAdminError(
      "Login MT5 deve conter apenas números.",
      "INVALID_MT5_LOGIN",
      400
    );
  }

  return { login: normalizedLogin, server: normalizedServer };
}

function assertMagicInRange(magicNumber: number) {
  if (magicNumber < MAGIC_NUMBER_MIN || magicNumber > MAGIC_NUMBER_MAX) {
    throw new LicenseDeviceAdminError(
      `MagicNumber deve estar entre ${MAGIC_NUMBER_MIN} e ${MAGIC_NUMBER_MAX}.`,
      "MAGIC_NUMBER_OUT_OF_RANGE",
      400
    );
  }
}

async function assertMagicAvailableForLicense(
  magicNumber: number,
  licenseId: string,
  license: {
    expectedMagicNumber: number | null;
    robotInstances: { magicNumber: number | null }[];
  }
) {
  assertMagicInRange(magicNumber);

  const ownedByLicense =
    license.expectedMagicNumber === magicNumber ||
    license.robotInstances.some((r) => r.magicNumber === magicNumber);

  if (ownedByLicense) return;

  try {
    await assertMagicNumberAvailable(magicNumber);
  } catch (e) {
    if (e instanceof MagicNumberError) {
      throw new LicenseDeviceAdminError(e.message, e.code, 409);
    }
    throw e;
  }
}

async function revokeActiveDevicesAndPendingCodes(licenseId: string) {
  const now = new Date();
  await prisma.device.updateMany({
    where: { licenseId, ...ACTIVE_DEVICE_WHERE },
    data: {
      status: DeviceStatus.REVOKED,
      revokedAt: now,
    },
  });
  await prisma.activationCode.updateMany({
    where: { licenseId, usedAt: null },
    data: { usedAt: now },
  });
}

async function resolveMagicNumber(input: {
  licenseId: string;
  requested?: number;
  license: {
    expectedMagicNumber: number | null;
    robotInstances: { id: string; magicNumber: number | null }[];
  };
}): Promise<number> {
  if (input.requested != null) {
    await assertMagicAvailableForLicense(
      input.requested,
      input.licenseId,
      input.license
    );
    return input.requested;
  }

  const fromRobot = input.license.robotInstances.find(
    (r) => r.magicNumber != null
  )?.magicNumber;
  if (fromRobot != null) return fromRobot;

  if (input.license.expectedMagicNumber != null) {
    return input.license.expectedMagicNumber;
  }

  return allocateMagicNumber();
}

export async function bindLicenseMt5Account(input: {
  licenseId: string;
  actorId: string;
  adminConfirmation: string;
  accountLogin: string;
  accountServer: string;
  expectedTradeMode: TradeMode;
  expectedSymbol?: string;
  expectedMagicNumber?: number;
  ipAddress?: string | null;
}) {
  const expectedPhrase =
    input.expectedTradeMode === TradeMode.REAL
      ? MT5_ACCOUNT_REAL_CONFIRM_PHRASE
      : MT5_ACCOUNT_DEMO_CONFIRM_PHRASE;

  if (input.adminConfirmation.trim() !== expectedPhrase) {
    throw new LicenseDeviceAdminError(
      `Confirmação inválida. Digite: ${expectedPhrase}`,
      "CONFIRMATION_MISMATCH",
      400
    );
  }

  const license = await prisma.license.findUnique({
    where: { id: input.licenseId },
    include: {
      mt5Account: true,
      subscription: { include: { plan: true } },
      robotInstances: { select: { id: true, magicNumber: true, symbol: true } },
    },
  });

  if (!license) {
    throw new LicenseDeviceAdminError(
      "Licença não encontrada.",
      "LICENSE_NOT_FOUND",
      404
    );
  }

  if (license.status === LicenseStatus.REVOKED) {
    throw new LicenseDeviceAdminError("Licença revogada.", "LICENSE_REVOKED", 403);
  }

  const { login, server } = normalizeMt5Credentials(
    input.accountLogin,
    input.accountServer
  );

  const magicNumber = await resolveMagicNumber({
    licenseId: license.id,
    requested: input.expectedMagicNumber,
    license,
  });

  const isChange = Boolean(license.mt5AccountId && license.mt5Account);
  const sameAccount =
    isChange &&
    license.mt5Account!.login === login &&
    license.mt5Account!.server === server;

  if (!sameAccount && isChange) {
    await revokeActiveDevicesAndPendingCodes(license.id);
  }

  const existingMt5 = await prisma.mt5Account.findUnique({
    where: { login_server: { login, server } },
  });

  if (existingMt5 && existingMt5.userId !== license.userId) {
    await assertMt5AccountAvailableForLicense({
      licenseId: license.id,
      userId: license.userId,
      accountLogin: login,
      accountServer: server,
    });
  }

  const mt5 =
    existingMt5 ??
    (await prisma.mt5Account.create({
      data: {
        userId: license.userId,
        login,
        server,
      },
    }));

  const conflict = await prisma.license.findFirst({
    where: {
      mt5AccountId: mt5.id,
      id: { not: license.id },
      status: { in: [LicenseStatus.ACTIVE, LicenseStatus.PENDING_ACTIVATION] },
    },
  });
  if (conflict) {
    throw new LicenseDeviceAdminError(
      "Esta conta MT5 já está vinculada a outra licença ativa.",
      "MT5_ALREADY_LICENSED",
      403
    );
  }

  const symbol = input.expectedSymbol?.trim() || license.expectedSymbol || null;

  const updated = await prisma.license.update({
    where: { id: license.id },
    data: {
      mt5AccountId: mt5.id,
      expectedTradeMode: input.expectedTradeMode,
      expectedAccountLogin: login,
      expectedAccountServer: server,
      expectedSymbol: symbol,
      expectedMagicNumber: magicNumber,
    },
    include: { mt5Account: true },
  });

  for (const instance of license.robotInstances) {
    await prisma.robotInstance.update({
      where: { id: instance.id },
      data: {
        magicNumber: instance.magicNumber ?? magicNumber,
        symbol: symbol ?? instance.symbol,
      },
    });
  }

  await recordAdminAction({
    actorId: input.actorId,
    action: isChange ? "license.mt5_account_updated" : "license.mt5_account_bound",
    targetType: "license",
    targetId: license.id,
    ipAddress: input.ipAddress,
    metadata: {
      licenseIdMasked: maskLicenseId(license.id),
      login,
      server,
      expectedTradeMode: input.expectedTradeMode,
      expectedSymbol: symbol,
      expectedMagicNumber: magicNumber,
      ...(isChange && !sameAccount
        ? {
            previousLogin: license.mt5Account?.login,
            previousServer: license.mt5Account?.server,
          }
        : {}),
    },
  });

  return {
    licenseId: updated.id,
    linked: true as const,
    mt5Account: {
      login: updated.mt5Account!.login,
      server: updated.mt5Account!.server,
    },
    expectedTradeMode: updated.expectedTradeMode,
    expectedSymbol: updated.expectedSymbol,
    expectedMagicNumber: updated.expectedMagicNumber,
  };
}

export async function getLicenseMt5BindingAudit(licenseId: string) {
  const action = await prisma.adminAction.findFirst({
    where: {
      targetType: "license",
      targetId: licenseId,
      action: { in: ["license.mt5_account_bound", "license.mt5_account_updated"] },
    },
    orderBy: { createdAt: "desc" },
    include: {
      actor: { select: { email: true, name: true } },
    },
  });

  if (!action) return null;

  return {
    changedAt: action.createdAt,
    changedBy: action.actor.name ?? action.actor.email,
  };
}
