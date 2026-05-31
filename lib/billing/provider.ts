import type { BillingProvider } from "@prisma/client";
import type { NormalizedProviderEvent } from "./types";

export type CreateInvoiceInput = {
  userId: string;
  subscriptionId: string;
  planId: string;
  amountCents: number;
  currency?: string;
  description?: string;
  periodStart?: Date;
  periodEnd?: Date;
  dueAt?: Date;
};

export type CreatePaymentAttemptInput = {
  invoiceId: string;
  userId: string;
  amountCents: number;
  method?: "MANUAL" | "PIX" | "CARD" | "BOLETO" | "UNKNOWN";
  checkoutUrl?: string | null;
};

export interface BillingProviderAdapter {
  readonly provider: BillingProvider;
  createInvoice(input: CreateInvoiceInput): Promise<{
    providerInvoiceId?: string;
    paymentUrl?: string | null;
    pixQrCodeUrl?: string | null;
    pixCopyPaste?: string | null;
  }>;
  createPaymentAttempt(
    input: CreatePaymentAttemptInput
  ): Promise<{ providerPaymentId?: string; checkoutUrl?: string | null }>;
  cancelInvoice(providerInvoiceId: string): Promise<void>;
  normalizeEvent(payload: unknown): NormalizedProviderEvent;
  verifyWebhookSignature?(request: Request, rawBody: string): boolean;
}

export function isRealBillingEnabled(): boolean {
  return process.env.BILLING_REAL_PAYMENTS_ENABLED === "true";
}

export function getConfiguredBillingProvider(): BillingProvider {
  const raw = process.env.BILLING_PROVIDER?.trim().toUpperCase() ?? "MANUAL";
  if (raw === "MOCK") return "MOCK";
  if (raw === "ASAAS") return "ASAAS";
  if (raw === "MERCADO_PAGO") return "MERCADO_PAGO";
  if (raw === "STRIPE") return "STRIPE";
  return "MANUAL";
}

export function isMockBillingWebhookAllowed(): boolean {
  if (isRealBillingEnabled()) return false;
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.MOCK_BILLING_WEBHOOK_ENABLED === "true";
}

export { getBillingProviderAdapter, defaultInvoiceDueDate } from "@/lib/billing/provider-registry";
