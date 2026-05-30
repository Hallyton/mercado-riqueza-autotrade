import {
  AuditActorType,
  DeviceStatus,
  LicenseStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { ACTIVE_DEVICE_WHERE } from "@/lib/licensing/device-lifecycle";
import { createAuditLog } from "@/lib/audit/log";
import { createActivationCodeForLicense } from "@/lib/ea/activate";
import prisma from "@/lib/prisma";
import { assertLicenseAccess } from "./service";

function normalizeMt5Credentials(login: string, server: string) {
  const normalizedLogin = login.trim();
  const normalizedServer = server.trim();

  if (!normalizedLogin || !normalizedServer) {
    throw new ClientLicenseError(
      "Login e servidor MT5 são obrigatórios.",
      "VALIDATION_ERROR",
      400
    );
  }

  if (!/^\d+$/.test(normalizedLogin)) {
    throw new ClientLicenseError(
      "Login MT5 deve conter apenas números.",
      "INVALID_MT5_LOGIN",
      400
    );
  }

  return { login: normalizedLogin, server: normalizedServer };
}

export class ClientLicenseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ClientLicenseError";
  }
}

const licenseForClientInclude = {
  subscription: { include: { plan: true } },
  mt5Account: true,
} as const;

async function getLicenseForClient(userId: string, licenseId: string) {
  const allowed = await assertLicenseAccess(licenseId, userId, false);
  if (!allowed) {
    throw new ClientLicenseError("Licença não encontrada", "LICENSE_NOT_FOUND", 404);
  }

  const license = await prisma.license.findUnique({
    where: { id: licenseId },
    include: licenseForClientInclude,
  });

  if (!license || license.userId !== userId) {
    throw new ClientLicenseError("Licença não encontrada", "LICENSE_NOT_FOUND", 404);
  }

  return license;
}

function assertSubscriptionActiveForOnboarding(
  license: Awaited<ReturnType<typeof getLicenseForClient>>
) {
  const sub = license.subscription;
  if (!sub || sub.status !== SubscriptionStatus.ACTIVE) {
    throw new ClientLicenseError(
      "Assinatura inativa. Regularize o pagamento para vincular conta ou gerar código.",
      "SUBSCRIPTION_INACTIVE",
      403
    );
  }
  if (sub.currentPeriodEnd && sub.currentPeriodEnd < new Date()) {
    throw new ClientLicenseError(
      "Assinatura vencida.",
      "SUBSCRIPTION_EXPIRED",
      403
    );
  }
}

function assertLicenseEligibleForOnboarding(
  license: Awaited<ReturnType<typeof getLicenseForClient>>
) {
  if (license.status === LicenseStatus.REVOKED) {
    throw new ClientLicenseError("Licença revogada.", "LICENSE_REVOKED", 403);
  }
}

