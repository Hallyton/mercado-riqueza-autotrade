import { describe, expect, it, vi } from "vitest";
import { BillingProvider } from "@prisma/client";
import {
  normalizeAsaasWebhookEvent,
  verifyAsaasWebhookRequest,
} from "@/lib/billing/asaas-webhook";
import { redactAsaasPayload } from "@/lib/billing/asaas-redact";

describe("asaas webhook normalize", () => {
  it("PAYMENT_RECEIVED marca paid e usa externalReference", () => {
    const event = normalizeAsaasWebhookEvent({
      id: "evt_1",
      event: "PAYMENT_RECEIVED",
      payment: {
        id: "pay_1",
        externalReference: "inv_1",
        status: "RECEIVED",
        value: 300,
      },
    });

    expect(event.paid).toBe(true);
    expect(event.invoiceId).toBe("inv_1");
    expect(event.providerPaymentId).toBe("pay_1");
    expect(event.provider).toBe(BillingProvider.ASAAS);
  });

  it("PAYMENT_OVERDUE não marca paid", () => {
    const event = normalizeAsaasWebhookEvent({
      id: "evt_2",
      event: "PAYMENT_OVERDUE",
      payment: { id: "pay_2", externalReference: "inv_2", status: "OVERDUE" },
    });
    expect(event.paid).toBe(false);
    expect(event.eventType).toContain("overdue");
  });

  it("PAYMENT_DELETED mapeia cancelled", () => {
    const event = normalizeAsaasWebhookEvent({
      id: "evt_3",
      event: "PAYMENT_DELETED",
      payment: { id: "pay_3", externalReference: "inv_3", deleted: true },
    });
    expect(event.eventType).toContain("cancelled");
  });
});

describe("asaas webhook auth", () => {
  it("valida asaas-access-token quando configurado", () => {
    vi.stubEnv("ASAAS_WEBHOOK_TOKEN", "token_test");
    const ok = verifyAsaasWebhookRequest(
      new Request("http://localhost", {
        headers: { "asaas-access-token": "token_test" },
      })
    );
    expect(ok).toBe(true);
    vi.unstubAllEnvs();
  });

  it("rejeita token inválido", () => {
    vi.stubEnv("ASAAS_WEBHOOK_TOKEN", "token_test");
    const ok = verifyAsaasWebhookRequest(
      new Request("http://localhost", {
        headers: { "asaas-access-token": "wrong" },
      })
    );
    expect(ok).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe("asaas redact", () => {
  it("redige creditCard no payload", () => {
    const out = redactAsaasPayload({
      event: "PAYMENT_RECEIVED",
      payment: { creditCard: { creditCardNumber: "8829" }, value: 300 },
    }) as { payment: { creditCard: string } };
    expect(out.payment.creditCard).toBe("[REDACTED]");
  });
});
