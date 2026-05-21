import {
  AuditActorType,
  LicenseStatus,
  SubscriptionStatus,
  type License,
  type Prisma,
} from "@prisma/client";
import { createAuditLog } from "@/lib/audit/log";
import prisma from "@/lib/prisma";
import {
  buildOperationalMessage,
  canAcceptNewEntries,
  canManageOpenPositions,
} from "./flags";
import { resolveSubscriptionDisplayStatus } from "./display";
import type {
  LicenseOperationalFlags,
  LicenseStatusApiResponse,
} from "./types";

const licenseWithSubInclude = {
  subscription: { include: { plan: true } },
  exposureProfile: true,
  mt5Account: true,
} satisfies Prisma.LicenseInclude;

export async function syncLicenseFlags(
  licenseId: string,
  options?: {
    actorId?: string | null;
    actorType?: AuditActorType;
    reason?: string;
  }
) {
  const license = await prisma.license.findUniqueOrThrow({
    where: { id: licenseId },
    include: { subscription: true },
  });

  const subscriptionActive =
    license.subscription?.status === SubscriptionStatus.ACTIVE;
  const licenseActive = license.status === LicenseStatus.ACTIVE;

  const policyHaltNewEntries = !(subscriptionActive && licenseActive);
  const haltNewEntries = policyHaltNewEntries || license.adminHaltNewEntries;

  if (license.haltNewEntries === haltNewEntries) {
    return license;
  }

  const updated = await prisma.license.update({
    where: { id: licenseId },
    data: { haltNewEntries },
  });

  await createAuditLog({
    actorType: options?.actorType ?? AuditActorType.SYSTEM,
    actorId: options?.actorId ?? null,
    action: "license.flags_synced",
    entityType: "license",
    entityId: licenseId,
    metadata: {
      haltNewEntries,
      adminHaltNewEntries: license.adminHaltNewEntries,
      policyHaltNewEntries,
      haltAllTrading: license.haltAllTrading,
      licenseStatus: license.status,
      subscriptionStatus: license.subscription?.status ?? null,
      reason: options?.reason,
    },
  });

  return updated;
}

export async function syncLicensesForSubscription(
  subscriptionId: string,
  options?: { actorId?: string | null; reason?: string }
) {
  const licenses = await prisma.license.findMany({
    where: { subscriptionId },
  });

  for (const license of licenses) {
    await syncLicenseFlags(license.id, {
      actorId: options?.actorId,
      actorType: AuditActorType.SYSTEM,
      reason: options?.reason,
    });
  }
}

export async function getLicenseOperationalFlags(
  licenseId: string
): Promise<LicenseOperationalFlags> {
  const license = await prisma.license.findUnique({
    where: { id: licenseId },
    include: { subscription: true },
  });

  if (!license) {
    throw new Error("Licença não encontrada");
  }

  const input = {
    licenseStatus: license.status,
    subscriptionStatus: license.subscription?.status ?? null,
    haltNewEntries: license.haltNewEntries,
    haltAllTrading: license.haltAllTrading,
  };

  return {
    licenseId: license.id,
    licenseStatus: license.status,
    subscriptionStatus: license.subscription?.status ?? null,
    haltNewEntries: license.haltNewEntries,
    haltAllTrading: license.haltAllTrading,
    canAcceptNewEntries: canAcceptNewEntries(input),
    canManageOpenPositions: canManageOpenPositions(input),
    displayMessage: buildOperationalMessage(input),
  };
}

export async function buildLicenseStatusResponse(
  licenseId: string
): Promise<LicenseStatusApiResponse | null> {
  const license = await prisma.license.findUnique({
    where: { id: licenseId },
    include: licenseWithSubInclude,
  });

  if (!license) return null;

  const flags = await getLicenseOperationalFlags(licenseId);
  const sub = license.subscription;

  return {
    licenseId: license.id,
    status: license.status,
    haltNewEntries: license.haltNewEntries,
    haltAllTrading: license.haltAllTrading,
    canAcceptNewEntries: flags.canAcceptNewEntries,
    canManageOpenPositions: flags.canManageOpenPositions,
    subscription: sub
      ? {
          id: sub.id,
          status: sub.status,
          displayStatus: resolveSubscriptionDisplayStatus(sub),
          planSlug: sub.plan.slug,
          planName: sub.plan.name,
          currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
        }
      : null,
  };
}

