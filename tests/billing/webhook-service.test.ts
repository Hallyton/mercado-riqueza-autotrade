import { describe, expect, it, vi, beforeEach } from "vitest";
import { BillingProvider, InvoiceStatus } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  paymentProviderEvent: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  invoice: { findUnique: vi.fn(), update: vi.fn() },
  paymentAttempt: { updateMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/audit/log", () => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/billing/invoice-service", () => ({
  applyInvoicePaidEffects: vi.fn(),
  markInvoiceOverdue: vi.fn(),
}));
vi.mock("@/lib/env/critical", () => ({
  verifyBillingWebhookRequest: vi.fn(() => ({ ok: true })),
}));
vi.mock("@/lib/billing/provider-registry", () => ({
  getBillingProviderAdapter: vi.fn(() => ({
    normalizeEvent: (payload: Record<string, unknown>) => ({
      provider: BillingProvider.MOCK,
      eventId: String(payload.eventId),
      eventType: String(payload.eventType ?? "payment.approved"),
      idempotencyKey: String(payload.idempotencyKey ?? payload.eventId),
      invoiceId: payload.invoiceId ? String(payload.invoiceId) : undefined,
      paid: payload.paid === true,
    }),
    verifyWebhookSignature: vi.fn(() => true),
  })),
}));
vi.mock("@/lib/billing/provider", () => ({
  isRealBillingEnabled: vi.fn(() => false),
  isMockBillingWebhookAllowed: vi.fn(() => true),
}));

import { handleProviderWebhook } from "@/lib/billing/webhook-service";
import { applyInvoicePaidEffects } from "@/lib/billing/invoice-service";

describe("billing webhook idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.paymentProviderEvent.findUnique.mockResolvedValue(null);
    prismaMock.paymentProviderEvent.upsert.mockResolvedValue({ id: "evt_1" });
    prismaMock.invoice.findUnique.mockResolvedValue({
      id: "inv_1",
      status: InvoiceStatus.OPEN,
      subscriptionId: "sub_1",
    });
  });

  it("evento duplicado não reprocessa", async () => {
    prismaMock.paymentProviderEvent.upsert.mockResolvedValue({
      id: "evt_1",
      processedAt: new Date(),
    });

    const req = new Request("http://localhost/api/billing/webhook/mock", {
      method: "POST",
      body: "{}",
    });

    prismaMock.paymentProviderEvent.findUnique.mockResolvedValue({
      id: "evt_1",
      processedAt: new Date(),
    });

    const first = await handleProviderWebhook(
      "mock",
      { eventId: "e1", invoiceId: "inv_1", paid: true },
      req,
      "{}"
    );
    expect(first.duplicate).toBe(true);
    expect(applyInvoicePaidEffects).not.toHaveBeenCalled();
  });

  it("evento válido processa pagamento", async () => {
    const req = new Request("http://localhost/api/billing/webhook/mock", {
      method: "POST",
      body: "{}",
    });

    const result = await handleProviderWebhook(
      "mock",
      {
        eventId: "e2",
        idempotencyKey: "e2",
        invoiceId: "inv_1",
        paid: true,
        eventType: "payment.approved",
      },
      req,
      "{}"
    );

    expect(result.processed).toBe(true);
    expect(applyInvoicePaidEffects).toHaveBeenCalledWith({
      invoiceId: "inv_1",
      actorId: "system_webhook",
    });
  });

  it("invoice inexistente não quebra", async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(null);
    const req = new Request("http://localhost/api/billing/webhook/mock", {
      method: "POST",
      body: "{}",
    });

    const result = await handleProviderWebhook(
      "mock",
      { eventId: "e3", invoiceId: "missing", paid: true },
      req,
      "{}"
    );

    expect(result.ignored).toBe(true);
  });
});

describe("redact billing payload", () => {
  it("redige secrets", async () => {
    const { redactBillingPayload } = await import("@/lib/billing/redact");
    const out = redactBillingPayload({
      token: "secret-token",
      amountCents: 30000,
    }) as Record<string, unknown>;
    expect(out.token).toBe("[REDACTED]");
    expect(out.amountCents).toBe(30000);
  });
});
