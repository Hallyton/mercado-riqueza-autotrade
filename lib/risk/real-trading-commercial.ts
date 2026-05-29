import {
  InvoiceStatus,
  LicenseStatus,
  SubscriptionStatus,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { eaOnlineThresholdMs } from "@/lib/risk/real-trading-config";

/** Tipos de termo que liberam operação real comercial. */
export const REQUIRED_TERMS_DOCUMENT_TYPES = [
  "COMMERCIAL_SUBSCRIPTION_TERMS",
  "BETA_DEMO_TERMS",
] as const;

export async function isSubscriptionCommerciallyActive(
  subscriptionId: string | null | undefined
): Promise<boolean> {
  if (!subscriptionId) return false;
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { status: true },
  });
  if (!sub) return false;
  return (
    sub.status === SubscriptionStatus.ACTIVE ||
    sub.status === SubscriptionStatus.TRIALING
  );
}

export async function isCommercialPaymentOk(
  subscriptionId: string | null | undefined
): Promise<boolean> {
  if (!subscriptionId) return false;

  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { status: true },
  });
  if (!sub) return false;

  if (
    sub.status === SubscriptionStatus.PAST_DUE ||
    sub.status === SubscriptionStatus.CANCELLED ||
    sub.status === SubscriptionStatus.INCOMPLETE ||
    sub.status === SubscriptionStatus.PAUSED
  ) {
    return false;
  }

  if (
    sub.status !== SubscriptionStatus.ACTIVE &&
    sub.status !== SubscriptionStatus.TRIALING
  ) {
    return false;
  }

  const overdueInvoice = await prisma.invoice.findFirst({
    where: {
      subscriptionId,
      status: InvoiceStatus.OPEN,
      dueAt: { lt: new Date() },
    },
  });

  return !overdueInvoice;
}

export async function hasRequiredTermsAcceptance(userId: string): Promise<boolean> {
  const acceptance = await prisma.termsAcceptance.findFirst({
    where: {
      userId,
      documentType: { in: [...REQUIRED_TERMS_DOCUMENT_TYPES] },
    },
    orderBy: { acceptedAt: "desc" },
  });
  return Boolean(acceptance);
}

export async function isLicenseCommerciallyEligible(
  licenseId: string
): Promise<{
  licenseOk: boolean;
  userId: string | null;
  subscriptionId: string | null;
}> {
  const license = await prisma.license.findUnique({
    where: { id: licenseId },
    select: {
      userId: true,
      status: true,
      haltAllTrading: true,
      haltNewEntries: true,
      subscriptionId: true,
      revokedAt: true,
    },
  });
  if (!license) {
    return { licenseOk: false, userId: null, subscriptionId: null };
  }
  const licenseOk =
    license.status === LicenseStatus.ACTIVE &&
    !license.haltAllTrading &&
    !license.revokedAt;
  return {
    licenseOk,
    userId: license.userId,
    subscriptionId: license.subscriptionId,
  };
}

export async function isDeviceAuthorizedForLicense(
  licenseId: string
): Promise<boolean> {
  const threshold = new Date(Date.now() - eaOnlineThresholdMs());
  const device = await prisma.device.findFirst({
    where: {
      licenseId,
      revokedAt: null,
      lastSeenAt: { gte: threshold },
    },
  });
  return Boolean(device);
}

/** Limite de robôs: usa maxMt5Accounts do plano até RobotInstance existir. */
export async function isRobotQuantityWithinPlan(
  subscriptionId: string | null | undefined,
  activeRobotCount = 1
): Promise<boolean> {
  if (!subscriptionId) return activeRobotCount <= 1;
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: { select: { maxMt5Accounts: true } } },
  });
  if (!sub?.plan) return false;
  return activeRobotCount <= sub.plan.maxMt5Accounts;
}
