import { AuditActorType, BillingProvider, InvoiceStatus, PaymentAttemptStatus } from "@prisma/client";
import { createAuditLog } from "@/lib/audit/log";
import { verifyBillingWebhookRequest } from "@/lib/env/critical";
import prisma from "@/lib/prisma";
import { markInvoiceOverdue, applyInvoicePaidEffects } from "@/lib/billing/invoice-service";
import {
  getBillingProviderAdapter,
  isMockBillingWebhookAllowed,
  isRealBillingEnabled,
} from "@/lib/billing/provider";
import { redactBillingPayload } from "@/lib/billing/redact";
import type { NormalizedProviderEvent } from "@/lib/billing/types";

export class BillingWebhookError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "BillingWebhookError";
  }
}

const KNOWN_PROVIDERS = new Set<string>([
  "manual",
  "mock",
  "asaas",
  "mercado_pago",
  "stripe",
]);

function mapProviderSlug(slug: string): BillingProvider {
  const normalized = slug.trim().toLowerCase();
  switch (normalized) {
    case "mock":
      return BillingProvider.MOCK;
    case "asaas":
      return BillingProvider.ASAAS;
    case "mercado_pago":
    case "mercadopago":
      return BillingProvider.MERCADO_PAGO;
    case "stripe":
      return BillingProvider.STRIPE;
    default:
      return BillingProvider.MANUAL;
  }
}

export function assertProviderWebhookAllowed(providerSlug: string) {
  if (!KNOWN_PROVIDERS.has(providerSlug.trim().toLowerCase())) {
    throw new BillingWebhookError("Provider desconhecido.", "UNKNOWN_PROVIDER", 404);
  }

  const provider = mapProviderSlug(providerSlug);
  if (provider === BillingProvider.MOCK || provider === BillingProvider.MANUAL) {
    if (!isMockBillingWebhookAllowed() && !isRealBillingEnabled()) {
      throw new BillingWebhookError(
        "Webhook sandbox desabilitado. Configure MOCK_BILLING_WEBHOOK_ENABLED ou BILLING_REAL_PAYMENTS_ENABLED.",
        "WEBHOOK_DISABLED",
        503
      );
    }
    return provider;
  }

  if (!isRealBillingEnabled()) {
    throw new BillingWebhookError(
      "Cobrança real desabilitada. Defina BILLING_REAL_PAYMENTS_ENABLED=true com credenciais.",
      "REAL_BILLING_DISABLED",
      503
    );
  }

  return provider;
}

export function verifyProviderWebhookSignature(
  provider: BillingProvider,
  request: Request,
  rawBody: string
) {
  const auth = verifyBillingWebhookRequest(request);
  if (!auth.ok) {
    if (auth.code === "WEBHOOK_MISCONFIGURED" && process.env.NODE_ENV !== "production") {
      return true;
    }
    return false;
  }

  const adapter = getBillingProviderAdapter(provider);
  if (adapter.verifyWebhookSignature) {
    return adapter.verifyWebhookSignature(request, rawBody);
  }

  return auth.ok;
}

async function recordProviderEvent(
  event: NormalizedProviderEvent,
  rawPayload: unknown,
  processStatus: string,
  processError?: string | null
) {
  const existing = await prisma.paymentProviderEvent.findUnique({
    where: {
      provider_eventId: {
        provider: event.provider,
        eventId: event.eventId,
      },
    },
  });

  if (existing?.processedAt) {
    return { duplicate: true, eventRecord: existing };
  }

  const eventRecord = await prisma.paymentProviderEvent.upsert({
    where: {
      provider_eventId: {
        provider: event.provider,
        eventId: event.eventId,
      },
    },
    create: {
      provider: event.provider,
      eventId: event.eventId,
      eventType: event.eventType,
      invoiceId: event.invoiceId ?? null,
      paymentAttemptId: event.paymentAttemptId ?? null,
      rawJson: redactBillingPayload(rawPayload) as object,
      idempotencyKey: event.idempotencyKey,
      processStatus,
      processError: processError ?? null,
      processedAt: processStatus === "processed" ? new Date() : null,
    },
    update: {
      eventType: event.eventType,
      rawJson: redactBillingPayload(rawPayload) as object,
      processStatus,
      processError: processError ?? null,
      processedAt: processStatus === "processed" ? new Date() : null,
    },
  });

  return { duplicate: false, eventRecord };
}