export async function ensureLicenseForSubscription(
  subscriptionId: string,
  actorId?: string | null
) {
  const subscription = await prisma.subscription.findUniqueOrThrow({
    where: { id: subscriptionId },
    include: { plan: true, licenses: true, user: true },
  });

  if (subscription.licenses.length > 0) {
    return subscription.licenses[0];
  }

  const defaultProfile = await prisma.planExposureProfile.findFirst({
    where: { planId: subscription.planId },
    include: { exposureProfile: true },
    orderBy: { exposureProfile: { sortOrder: "asc" } },
  });

  const license = await prisma.license.create({
    data: {
      userId: subscription.userId,
      subscriptionId: subscription.id,
      status: LicenseStatus.PENDING_ACTIVATION,
      exposureProfileId: defaultProfile?.exposureProfileId,
      haltNewEntries: true,
      haltAllTrading: false,
    },
  });

  if (defaultProfile) {
    await prisma.licenseExposureProfile.create({
      data: {
        licenseId: license.id,
        exposureProfileId: defaultProfile.exposureProfileId,
        changedByUserId: actorId ?? null,
      },
    });
  }

  await createAuditLog({
    actorType: actorId ? AuditActorType.ADMIN : AuditActorType.SYSTEM,
    actorId: actorId ?? null,
    action: "license.created",
    entityType: "license",
    entityId: license.id,
    metadata: {
      subscriptionId,
      planSlug: subscription.plan.slug,
      status: license.status,
    },
  });

  await syncLicenseFlags(license.id, {
    actorId,
    reason: "license_created",
  });

  return license;
}

export async function activateSubscription(
  subscriptionId: string,
  period: { start: Date; end: Date },
  meta?: { gateway?: string; gatewaySubscriptionId?: string; actorId?: string }
) {
  const subscription = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
      gateway: meta?.gateway,
      gatewaySubscriptionId: meta?.gatewaySubscriptionId,
    },
    include: { plan: true },
  });

  await createAuditLog({
    actorType: AuditActorType.SYSTEM,
    actorId: meta?.actorId ?? null,
    action: "subscription.activated",
    entityType: "subscription",
    entityId: subscriptionId,
    metadata: {
      periodStart: period.start.toISOString(),
      periodEnd: period.end.toISOString(),
      planSlug: subscription.plan.slug,
    },
  });

  const license = await ensureLicenseForSubscription(
    subscriptionId,
    meta?.actorId
  );

  if (license.status === LicenseStatus.PENDING_ACTIVATION) {
    await prisma.license.update({
      where: { id: license.id },
      data: {
        status: LicenseStatus.ACTIVE,
        activatedAt: new Date(),
        suspendedAt: null,
      },
    });

    await createAuditLog({
      actorType: AuditActorType.SYSTEM,
      actorId: meta?.actorId ?? null,
      action: "license.activated",
      entityType: "license",
      entityId: license.id,
      metadata: { subscriptionId },
    });
  }

  await syncLicensesForSubscription(subscriptionId, {
    reason: "subscription_activated",
  });

  return subscription;
}

export async function markSubscriptionPastDue(
  subscriptionId: string,
  meta?: { actorId?: string }
) {
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { status: SubscriptionStatus.PAST_DUE },
  });

  await prisma.license.updateMany({
    where: { subscriptionId },
    data: {
      status: LicenseStatus.SUSPENDED,
      suspendedAt: new Date(),
    },
  });

  await createAuditLog({
    actorType: AuditActorType.SYSTEM,
    actorId: meta?.actorId ?? null,
    action: "subscription.past_due",
    entityType: "subscription",
    entityId: subscriptionId,
  });

  await syncLicensesForSubscription(subscriptionId, {
    reason: "subscription_past_due",
  });
}

