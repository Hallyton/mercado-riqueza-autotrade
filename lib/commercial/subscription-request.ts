import {
  SubscriptionStatus,
  AuditActorType,
  type Prisma,
} from "@prisma/client";
import { createAuditLog } from "@/lib/audit/log";
import { createSubscriptionInvoice, requestRenewalInvoice } from "@/lib/billing/invoice-service";
import prisma from "@/lib/prisma";
import {
  AUTOTRADE_SINGLE_ROBOT_PLAN_SLUG,
  COMMERCIAL_SIGNUP_TERM_TYPES,
  COMMERCIAL_TERMS_VERSION,
  MAX_ROBOTS_CURRENT_PHASE,
  ROBOT_MONTHLY_PRICE_CENTS,
} from "./constants";

export class CommercialSubscriptionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "CommercialSubscriptionError";
  }
}

export type SubscriptionRequestInput = {
  userId: string;
  acceptTerms: boolean;
  acceptRisk: boolean;
  acceptNoReturnGuarantee: boolean;
  acceptRealRequiresApproval: boolean;
  acceptBlackBox: boolean;
  ipAddress?: string | null;
};

function assertSubscriptionAcceptances(input: SubscriptionRequestInput) {
  if (
    !input.acceptTerms ||
    !input.acceptRisk ||
    !input.acceptNoReturnGuarantee ||
    !input.acceptRealRequiresApproval ||
    !input.acceptBlackBox
  ) {
    throw new CommercialSubscriptionError(
      "É necessário aceitar todos os termos para solicitar assinatura.",
      "TERMS_REQUIRED",
      400
    );
  }
}

async function recordSubscriptionTerms(
  tx: Prisma.TransactionClient,
  userId: string,
  subscriptionId: string
) {
  const now = new Date();
  for (const documentType of COMMERCIAL_SIGNUP_TERM_TYPES) {
    await tx.termsAcceptance.create({
      data: {
        userId,
        subscriptionId,
        documentType,
        documentVersion: COMMERCIAL_TERMS_VERSION,
        acceptedAt: now,
        source: "web_subscription_request",
      },
    });
  }
}

export async function requestCommercialSubscription(
  input: SubscriptionRequestInput
) {
  assertSubscriptionAcceptances(input);

  const plan = await prisma.plan.findUnique({
    where: { slug: AUTOTRADE_SINGLE_ROBOT_PLAN_SLUG },
  });

  if (!plan?.isActive) {
    throw new CommercialSubscriptionError(
      "Plano comercial indisponível.",
      "PLAN_UNAVAILABLE",
      503
    );
  }

  const existing = await prisma.subscription.findFirst({
    where: {
      userId: input.userId,
      status: {
        in: [
          SubscriptionStatus.INCOMPLETE,
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.TRIALING,
          SubscriptionStatus.PAST_DUE,
        ],
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (existing) {
    if (
      existing.status === SubscriptionStatus.ACTIVE ||
      existing.status === SubscriptionStatus.TRIALING
    ) {
      throw new CommercialSubscriptionError(
        "Você já possui assinatura ativa.",
        "SUBSCRIPTION_ALREADY_ACTIVE",
        409
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: existing.id },
        data: {
          planId: plan.id,
          status: SubscriptionStatus.INCOMPLETE,
          adminPaymentStatus: "PENDING",
          robotCount: MAX_ROBOTS_CURRENT_PHASE,
        },
      });
      await recordSubscriptionTerms(tx, input.userId, existing.id);
    });

    await createAuditLog({
      actorType: AuditActorType.USER,
      actorId: input.userId,
      action: "commercial.subscription_rerequested",
      entityType: "subscription",
      entityId: existing.id,
      metadata: { planSlug: plan.slug },
      ipAddress: input.ipAddress ?? null,
    });

    try {
      await requestRenewalInvoice(input.userId);
    } catch {
      /* ignore */
    }

    return { subscriptionId: existing.id, planSlug: plan.slug, created: false };
  }

  const subscription = await prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.create({
      data: {
        userId: input.userId,
        planId: plan.id,
        status: SubscriptionStatus.INCOMPLETE,
        adminPaymentStatus: "PENDING",
        robotCount: MAX_ROBOTS_CURRENT_PHASE,
      },
    });
    await recordSubscriptionTerms(tx, input.userId, sub.id);
    return sub;
  });

  await createAuditLog({
    actorType: AuditActorType.USER,
    actorId: input.userId,
    action: "commercial.subscription_requested",
    entityType: "subscription",
    entityId: subscription.id,
    metadata: { planSlug: plan.slug },
    ipAddress: input.ipAddress ?? null,
  });

  try {
    await createSubscriptionInvoice(subscription.id);
  } catch {
    /* ignore */
  }

  return {
    subscriptionId: subscription.id,
    planSlug: plan.slug,
    created: true,
  };
}

export async function getPublicCommercialPlan() {
  try {
    const plan = await prisma.plan.findUnique({
      where: { slug: AUTOTRADE_SINGLE_ROBOT_PLAN_SLUG },
      include: {
        prices: { where: { isActive: true, interval: "month" }, take: 1 },
      },
    });

    if (!plan?.isActive) return null;

    return {
      slug: plan.slug,
      name: plan.name,
      description: plan.description,
      monthlyPriceCents: plan.prices[0]?.amountCents ?? null,
      maxRobots: plan.maxRobots,
      maxRobotsFuture: 4,
    };
  } catch {
    return {
      slug: AUTOTRADE_SINGLE_ROBOT_PLAN_SLUG,
      name: "AutoTrade Single Robot",
      description: null,
      monthlyPriceCents: ROBOT_MONTHLY_PRICE_CENTS,
      maxRobots: 1,
      maxRobotsFuture: 4,
    };
  }
}