export async function handleProviderWebhook(
  providerSlug: string,
  payload: unknown,
  request: Request,
  rawBody: string
) {
  const provider = assertProviderWebhookAllowed(providerSlug);

  if (!verifyProviderWebhookSignature(provider, request, rawBody)) {
    throw new BillingWebhookError("Assinatura inválida.", "INVALID_SIGNATURE", 401);
  }

  const adapter = getBillingProviderAdapter(provider);
  const event = adapter.normalizeEvent(payload);

  const { duplicate, eventRecord } = await recordProviderEvent(event, payload, "pending");

  if (duplicate) {
    return { duplicate: true, processed: false };
  }

  try {
    if (!event.invoiceId) {
      await prisma.paymentProviderEvent.update({
        where: { id: eventRecord.id },
        data: {
          processStatus: "ignored",
          processError: "invoice_id_missing",
          processedAt: new Date(),
        },
      });
      return { duplicate: false, processed: false, ignored: true };
    }

    const invoice = await prisma.invoice.findUnique({ where: { id: event.invoiceId } });
    if (!invoice) {
      await prisma.paymentProviderEvent.update({
        where: { id: eventRecord.id },
        data: {
          processStatus: "ignored",
          processError: "invoice_not_found",
          processedAt: new Date(),
        },
      });
      return { duplicate: false, processed: false, ignored: true };
    }

    if (invoice.status === InvoiceStatus.PAID && !event.paid) {
      await prisma.paymentProviderEvent.update({
        where: { id: eventRecord.id },
        data: {
          processStatus: "ignored",
          processError: "paid_invoice_immutable",
          processedAt: new Date(),
        },
      });
      return { duplicate: false, processed: false, ignored: true };
    }

    if (event.paid) {
      if (event.paymentAttemptId) {
        await prisma.paymentAttempt.updateMany({
          where: { id: event.paymentAttemptId, invoiceId: invoice.id },
          data: { status: PaymentAttemptStatus.PAID },
        });
      }

      if (invoice.status !== InvoiceStatus.PAID) {
        await applyInvoicePaidEffects({
          invoiceId: invoice.id,
          actorId: "system_webhook",
        });
      }
    } else if (event.eventType.includes("failed")) {
      await prisma.paymentAttempt.updateMany({
        where: { invoiceId: invoice.id },
        data: {
          status: PaymentAttemptStatus.FAILED,
          failureMessage: event.failureMessage?.slice(0, 500) ?? "Falha no gateway",
        },
      });
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.FAILED },
      });
    } else if (event.eventType.includes("overdue")) {
      await markInvoiceOverdue(invoice.id);
    }

    await prisma.paymentProviderEvent.update({
      where: { id: eventRecord.id },
      data: { processStatus: "processed", processedAt: new Date() },
    });

    await createAuditLog({
      actorType: AuditActorType.SYSTEM,
      action: "billing.webhook_processed",
      entityType: "payment_provider_event",
      entityId: eventRecord.id,
      metadata: {
        provider: event.provider,
        eventType: event.eventType,
        invoiceId: event.invoiceId,
      },
    });

    return { duplicate: false, processed: true };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "processing_error";
    await prisma.paymentProviderEvent.update({
      where: { id: eventRecord.id },
      data: { processStatus: "failed", processError: message, processedAt: new Date() },
    });
    throw error;
  }
}

/** Ponte para webhook legado /api/webhooks/billing. */
export { handleBillingWebhook } from "@/lib/billing/webhook-handler";
