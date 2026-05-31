import {
  AdminPaymentStatus,
  AuditActorType,
  BillingProvider,
  InvoiceStatus,
  PaymentAttemptStatus,
  PaymentMethod,
  PaymentStatus,
  SubscriptionStatus,
  type Invoice,
  type PaymentAttempt,
} from "@prisma/client";
import { recordAdminAction } from "@/lib/admin/record-action";
import { createAuditLog } from "@/lib/audit/log";
import {
  ensureLicenseForSubscription,
  markSubscriptionPastDue,
} from "@/lib/licensing/service";
import prisma from "@/lib/prisma";
import { ROBOT_MONTHLY_PRICE_CENTS } from "@/lib/commercial/constants";
import {
  createRobotInstanceForSubscription,
  linkRobotInstanceToLicense,
} from "@/lib/commercial/robot-instance";
import { activateCommercialSubscriptionFromPayment } from "@/lib/billing/payment-service";
import {
  defaultInvoiceDueDate,
  getBillingProviderAdapter,
} from "@/lib/billing/manual-provider";
import { getConfiguredBillingProvider } from "@/lib/billing/provider";
import { redactPixCopyPaste } from "@/lib/billing/redact";
import {
  BILLING_CONFIRMATION_PHRASES,
  BILLING_PROVIDER_LABELS,
  INVOICE_STATUS_LABELS,
  PAYMENT_ATTEMPT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type ClientInvoiceView,
} from "@/lib/billing/types";

export class BillingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "BillingError";
  }
}

function addMonth(date: Date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return d;
}

function assertConfirmationPhrase(actual: string | undefined, expected: string) {
  if (actual?.trim() !== expected) {
    throw new BillingError(
      `Confirmação obrigatória: digite exatamente "${expected}".`,
      "CONFIRMATION_REQUIRED",
      400
    );
  }
}

export function serializeClientInvoice(
  invoice: Invoice & {
    paymentAttempts: PaymentAttempt[];
  }
): ClientInvoiceView {
  const latestAttempt = invoice.paymentAttempts[0];
  return {
    id: invoice.id,
    status: invoice.status,
    statusLabel: INVOICE_STATUS_LABELS[invoice.status],
    amountCents: invoice.amountCents,
    currency: invoice.currency,
    description: invoice.description,
    providerLabel: BILLING_PROVIDER_LABELS[invoice.provider],
    methodLabel: latestAttempt
      ? PAYMENT_METHOD_LABELS[latestAttempt.method]
      : PAYMENT_METHOD_LABELS.MANUAL,
    dueAt: invoice.dueAt?.toISOString() ?? null,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    periodStart: invoice.periodStart?.toISOString() ?? null,
    periodEnd: invoice.periodEnd?.toISOString() ?? null,
    paymentUrl: invoice.paymentUrl,
    checkoutUrl: latestAttempt?.checkoutUrl ?? invoice.paymentUrl,
    createdAt: invoice.createdAt.toISOString(),
  };
}

export async function resolvePlanAmountCents(planId: string): Promise<number> {
  const price = await prisma.planPrice.findFirst({
    where: { planId, isActive: true, interval: "month" },
  });
  return price?.amountCents ?? ROBOT_MONTHLY_PRICE_CENTS;
}

