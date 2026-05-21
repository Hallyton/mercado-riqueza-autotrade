import {
  AuditActorType,
  InvoiceStatus,
  PaymentStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { createAuditLog } from "@/lib/audit/log";
import {
  activateSubscription,
  cancelSubscription,
  markSubscriptionPastDue,
  revokeLicensesForChargeback,
} from "@/lib/licensing/service";
import prisma from "@/lib/prisma";
import type { BillingWebhookEvent } from "./webhook-types";

function addMonth(date: Date): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return d;
}

async function resolveSubscriptionId(
  event: BillingWebhookEvent
): Promise<string | null> {
  const { data } = event;

  if (data.subscriptionId) {
    const sub = await prisma.subscription.findUnique({
      where: { id: data.subscriptionId },
    });
    if (sub) return sub.id;
  }

  if (data.gatewaySubscriptionId) {
    const sub = await prisma.subscription.findFirst({
      where: { gatewaySubscriptionId: data.gatewaySubscriptionId },
    });
    if (sub) return sub.id;
  }

  if (data.externalReference) {
    const sub = await prisma.subscription.findUnique({
      where: { id: data.externalReference },
    });
    if (sub) return sub.id;
  }

  if (data.userId && data.planSlug) {
    const plan = await prisma.plan.findUnique({
      where: { slug: data.planSlug },
    });
    if (!plan) return null;

    const existing = await prisma.subscription.findFirst({
      where: { userId: data.userId, planId: plan.id },
      orderBy: { createdAt: "desc" },
    });

    if (existing) return existing.id;

    const created = await prisma.subscription.create({
      data: {
        userId: data.userId,
        planId: plan.id,
        status: SubscriptionStatus.INCOMPLETE,
        gateway: event.gateway,
        gatewayCustomerId: data.customerId,
        gatewaySubscriptionId: data.gatewaySubscriptionId,
      },
    });

    await createAuditLog({
      actorType: AuditActorType.SYSTEM,
      action: "subscription.created",
      entityType: "subscription",
      entityId: created.id,
      metadata: { source: "webhook", eventType: event.type, planSlug: data.planSlug },
    });

    return created.id;
  }

  return null;
}

async function recordPayment(
  subscriptionId: string,
  event: BillingWebhookEvent,
  success: boolean
) {
  const amount = event.data.amountCents ?? 0;
  const subscription = await prisma.subscription.findUniqueOrThrow({
    where: { id: subscriptionId },
    include: { plan: { include: { prices: { where: { isActive: true }, take: 1 } } } },
  });

  const price = subscription.plan.prices[0];
  const amountCents = amount || price?.amountCents || 0;

  const invoice = await prisma.invoice.create({
    data: {
      subscriptionId,
      status: success ? InvoiceStatus.PAID : InvoiceStatus.OPEN,
      amountCents,
      currency: event.data.currency,
      paidAt: success
        ? event.data.paidAt
          ? new Date(event.data.paidAt)
          : new Date()
        : null,
    },
  });

  await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      status: success ? PaymentStatus.SUCCEEDED : PaymentStatus.FAILED,
      amountCents,
      currency: event.data.currency,
      gatewayPaymentId: event.id,
      paidAt: success ? new Date() : null,
    },
  });

  return invoice;
}

export async function handleBillingWebhook(event: BillingWebhookEvent) {
  const existing = await prisma.webhookEvent.findUnique({
    where: {
      gateway_eventId: {
        gateway: event.gateway,
        eventId: event.id,
      },
    },
  });

  if (existing?.processedAt) {
    return { duplicate: true, subscriptionId: null as string | null };
  }

  await prisma.webhookEvent.upsert({
    where: {
      gateway_eventId: {
        gateway: event.gateway,
        eventId: event.id,
      },
    },
    create: {
      gateway: event.gateway,
      eventId: event.id,
      eventType: event.type,
      payload: event as object,
    },
    update: {
      eventType: event.type,
      payload: event as object,
    },
  });

  const subscriptionId = await resolveSubscriptionId(event);

  if (!subscriptionId) {
    await createAuditLog({
      actorType: AuditActorType.SYSTEM,
      action: "webhook.subscription_not_found",
      entityType: "webhook_event",
      entityId: event.id,
      metadata: { type: event.type, gateway: event.gateway },
    });

    await prisma.webhookEvent.update({
      where: {
        gateway_eventId: { gateway: event.gateway, eventId: event.id },
      },
      data: { processedAt: new Date() },
    });

    return { duplicate: false, subscriptionId: null, error: "subscription_not_found" };
  }

  const now = new Date();
  const periodEnd = event.data.periodEnd
    ? new Date(event.data.periodEnd)
    : addMonth(now);

  switch (event.type) {
    case "payment.approved":
    case "subscription.renewed": {
      await recordPayment(subscriptionId, event, true);
      await activateSubscription(subscriptionId, {
        start: now,
        end: periodEnd,
      }, {
        gateway: event.gateway,
        gatewaySubscriptionId: event.data.gatewaySubscriptionId,
      });
      break;
    }
    case "payment.failed": {
      await recordPayment(subscriptionId, event, false);
      await markSubscriptionPastDue(subscriptionId);
      break;
    }
    case "subscription.cancelled": {
      await cancelSubscription(subscriptionId, { immediate: false });
      break;
    }
    case "chargeback": {
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: { status: SubscriptionStatus.CANCELLED, cancelledAt: now },
      });
      await revokeLicensesForChargeback(subscriptionId);
      break;
    }
  }

  await createAuditLog({
    actorType: AuditActorType.SYSTEM,
    action: `webhook.${event.type}`,
    entityType: "subscription",
    entityId: subscriptionId,
    metadata: {
      gateway: event.gateway,
      eventId: event.id,
    },
  });

  await prisma.webhookEvent.update({
    where: {
      gateway_eventId: { gateway: event.gateway, eventId: event.id },
    },
    data: { processedAt: new Date() },
  });

  return { duplicate: false, subscriptionId };
}
