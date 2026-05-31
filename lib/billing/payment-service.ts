import { AdminPaymentStatus, SubscriptionStatus } from "@prisma/client";
import { activateSubscription } from "@/lib/licensing/service";
import prisma from "@/lib/prisma";

/** Ativa assinatura comercial após pagamento — sem RealTradingApproval. */
export async function activateCommercialSubscriptionFromPayment(
  subscriptionId: string,
  input: {
    actorId?: string;
    periodStart: Date;
    periodEnd: Date;
    gateway?: string;
  }
) {
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      adminPaymentStatus: AdminPaymentStatus.CONFIRMED,
      nextBillingAt: input.periodEnd,
    },
  });

  await activateSubscription(
    subscriptionId,
    { start: input.periodStart, end: input.periodEnd },
    {
      gateway: input.gateway ?? "billing_manual",
      actorId: input.actorId,
    }
  );

  return prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
}

export async function suspendSubscriptionForOverduePayment(subscriptionId: string) {
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      adminPaymentStatus: AdminPaymentStatus.OVERDUE,
      status: SubscriptionStatus.PAST_DUE,
    },
  });
}