export async function createSubscriptionInvoice(
  subscriptionId: string,
  options?: {
    description?: string;
    status?: InvoiceStatus;
    provider?: BillingProvider;
  }
) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  });

  if (!subscription) {
    throw new BillingError("Assinatura não encontrada.", "NOT_FOUND", 404);
  }

  const amountCents = await resolvePlanAmountCents(subscription.planId);
  const now = new Date();
  const periodStart = now;
  const periodEnd = addMonth(now);
  const provider = options?.provider ?? getConfiguredBillingProvider();
  const adapter = getBillingProviderAdapter(provider);

  const external = await adapter.createInvoice({
    userId: subscription.userId,
    subscriptionId,
    planId: subscription.planId,
    amountCents,
    periodStart,
    periodEnd,
    dueAt: defaultInvoiceDueDate(now),
    description:
      options?.description ??
      `AutoTrade Single Robot — ${subscription.plan.name} — mensalidade`,
  });

  const invoice = await prisma.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        userId: subscription.userId,
        subscriptionId,
        planId: subscription.planId,
        status: options?.status ?? InvoiceStatus.OPEN,
        amountCents,
        currency: "BRL",
        description:
          options?.description ??
          `AutoTrade Single Robot — ${subscription.plan.name} — mensalidade`,
        provider,
        providerInvoiceId: external.providerInvoiceId ?? null,
        gatewayInvoiceId: external.providerInvoiceId ?? null,
        paymentUrl: external.paymentUrl ?? null,
        pixQrCodeUrl: external.pixQrCodeUrl ?? null,
        pixCopyPaste: external.pixCopyPaste ?? null,
        periodStart,
        periodEnd,
        dueAt: defaultInvoiceDueDate(now),
        metadataJson: { source: "billing_service", mode: provider },
      },
    });

    const attemptExternal = await adapter.createPaymentAttempt({
      invoiceId: created.id,
      userId: subscription.userId,
      amountCents,
      method: provider === BillingProvider.MANUAL ? "MANUAL" : "UNKNOWN",
      checkoutUrl: external.paymentUrl,
    });

    await tx.paymentAttempt.create({
      data: {
        invoiceId: created.id,
        userId: subscription.userId,
        provider,
        method: PaymentMethod.MANUAL,
        status: PaymentAttemptStatus.CREATED,
        amountCents,
        providerPaymentId: attemptExternal.providerPaymentId ?? null,
        checkoutUrl: attemptExternal.checkoutUrl ?? external.paymentUrl ?? null,
      },
    });

    await tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        lastInvoiceId: created.id,
        nextBillingAt: periodEnd,
        adminPaymentStatus: AdminPaymentStatus.PENDING,
      },
    });

    return created;
  });

  await createAuditLog({
    actorType: AuditActorType.SYSTEM,
    action: "billing.invoice_created",
    entityType: "invoice",
    entityId: invoice.id,
    metadata: { subscriptionId, provider, amountCents },
  });

  return invoice;
}

