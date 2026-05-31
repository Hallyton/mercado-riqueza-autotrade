import { BillingProvider } from "@prisma/client";
import type {
  BillingProviderAdapter,
  CreateInvoiceInput,
  CreatePaymentAttemptInput,
} from "./provider";
import type { NormalizedProviderEvent } from "./types";
import { normalizeAsaasWebhookEvent, verifyAsaasWebhookRequest } from "./asaas-webhook";

export class AsaasBillingProvider implements BillingProviderAdapter {
  readonly provider = BillingProvider.ASAAS;

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
    return normalizeAsaasWebhookEvent(payload);
  }

  verifyWebhookSignature(request: Request, _rawBody: string) {
    return verifyAsaasWebhookRequest(request);
  }
}
