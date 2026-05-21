import {
  AuditActorType,
  LicenseStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { createAuditLog } from "@/lib/audit/log";
import { createActivationCodeForLicense } from "@/lib/ea/activate";
import prisma from "@/lib/prisma";
import { assertLicenseAccess } from "./service";

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

export async function linkMt5AccountToLicense(input: {
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

  const login = input.login.trim();
  const server = input.server.trim();
  if (!login || !server) {
    throw new ClientLicenseError("Login e servidor MT5 são obrigatórios.", "VALIDATION_ERROR", 400);
  }

  const plan = license.subscription!.plan;

  if (!license.mt5AccountId) {
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

  await prisma.license.update({
    where: { id: license.id },
    data: { mt5AccountId: mt5.id },
  });

  await createAuditLog({
    actorType: AuditActorType.USER,
    actorId: input.userId,
    action: "license.mt5_linked",
    entityType: "license",
    entityId: license.id,
    metadata: { login, server, mt5AccountId: mt5.id },
    ipAddress: input.ipAddress,
  });

  return {
    licenseId: license.id,
    mt5AccountId: mt5.id,
    login: mt5.login,
    server: mt5.server,
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