export async function requestRenewalInvoice(userId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: {
        in: [
          SubscriptionStatus.INCOMPLETE,
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.PAST_DUE,
          SubscriptionStatus.PAUSED,
        ],
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!subscription) {
    throw new BillingError("Assinatura não encontrada.", "NO_SUBSCRIPTION", 404);
  }

  const open = await prisma.invoice.findFirst({
    where: {
      subscriptionId: subscription.id,
      status: { in: [InvoiceStatus.OPEN, InvoiceStatus.PENDING, InvoiceStatus.OVERDUE] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (open) return open;

  return createSubscriptionInvoice(subscription.id, {
    description: "Renovação AutoTrade Single Robot",
    status: InvoiceStatus.PENDING,
  });
}

export async function listInvoicesForUser(userId: string) {
  const invoices = await prisma.invoice.findMany({
    where: { userId },
    include: {
      paymentAttempts: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return invoices.map(serializeClientInvoice);
}

export async function getInvoiceForUser(userId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId },
    include: {
      paymentAttempts: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  if (!invoice) {
    throw new BillingError("Fatura não encontrada.", "NOT_FOUND", 404);
  }

  return serializeClientInvoice(invoice);
}

export async function listInvoicesAdmin(filters?: {
  userId?: string;
  subscriptionId?: string;
  status?: InvoiceStatus;
}) {
  return prisma.invoice.findMany({
    where: {
      userId: filters?.userId,
      subscriptionId: filters?.subscriptionId,
      status: filters?.status,
    },
    include: {
      user: { select: { id: true, email: true, name: true } },
      subscription: { select: { id: true, status: true, adminPaymentStatus: true } },
      paymentAttempts: { orderBy: { createdAt: "desc" }, take: 3 },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function adminCreateManualInvoice(input: {
  subscriptionId: string;
  actorId: string;
  amountCents?: number;
  description?: string;
  ipAddress?: string | null;
}) {
  const invoice = await createSubscriptionInvoice(input.subscriptionId, {
    description: input.description,
    status: InvoiceStatus.PENDING,
    provider: BillingProvider.MANUAL,
  });

  if (input.amountCents && input.amountCents !== invoice.amountCents) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { amountCents: input.amountCents },
    });
  }

  await recordAdminAction({
    actorId: input.actorId,
    action: "billing.invoice_created_manual",
    targetType: "invoice",
    targetId: invoice.id,
    metadata: { subscriptionId: input.subscriptionId },
    ipAddress: input.ipAddress,
  });

  return invoice;
}

async function fulfillCommercialEntitlements(
  subscriptionId: string,
  actorId: string
) {
  const license = await ensureLicenseForSubscription(subscriptionId, actorId);
  const robot = await createRobotInstanceForSubscription(subscriptionId, actorId);
  if (robot && license) {
    await linkRobotInstanceToLicense(robot.id, license.id, actorId);
  }
  return { licenseId: license.id, robotInstanceId: robot?.id ?? null };
}

export async function applyInvoicePaidEffects(input: {
  invoiceId: string;
  actorId: string;
}) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: input.invoiceId },
    include: { subscription: { include: { plan: true } } },
  });

  if (!invoice) {
    throw new BillingError("Fatura não encontrada.", "NOT_FOUND", 404);
  }

  if (invoice.status === InvoiceStatus.PAID) {
    return {
      invoiceId: invoice.id,
      subscriptionId: invoice.subscriptionId,
      alreadyPaid: true as const,
      licenseId: null,
      robotInstanceId: null,
    };
  }

  if (invoice.status === InvoiceStatus.CANCELLED || invoice.status === InvoiceStatus.VOID) {
    throw new BillingError("Fatura cancelada não pode ser paga.", "INVALID_STATE", 400);
  }

  const now = new Date();
  const periodStart = invoice.periodStart ?? now;
  const periodEnd = invoice.periodEnd ?? addMonth(now);

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        status: InvoiceStatus.PAID,
        paidAt: now,
        periodStart,
        periodEnd,
      },
    });

    await tx.paymentAttempt.updateMany({
      where: {
        invoiceId: invoice.id,
        status: { in: [PaymentAttemptStatus.CREATED, PaymentAttemptStatus.PENDING] },
      },
      data: { status: PaymentAttemptStatus.PAID },
    });

    await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        status: PaymentStatus.SUCCEEDED,
        amountCents: invoice.amountCents,
        currency: invoice.currency,
        gatewayPaymentId: `billing_${invoice.id.slice(-8)}_${Date.now()}`,
        paidAt: now,
      },
    });
  });

  await activateCommercialSubscriptionFromPayment(invoice.subscriptionId, {
    actorId: input.actorId,
    periodStart,
    periodEnd,
    gateway: "billing_manual",
  });

  const entitlements = await fulfillCommercialEntitlements(
    invoice.subscriptionId,
    input.actorId
  );

  return {
    invoiceId: invoice.id,
    subscriptionId: invoice.subscriptionId,
    alreadyPaid: false as const,
    ...entitlements,
  };
}

export async function markInvoicePaid(input: {
  invoiceId: string;
  actorId: string;
  confirmationPhrase?: string;
  ipAddress?: string | null;
}) {
  assertConfirmationPhrase(
    input.confirmationPhrase,
    BILLING_CONFIRMATION_PHRASES.MARK_PAID
  );

  const result = await applyInvoicePaidEffects({
    invoiceId: input.invoiceId,
    actorId: input.actorId,
  });

  if (!result.alreadyPaid) {
    await recordAdminAction({
      actorId: input.actorId,
      action: "billing.invoice_marked_paid",
      targetType: "invoice",
      targetId: input.invoiceId,
      metadata: {
        subscriptionId: result.subscriptionId,
        licenseId: result.licenseId,
        robotInstanceId: result.robotInstanceId,
      },
      ipAddress: input.ipAddress,
    });
  }

  return result;
}

