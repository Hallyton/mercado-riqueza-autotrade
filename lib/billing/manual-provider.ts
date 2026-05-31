import { BillingProvider } from "@prisma/client";
import type {
  BillingProviderAdapter,
  CreateInvoiceInput,
  CreatePaymentAttemptInput,
} from "./provider";
import type { NormalizedProviderEvent } from "./types";

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export class ManualBillingProvider implements BillingProviderAdapter {
  readonly provider = BillingProvider.MANUAL;

  async createInvoice(_input: CreateInvoiceInput) {
    return {
      providerInvoiceId: undefined,
      paymentUrl: null,
      pixQrCodeUrl: null,
      pixCopyPaste: null,
    };
  }

  async createPaymentAttempt(_input: CreatePaymentAttemptInput) {
    return { providerPaymentId: undefined, checkoutUrl: null };
  }

  async cancelInvoice(_providerInvoiceId: string) {
    return;
  }

  normalizeEvent(payload: unknown): NormalizedProviderEvent {
    const body = payload as Record<string, unknown>;
    return {
      provider: BillingProvider.MANUAL,
      eventId: String(body.eventId ?? body.id ?? "manual-unknown"),
      eventType: String(body.eventType ?? body.type ?? "manual.unknown"),
      idempotencyKey: String(body.idempotencyKey ?? body.eventId ?? body.id ?? "manual-unknown"),
      invoiceId: body.invoiceId ? String(body.invoiceId) : undefined,
      paymentAttemptId: body.paymentAttemptId ? String(body.paymentAttemptId) : undefined,
      amountCents: typeof body.amountCents === "number" ? body.amountCents : undefined,
      paid: body.paid === true || body.eventType === "payment.paid",
      failureMessage: body.failureMessage ? String(body.failureMessage) : undefined,
    };
  }
}

export class MockBillingProvider implements BillingProviderAdapter {
  readonly provider = BillingProvider.MOCK;

  async createInvoice(input: CreateInvoiceInput) {
    const id = `mock_inv_${input.subscriptionId.slice(-8)}_${Date.now()}`;
    return {
      providerInvoiceId: id,
      paymentUrl: null,
      pixQrCodeUrl: null,
      pixCopyPaste: null,
    };
  }

  async createPaymentAttempt(input: CreatePaymentAttemptInput) {
    const id = `mock_pay_${input.invoiceId.slice(-8)}_${Date.now()}`;
    return {
      providerPaymentId: id,
      checkoutUrl: `/dashboard/comercial/faturas/${input.invoiceId}?sandbox=1`,
    };
  }

  async cancelInvoice(_providerInvoiceId: string) {
    return;
  }

  normalizeEvent(payload: unknown): NormalizedProviderEvent {
    const body = payload as Record<string, unknown>;
    const eventType = String(body.eventType ?? body.type ?? "payment.approved");
    return {
      provider: BillingProvider.MOCK,
      eventId: String(body.eventId ?? body.id ?? `mock_${Date.now()}`),
      eventType,
      idempotencyKey: String(
        body.idempotencyKey ?? body.eventId ?? body.id ?? `mock_${Date.now()}`
      ),
      invoiceId: body.invoiceId ? String(body.invoiceId) : undefined,
      paymentAttemptId: body.paymentAttemptId ? String(body.paymentAttemptId) : undefined,
      amountCents: typeof body.amountCents === "number" ? body.amountCents : undefined,
      paid:
        eventType === "payment.approved" ||
        eventType === "payment.paid" ||
        body.paid === true,
      failureMessage: body.failureMessage ? String(body.failureMessage) : undefined,
    };
  }

  verifyWebhookSignature(_request: Request, _rawBody: string) {
    return true;
  }
}

export function defaultInvoiceDueDate(from = new Date()) {
  return addDays(from, 7);
}
