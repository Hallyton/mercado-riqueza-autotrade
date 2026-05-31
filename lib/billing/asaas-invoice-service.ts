import { BillingProvider, InvoiceStatus, PaymentAttemptStatus, PaymentMethod } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  cancelAsaasPayment,
  createAsaasPixPayment,
  getAsaasPayment,
  getAsaasPixQrCode,
} from "@/lib/billing/asaas-client";
import { AsaasClientError } from "@/lib/billing/asaas-client";
import { assertAsaasChargeAllowed } from "@/lib/billing/asaas-config";
import { ensureAsaasBillingCustomer } from "@/lib/billing/asaas-customer";
import { redactAsaasPayload } from "@/lib/billing/asaas-redact";
import { applyInvoicePaidEffects } from "@/lib/billing/invoice-service";
import { BillingError } from "@/lib/billing/errors";

function formatAsaasDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function centsToReais(cents: number): number {
  return Math.round(cents) / 100;
}

function mapAsaasPaymentStatus(status: string | undefined): InvoiceStatus {
  const normalized = (status ?? "").toUpperCase();
  if (["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(normalized)) {
    return InvoiceStatus.PAID;
  }
  if (normalized === "OVERDUE") return InvoiceStatus.OVERDUE;
  if (["REFUNDED", "DELETED"].includes(normalized) || normalized.includes("CANCEL")) {
    return InvoiceStatus.CANCELLED;
  }
  if (["REFUSED", "FAILED"].includes(normalized)) return InvoiceStatus.FAILED;
  return InvoiceStatus.PENDING;
}

export async function provisionAsaasPaymentForInvoice(invoiceId: string) {
  assertAsaasChargeAllowed();

  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: {
      paymentAttempts: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (invoice.provider !== BillingProvider.ASAAS) {
    throw new BillingError("Fatura não é Asaas.", "INVALID_PROVIDER", 400);
  }

  if (invoice.status === InvoiceStatus.PAID) {
    return invoice;
  }

  const existingPaymentId =
    invoice.paymentAttempts[0]?.providerPaymentId ?? invoice.providerInvoiceId;

  if (existingPaymentId) {
    return syncAsaasPaymentForInvoice(invoiceId);
  }

  const customer = await ensureAsaasBillingCustomer(invoice.userId);
  const dueDate = invoice.dueAt ?? new Date(Date.now() + 7 * 86400000);

  const payment = await createAsaasPixPayment({
    customerId: customer.providerCustomerId,
    value: centsToReais(invoice.amountCents),
    dueDate: formatAsaasDate(dueDate),
    description:
      invoice.description ??
      "Mercado da Riqueza AutoTrade — AutoTrade Single Robot",
    externalReference: invoice.id,
  });

  let pixQrCodeUrl: string | null = null;
  let pixCopyPaste: string | null = null;

  try {
    const pix = await getAsaasPixQrCode(payment.id);
    pixCopyPaste = pix.payload ?? null;
    if (pix.encodedImage) {
      pixQrCodeUrl = pix.encodedImage.startsWith("data:")
        ? pix.encodedImage
        : `data:image/png;base64,${pix.encodedImage}`;
    }
  } catch {
    // Pix QR pode falhar se chave Pix não configurada no sandbox
  }

  const paymentUrl = payment.invoiceUrl ?? payment.bankSlipUrl ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        provider: BillingProvider.ASAAS,
        providerInvoiceId: payment.id,
        gatewayInvoiceId: payment.id,
        paymentUrl,
        pixQrCodeUrl,
        pixCopyPaste,
        status: InvoiceStatus.PENDING,
        metadataJson: {
          asaasStatus: payment.status ?? "PENDING",
          asaasCustomerId: customer.providerCustomerId,
          recurringEnabled: false,
        },
      },
    });

    const latestAttempt = invoice.paymentAttempts[0];
    if (latestAttempt) {
      await tx.paymentAttempt.update({
        where: { id: latestAttempt.id },
        data: {
          provider: BillingProvider.ASAAS,
          method: PaymentMethod.PIX,
          status: PaymentAttemptStatus.PENDING,
          providerPaymentId: payment.id,
          checkoutUrl: paymentUrl,
        },
      });
    } else {
      await tx.paymentAttempt.create({
        data: {
          invoiceId: invoice.id,
          userId: invoice.userId,
          provider: BillingProvider.ASAAS,
          method: PaymentMethod.PIX,
          status: PaymentAttemptStatus.PENDING,
          amountCents: invoice.amountCents,
          providerPaymentId: payment.id,
          checkoutUrl: paymentUrl,
        },
      });
    }
  });

  return prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
}

export async function syncAsaasPaymentForInvoice(invoiceId: string, actorId?: string) {
  assertAsaasChargeAllowed();

  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { paymentAttempts: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  const paymentId =
    invoice.paymentAttempts[0]?.providerPaymentId ?? invoice.providerInvoiceId;

  if (!paymentId) {
    throw new BillingError("Cobrança Asaas não encontrada.", "ASAAS_PAYMENT_MISSING", 404);
  }

  const payment = await getAsaasPayment(paymentId);
  const mappedStatus = mapAsaasPaymentStatus(payment.status);

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      paymentUrl: payment.invoiceUrl ?? invoice.paymentUrl,
      metadataJson: {
        ...(typeof invoice.metadataJson === "object" && invoice.metadataJson
          ? (invoice.metadataJson as Record<string, unknown>)
          : {}),
        asaasStatus: payment.status ?? null,
        asaasSyncedAt: new Date().toISOString(),
        asaasRaw: redactAsaasPayload(payment) as object,
      },
    },
  });

  if (mappedStatus === InvoiceStatus.PAID && invoice.status !== InvoiceStatus.PAID) {
    await applyInvoicePaidEffects({
      invoiceId: invoice.id,
      actorId: actorId ?? "system_asaas_sync",
    });
  } else if (mappedStatus !== invoice.status && mappedStatus !== InvoiceStatus.PAID) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: mappedStatus },
    });
  }

  return prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
}

export async function cancelAsaasPaymentForInvoice(invoiceId: string) {
  assertAsaasChargeAllowed();

  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { paymentAttempts: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  if (invoice.status === InvoiceStatus.PAID) {
    throw new BillingError("Fatura paga não pode ser cancelada.", "INVALID_STATE", 400);
  }

  const paymentId =
    invoice.paymentAttempts[0]?.providerPaymentId ?? invoice.providerInvoiceId;

  if (paymentId) {
    try {
      await cancelAsaasPayment(paymentId);
    } catch (error) {
      if (!(error instanceof AsaasClientError) || error.status !== 404) {
        throw error;
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        status: InvoiceStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });
    await tx.paymentAttempt.updateMany({
      where: { invoiceId: invoice.id },
      data: { status: PaymentAttemptStatus.CANCELLED },
    });
  });

  return prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
}

export function readProviderStatus(metadataJson: unknown): string | null {
  if (!metadataJson || typeof metadataJson !== "object" || Array.isArray(metadataJson)) {
    return null;
  }
  const status = (metadataJson as Record<string, unknown>).asaasStatus;
  return typeof status === "string" ? status : null;
}