async function revokeLicenseDevicesAndPendingCodes(licenseId: string) {
  const now = new Date();

  const devices = await prisma.device.updateMany({
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

  return devices.count;
}

export async function linkMt5AccountToLicense(input: {
  userId: string;
  licenseId: string;
  login: string;
  server: string;
  brokerName?: string;
  ipAddress?: string | null;
}) {
  return updateMt5AccountForLicense(input);
}

/** Vincula ou altera a conta MT5 da licença do próprio cliente. */
export async function updateMt5AccountForLicense(input: {
  userId: string;
  licenseId: string;
  login: string;
  server: string;
  brokerName?: string;
  ipAddress?: string | null;
}) {
  const license = await getLicenseForClient(input.userId, input.licenseId);
  assertSubscriptionActiveForOnboarding(license);
  assertLicenseEligibleForOnboarding(license);

  const { login, server } = normalizeMt5Credentials(input.login, input.server);
  const plan = license.subscription!.plan;
  const isChange = Boolean(license.mt5AccountId && license.mt5Account);
  const sameAccount =
    isChange &&
    license.mt5Account!.login === login &&
    license.mt5Account!.server === server;

  if (sameAccount) {
    return {
      licenseId: license.id,
      mt5AccountId: license.mt5AccountId!,
      login,
      server,
      changed: false as const,
      devicesRevoked: 0,
    };
  }

  let devicesRevoked = 0;
  if (isChange) {
    devicesRevoked = await revokeLicenseDevicesAndPendingCodes(license.id);
  } else {
    const linkedOnSub = await prisma.license.count({
      where: {
        subscriptionId: license.subscriptionId!,
        userId: input.userId,
        mt5AccountId: { not: null },
        id: { not: license.id },
      },
    });
    if (linkedOnSub >= plan.maxMt5Accounts) {
      throw new ClientLicenseError(
        `Limite de ${plan.maxMt5Accounts} conta(s) MT5 no plano ${plan.name}.`,
        "MT5_PLAN_LIMIT",
        403
      );
    }
  }

  const existingMt5 = await prisma.mt5Account.findUnique({
    where: { login_server: { login, server } },
  });

  if (existingMt5 && existingMt5.userId !== input.userId) {
    throw new ClientLicenseError(
      "Esta conta MT5 já está vinculada a outro usuário.",
      "MT5_ALREADY_REGISTERED",
      403
    );
  }

  const mt5 =
    existingMt5 ??
    (await prisma.mt5Account.create({
      data: {
        userId: input.userId,
        login,
        server,
        brokerName: input.brokerName?.trim() || null,
      },
    }));

  if (existingMt5 && existingMt5.userId === input.userId) {
    await prisma.mt5Account.update({
      where: { id: existingMt5.id },
      data: {
        brokerName: input.brokerName?.trim() || existingMt5.brokerName,
      },
    });
  }

  const conflict = await prisma.license.findFirst({
    where: {
      mt5AccountId: mt5.id,
      id: { not: license.id },
      status: { in: [LicenseStatus.ACTIVE, LicenseStatus.PENDING_ACTIVATION] },
    },
  });
  if (conflict) {
    throw new ClientLicenseError(
      "Esta conta MT5 já está vinculada a outra licença ativa.",
      "MT5_ALREADY_LICENSED",
      403
    );
  }

  const previousLogin = license.mt5Account?.login;
  const previousServer = license.mt5Account?.server;

  await prisma.license.update({
    where: { id: license.id },
    data: { mt5AccountId: mt5.id },
  });

  await createAuditLog({
    actorType: AuditActorType.USER,
    actorId: input.userId,
    action: isChange ? "license.mt5_changed" : "license.mt5_linked",
    entityType: "license",
    entityId: license.id,
    metadata: {
      login,
      server,
      mt5AccountId: mt5.id,
      ...(isChange
        ? {
            previousLogin,
            previousServer,
            devicesRevoked,
          }
        : {}),
    },
    ipAddress: input.ipAddress,
  });

  return {
    licenseId: license.id,
    mt5AccountId: mt5.id,
    login: mt5.login,
    server: mt5.server,
    changed: isChange as boolean,
    devicesRevoked,
  };
}

export async function issueActivationCodeForClient(input: {
  userId: string;
  licenseId: string;
  ipAddress?: string | null;
}) {
  const license = await getLicenseForClient(input.userId, input.licenseId);
  assertSubscriptionActiveForOnboarding(license);
  assertLicenseEligibleForOnboarding(license);

  if (!license.mt5Account) {
    throw new ClientLicenseError(
      "Vincule a conta MT5 antes de gerar o código de ativação.",
      "MT5_NOT_LINKED",
      403
    );
  }

  if (
    license.status !== LicenseStatus.ACTIVE &&
    license.status !== LicenseStatus.PENDING_ACTIVATION
  ) {
    throw new ClientLicenseError(
      "Licença não elegível para ativação do EA.",
      "LICENSE_NOT_ELIGIBLE",
      403
    );
  }

  const { code, expiresAt } = await createActivationCodeForLicense(license.id);

  await createAuditLog({
    actorType: AuditActorType.USER,
    actorId: input.userId,
    action: "license.activation_code_issued",
    entityType: "license",
    entityId: license.id,
    metadata: { expiresAt: expiresAt.toISOString() },
    ipAddress: input.ipAddress,
  });

  return {
    code,
    expiresAt: expiresAt.toISOString(),
    expiresInMinutes: 15,
  };
}