export async function markInvoicePending(input: {
  invoiceId: string;
  actorId: string;
  ipAddress?: string | null;
}) {
  const invoice = await prisma.invoice.findUnique({ where: { id: input.invoiceId } });
  if (!invoice) throw new BillingError("Fatura não encontrada.", "NOT_FOUND", 404);
  if (invoice.status === InvoiceStatus.PAID) {
    throw new BillingError("Fatura paga não pode voltar para pendente.", "INVALID_STATE", 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: InvoiceStatus.PENDING },
    });
    await tx.subscription.update({
      where: { id: invoice.subscriptionId },
      data: {
        adminPaymentStatus: AdminPaymentStatus.PENDING,
        status: SubscriptionStatus.INCOMPLETE,
      },
    });
    await tx.paymentAttempt.updateMany({
      where: { invoiceId: invoice.id },
      data: { status: PaymentAttemptStatus.PENDING },
    });
  });

  await recordAdminAction({
    actorId: input.actorId,
    action: "billing.invoice_marked_pending",
    targetType: "invoice",
    targetId: invoice.id,
    metadata: { subscriptionId: invoice.subscriptionId },
    ipAddress: input.ipAddress,
  });
}

export async function cancelInvoice(input: {
  invoiceId: string;
  actorId: string;
  confirmationPhrase?: string;
  ipAddress?: string | null;
}) {
  assertConfirmationPhrase(
    input.confirmationPhrase,
    BILLING_CONFIRMATION_PHRASES.CANCEL_INVOICE
  );

  const invoice = await prisma.invoice.findUnique({ where: { id: input.invoiceId } });
  if (!invoice) throw new BillingError("Fatura não encontrada.", "NOT_FOUND", 404);
  if (invoice.status === InvoiceStatus.PAID) {
    throw new BillingError("Fatura paga não pode ser cancelada.", "INVALID_STATE", 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: InvoiceStatus.CANCELLED, cancelledAt: new Date() },
    });
    await tx.paymentAttempt.updateMany({
      where: { invoiceId: invoice.id },
      data: { status: PaymentAttemptStatus.CANCELLED },
    });
  });

  await recordAdminAction({
    actorId: input.actorId,
    action: "billing.invoice_cancelled",
    targetType: "invoice",
    targetId: invoice.id,
    metadata: { subscriptionId: invoice.subscriptionId },
    ipAddress: input.ipAddress,
  });
}

export async function markInvoiceOverdue(invoiceId: string, actorId?: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return null;
  if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.CANCELLED) {
    return invoice;
  }

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: InvoiceStatus.OVERDUE },
  });

  await prisma.subscription.update({
    where: { id: invoice.subscriptionId },
    data: { adminPaymentStatus: AdminPaymentStatus.OVERDUE },
  });

  await markSubscriptionPastDue(invoice.subscriptionId, { actorId });

  return invoice;
}

export function serializeAdminInvoice(
  invoice: Awaited<ReturnType<typeof listInvoicesAdmin>>[number]
) {
  return {
    id: invoice.id,
    userId: invoice.userId,
    userEmail: invoice.user.email,
    subscriptionId: invoice.subscriptionId,
    subscriptionStatus: invoice.subscription.status,
    adminPaymentStatus: invoice.subscription.adminPaymentStatus,
    status: invoice.status,
    statusLabel: INVOICE_STATUS_LABELS[invoice.status],
    amountCents: invoice.amountCents,
    currency: invoice.currency,
    description: invoice.description,
    provider: invoice.provider,
    providerLabel: BILLING_PROVIDER_LABELS[invoice.provider],
    dueAt: invoice.dueAt,
    paidAt: invoice.paidAt,
    pixCopyPasteMasked: redactPixCopyPaste(invoice.pixCopyPaste),
    paymentAttempts: invoice.paymentAttempts.map((a) => ({
      id: a.id,
      status: a.status,
      statusLabel: PAYMENT_ATTEMPT_STATUS_LABELS[a.status],
      method: a.method,
      checkoutUrl: a.checkoutUrl,
    })),
    createdAt: invoice.createdAt,
  };
}
