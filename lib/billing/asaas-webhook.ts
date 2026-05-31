import { BillingProvider } from "@prisma/client";
import {
  getAsaasWebhookToken,
  isAsaasSandboxMode,
  isRealBillingEnabled,
} from "@/lib/billing/asaas-config";
import type { AsaasWebhookPayload } from "@/lib/billing/asaas-types";
import {
  ASAAS_CANCELLED_EVENTS,
  ASAAS_FAILED_EVENTS,
  ASAAS_OVERDUE_EVENTS,
  ASAAS_PAID_EVENTS,
} from "@/lib/billing/asaas-types";
import type { NormalizedProviderEvent } from "@/lib/billing/types";

const PAID_STATUSES = new Set([
  "RECEIVED",
  "CONFIRMED",
  "RECEIVED_IN_CASH",
]);

export function verifyAsaasWebhookRequest(request: Request): boolean {
  const token = getAsaasWebhookToken();

  if (token) {
    const header =
      request.headers.get("asaas-access-token") ??
      request.headers.get("x-asaas-access-token");
    return header === token;
  }

  if (isAsaasSandboxMode() && !isRealBillingEnabled()) {
    return true;
  }

  return false;
}

export function normalizeAsaasWebhookEvent(payload: unknown): NormalizedProviderEvent {
  const body = payload as AsaasWebhookPayload;
  const eventType = String(body.event ?? "ASAAS_UNKNOWN");
  const payment = body.payment;
  const eventId = String(body.id ?? `${eventType}:${payment?.id ?? Date.now()}`);

  const invoiceId = payment?.externalReference
    ? String(payment.externalReference)
    : undefined;

  const providerPaymentId = payment?.id ? String(payment.id) : undefined;
  const paymentStatus = payment?.status ? String(payment.status).toUpperCase() : "";

  const paid =
    ASAAS_PAID_EVENTS.has(eventType) ||
    PAID_STATUSES.has(paymentStatus);

  const failed =
    ASAAS_FAILED_EVENTS.has(eventType) ||
    paymentStatus === "REFUNDED";

  const cancelled = ASAAS_CANCELLED_EVENTS.has(eventType) || payment?.deleted === true;
  const overdue = ASAAS_OVERDUE_EVENTS.has(eventType) || paymentStatus === "OVERDUE";

  let normalizedType = eventType.toLowerCase();
  if (failed) normalizedType = "payment.failed";
  else if (cancelled) normalizedType = "payment.cancelled";
  else if (overdue) normalizedType = "payment.overdue";
  else if (paid) normalizedType = "payment.paid";

  return {
    provider: BillingProvider.ASAAS,
    eventId,
    eventType: normalizedType,
    idempotencyKey: eventId,
    invoiceId,
    providerPaymentId,
    amountCents:
      typeof payment?.value === "number"
        ? Math.round(payment.value * 100)
        : undefined,
    paid,
    failureMessage: failed ? eventType : undefined,
  };
}
