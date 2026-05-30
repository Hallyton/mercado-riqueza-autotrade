import { hash } from "bcryptjs";
import {
  SubscriptionStatus,
  UserRole,
  UserStatus,
  AuditActorType,
  type Prisma,
} from "@prisma/client";
import { createAuditLog } from "@/lib/audit/log";
import prisma from "@/lib/prisma";
import {
  AUTOTRADE_SINGLE_ROBOT_PLAN_SLUG,
  COMMERCIAL_SIGNUP_TERM_TYPES,
  COMMERCIAL_TERMS_VERSION,
  MAX_ROBOTS_CURRENT_PHASE,
} from "./constants";

const BCRYPT_COST = 12;

export class CommercialSignupError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "CommercialSignupError";
  }
}

export type CommercialSignupInput = {
  name: string;
  email: string;
  phone?: string | null;
  password: string;
  acceptTerms: boolean;
  acceptRisk: boolean;
  acceptNoReturnGuarantee: boolean;
  acceptRealRequiresApproval: boolean;
  acceptBlackBox: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
};

function assertAllAcceptances(input: CommercialSignupInput) {
  if (
    !input.acceptTerms ||
    !input.acceptRisk ||
    !input.acceptNoReturnGuarantee ||
    !input.acceptRealRequiresApproval ||
    !input.acceptBlackBox
  ) {
    throw new CommercialSignupError(
      "É necessário aceitar todos os termos e avisos de risco.",
      "TERMS_REQUIRED",
      400
    );
  }
}

async function recordSignupTerms(
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
        source: "web_signup",
      },
    });
  }
}

export async function commercialSignup(input: CommercialSignupInput) {
  assertAllAcceptances(input);

  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new CommercialSignupError(
      "Este e-mail já está cadastrado.",
      "EMAIL_EXISTS",
      409
    );
  }

  const plan = await prisma.plan.findUnique({
    where: { slug: AUTOTRADE_SINGLE_ROBOT_PLAN_SLUG },
    include: { prices: { where: { isActive: true }, take: 1 } },
  });

  if (!plan?.isActive) {
    throw new CommercialSignupError(
      "Plano comercial indisponível no momento.",
      "PLAN_UNAVAILABLE",
      503
    );
  }

  const passwordHash = await hash(input.password, BCRYPT_COST);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        passwordHash,
        role: UserRole.CLIENT,
        status: UserStatus.ACTIVE,
        emailVerified: new Date(),
      },
    });

    const subscription = await tx.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        status: SubscriptionStatus.INCOMPLETE,
        robotCount: MAX_ROBOTS_CURRENT_PHASE,
        adminPaymentStatus: "PENDING",
      },
    });

    await recordSignupTerms(tx, user.id, subscription.id);

    return { user, subscription, plan };
  });

  await createAuditLog({
    actorType: AuditActorType.USER,
    actorId: result.user.id,
    action: "commercial.signup",
    entityType: "user",
    entityId: result.user.id,
    metadata: {
      planSlug: plan.slug,
      subscriptionId: result.subscription.id,
      robotCount: MAX_ROBOTS_CURRENT_PHASE,
    },
    ipAddress: input.ipAddress ?? null,
  });

  return {
    userId: result.user.id,
    email: result.user.email,
    subscriptionId: result.subscription.id,
    planSlug: plan.slug,
    planName: plan.name,
    monthlyPriceCents: plan.prices[0]?.amountCents ?? null,
  };
}

export async function hasCommercialSignupTerms(userId: string): Promise<boolean> {
  const count = await prisma.termsAcceptance.count({
    where: {
      userId,
      documentType: { in: [...COMMERCIAL_SIGNUP_TERM_TYPES] },
      documentVersion: COMMERCIAL_TERMS_VERSION,
    },
  });
  return count >= COMMERCIAL_SIGNUP_TERM_TYPES.length;
}