export async function cancelSubscription(
  subscriptionId: string,
  meta?: { immediate?: boolean; actorId?: string }
) {
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: SubscriptionStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelAtPeriodEnd: !meta?.immediate,
    },
  });

  await prisma.license.updateMany({
    where: { subscriptionId },
    data: {
      status: LicenseStatus.SUSPENDED,
      suspendedAt: new Date(),
    },
  });

  await createAuditLog({
    actorType: AuditActorType.SYSTEM,
    actorId: meta?.actorId ?? null,
    action: "subscription.cancelled",
    entityType: "subscription",
    entityId: subscriptionId,
    metadata: { immediate: meta?.immediate ?? false },
  });

  await syncLicensesForSubscription(subscriptionId, {
    reason: "subscription_cancelled",
  });
}

export async function revokeLicensesForChargeback(
  subscriptionId: string,
  meta?: { actorId?: string }
) {
  await prisma.license.updateMany({
    where: { subscriptionId },
    data: {
      status: LicenseStatus.REVOKED,
      revokedAt: new Date(),
      haltAllTrading: false,
      haltNewEntries: true,
    },
  });

  await createAuditLog({
    actorType: AuditActorType.SYSTEM,
    actorId: meta?.actorId ?? null,
    action: "subscription.chargeback",
    entityType: "subscription",
    entityId: subscriptionId,
  });

  await syncLicensesForSubscription(subscriptionId, {
    reason: "chargeback",
  });
}

export async function getClientSubscriptionOverview(userId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      plan: { include: { prices: { where: { isActive: true }, take: 1 } } },
      invoices: {
        orderBy: { createdAt: "desc" },
        take: 3,
        include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
      },
      licenses: {
        include: {
          mt5Account: true,
          exposureProfile: true,
        },
      },
    },
  });

  if (!subscription) {
    return {
      subscription: null,
      displayStatus: resolveSubscriptionDisplayStatus(null),
      licenses: [],
    };
  }

  const displayStatus = resolveSubscriptionDisplayStatus(subscription);

  const licensesWithFlags = await Promise.all(
    subscription.licenses.map(async (lic) => {
      const flags = await getLicenseOperationalFlags(lic.id);
      const deviceCount = await prisma.device.count({
        where: { licenseId: lic.id, revokedAt: null },
      });
      const subActive = subscription.status === SubscriptionStatus.ACTIVE;
      const canLinkMt5 =
        subActive &&
        lic.status !== LicenseStatus.REVOKED;
      const canIssueActivationCode =
        subActive &&
        !!lic.mt5Account &&
        lic.status !== LicenseStatus.REVOKED &&
        (lic.status === LicenseStatus.ACTIVE ||
          lic.status === LicenseStatus.PENDING_ACTIVATION);

      return {
        ...lic,
        flags,
        deviceCount,
        maxDevices: subscription.plan.maxDevices,
        canLinkMt5,
        canIssueActivationCode,
      };
    })
  );

  return {
    subscription,
    displayStatus,
    licenses: licensesWithFlags,
  };
}

export async function listAdminClientsOverview() {
  const users = await prisma.user.findMany({
    where: { role: "CLIENT" },
    orderBy: { createdAt: "desc" },
    include: {
      subscriptions: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        include: {
          plan: true,
          invoices: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              payments: { orderBy: { createdAt: "desc" }, take: 1 },
            },
          },
        },
      },
      licenses: {
        include: { mt5Account: true },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  return users.map((user) => {
    const sub = user.subscriptions[0] ?? null;
    const lastInvoice = sub?.invoices[0] ?? null;
    const lastPayment = lastInvoice?.payments[0] ?? null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      subscription: sub
        ? {
            id: sub.id,
            status: sub.status,
            displayStatus: resolveSubscriptionDisplayStatus(sub),
            planName: sub.plan.name,
            planSlug: sub.plan.slug,
            currentPeriodEnd: sub.currentPeriodEnd,
          }
        : null,
      paymentStatus: lastPayment?.status ?? lastInvoice?.status ?? null,
      licenses: user.licenses.map((l) => ({
        id: l.id,
        status: l.status,
        haltNewEntries: l.haltNewEntries,
        mt5: l.mt5Account
          ? `${l.mt5Account.login}@${l.mt5Account.server}`
          : "—",
      })),
    };
  });
}

export async function assertLicenseAccess(
  licenseId: string,
  userId: string,
  isAdmin: boolean
) {
  const license = await prisma.license.findUnique({
    where: { id: licenseId },
    select: { userId: true },
  });

  if (!license) return false;
  if (isAdmin) return true;
  return license.userId === userId;
}
