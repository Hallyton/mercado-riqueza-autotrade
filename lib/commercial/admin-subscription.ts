import {
  AdminPaymentStatus,
  InvoiceStatus,
  PaymentStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { recordAdminAction } from "@/lib/admin/record-action";
import {
  activateSubscription,
  cancelSubscription,
  ensureLicenseForSubscription,
  markSubscriptionPastDue,
  syncLicensesForSubscription,
} from "@/lib/licensing/service";
import prisma from "@/lib/prisma";
import {
  createRobotInstanceForSubscription,
  linkRobotInstanceToLicense,
} from "./robot-instance";

export class CommercialAdminError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "CommercialAdminError";
  }
}

function subscriptionPeriod() {
  const start = new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { start, end };
}

export async function confirmSubscriptionPayment(
  subscriptionId: string,
  actorId: string,
  ipAddress?: string | null
) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  });

  if (!subscription) {
    throw new CommercialAdminError(
      "Assinatura não encontrada.",
      "NOT_FOUND",
      404
    );
  }

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { adminPaymentStatus: AdminPaymentStatus.CONFIRMED },
  });

  const period = subscriptionPeriod();
  await activateSubscription(subscriptionId, period, {
    gateway: "manual_admin",
    actorId,
  });

  const license = await ensureLicenseForSubscription(subscriptionId, actorId);
  const robot = await createRobotInstanceForSubscription(
    subscriptionId,
    actorId
  );

  if (robot && license) {
    await linkRobotInstanceToLicense(robot.id, license.id, actorId);
  }

  await prisma.invoice.create({
    data: {
      subscriptionId,
      status: InvoiceStatus.PAID,
      amountCents:
        (
          await prisma.planPrice.findFirst({
            where: { planId: subscription.planId, isActive: true },
          })
        )?.amountCents ?? 30000,
      currency: "BRL",
      paidAt: new Date(),
      dueAt: period.start,
      payments: {
        create: {
          status: PaymentStatus.SUCCEEDED,
          amountCents:
            (
              await prisma.planPrice.findFirst({
                where: { planId: subscription.planId, isActive: true },
              })
            )?.amountCents ?? 30000,
          currency: "BRL",
          paidAt: new Date(),
          gatewayPaymentId: `manual_${Date.now()}`,
        },
      },
    },
  });

  await recordAdminAction({
    actorId,
    action: "commercial.payment_confirmed",
    targetType: "subscription",
    targetId: subscriptionId,
    metadata: {
      planSlug: subscription.plan.slug,
      licenseId: license.id,
      robotInstanceId: robot?.id ?? null,
    },
    ipAddress,
  });

  return { subscriptionId, licenseId: license.id, robotInstanceId: robot?.id };
}

export async function markSubscriptionPaymentPending(
  subscriptionId: string,
  actorId: string,
  ipAddress?: string | null
) {
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      adminPaymentStatus: AdminPaymentStatus.PENDING,
      status: SubscriptionStatus.INCOMPLETE,
    },
  });

  await syncLicensesForSubscription(subscriptionId, {
    actorId,
    reason: "payment_marked_pending",
  });

  await recordAdminAction({
    actorId,
    action: "commercial.payment_marked_pending",
    targetType: "subscription",
    targetId: subscriptionId,
    ipAddress,
  });
}

export async function markSubscriptionPaymentOverdue(
  subscriptionId: string,
  actorId: string,
  ipAddress?: string | null
) {
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { adminPaymentStatus: AdminPaymentStatus.OVERDUE },
  });

  await markSubscriptionPastDue(subscriptionId, { actorId });

  await recordAdminAction({
    actorId,
    action: "commercial.payment_marked_overdue",
    targetType: "subscription",
    targetId: subscriptionId,
    ipAddress,
  });
}

export async function suspendCommercialSubscription(
  subscriptionId: string,
  actorId: string,
  ipAddress?: string | null
) {
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { status: SubscriptionStatus.PAUSED },
  });

  await syncLicensesForSubscription(subscriptionId, {
    actorId,
    reason: "subscription_suspended",
  });

  await recordAdminAction({
    actorId,
    action: "commercial.subscription_suspended",
    targetType: "subscription",
    targetId: subscriptionId,
    ipAddress,
  });
}

export async function reactivateCommercialSubscription(
  subscriptionId: string,
  actorId: string,
  ipAddress?: string | null
) {
  const subscription = await prisma.subscription.findUniqueOrThrow({
    where: { id: subscriptionId },
  });

  if (subscription.adminPaymentStatus !== AdminPaymentStatus.CONFIRMED) {
    throw new CommercialAdminError(
      "Confirme o pagamento antes de reativar.",
      "PAYMENT_NOT_CONFIRMED",
      400
    );
  }

  const period = subscriptionPeriod();
  await activateSubscription(subscriptionId, period, {
    gateway: "manual_admin",
    actorId,
  });

  await recordAdminAction({
    actorId,
    action: "commercial.subscription_reactivated",
    targetType: "subscription",
    targetId: subscriptionId,
    ipAddress,
  });
}

export async function cancelCommercialSubscription(
  subscriptionId: string,
  actorId: string,
  immediate = true,
  ipAddress?: string | null
) {
  await cancelSubscription(subscriptionId, { immediate, actorId });

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { adminPaymentStatus: AdminPaymentStatus.OVERDUE },
  });

  await recordAdminAction({
    actorId,
    action: "commercial.subscription_cancelled",
    targetType: "subscription",
    targetId: subscriptionId,
    metadata: { immediate },
    ipAddress,
  });
}

export async function adminCreateLicenseForSubscription(
  subscriptionId: string,
  actorId: string,
  ipAddress?: string | null
) {
  const license = await ensureLicenseForSubscription(subscriptionId, actorId);
  const robot = await createRobotInstanceForSubscription(
    subscriptionId,
    actorId
  );

  if (robot) {
    await linkRobotInstanceToLicense(robot.id, license.id, actorId);
  }

  await recordAdminAction({
    actorId,
    action: "commercial.license_created",
    targetType: "license",
    targetId: license.id,
    metadata: { subscriptionId, robotInstanceId: robot?.id ?? null },
    ipAddress,
  });

  return { licenseId: license.id, robotInstanceId: robot?.id ?? null };
}

export async function getAdminCommercialOverview(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscriptions: {
        orderBy: { updatedAt: "desc" },
        include: {
          plan: true,
          robotInstances: {
            include: { robotProduct: true },
            orderBy: { createdAt: "asc" },
          },
          licenses: {
            include: { mt5Account: true, devices: true },
          },
        },
      },
    },
  });

  if (!user) return null;

  return {
    userId: user.id,
    subscriptions: user.subscriptions.map((s) => ({
      id: s.id,
      status: s.status,
      adminPaymentStatus: s.adminPaymentStatus,
      robotCount: s.robotCount,
      planName: s.plan.name,
      planSlug: s.plan.slug,
      maxRobots: s.plan.maxRobots,
      licenses: s.licenses.map((l) => ({
        id: l.id,
        status: l.status,
        expectedMagicNumber: l.expectedMagicNumber,
        mt5: l.mt5Account
          ? `${l.mt5Account.login}@${l.mt5Account.server}`
          : null,
        deviceCount: l.devices.filter((d) => d.status === "ACTIVE").length,
      })),
      robots: s.robotInstances.map((r) => ({
        id: r.id,
        magicNumber: r.magicNumber,
        status: r.status,
        productName: r.robotProduct.name,
        licenseId: r.licenseId,
      })),
    })),
  };
}
