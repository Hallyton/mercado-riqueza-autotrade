import { InvoiceStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  getInvoiceStatusClientMessage,
  invoiceHasPendingPaymentCopy,
  invoiceIsPaid,
  INVOICE_REAL_ACCOUNT_DISCLAIMER,
  PORTAL_REAL_ACCOUNT_REQUIREMENTS,
} from "@/lib/billing/invoice-client-copy";

describe("invoice client copy", () => {
  it("invoice PAID mostra Pagamento confirmado", () => {
    expect(getInvoiceStatusClientMessage(InvoiceStatus.PAID)).toBe(
      "Pagamento confirmado."
    );
    expect(invoiceIsPaid(InvoiceStatus.PAID)).toBe(true);
  });

  it("invoice PENDING mostra Aguardando confirmação", () => {
    expect(getInvoiceStatusClientMessage(InvoiceStatus.PENDING)).toBe(
      "Aguardando confirmação de pagamento."
    );
    expect(invoiceHasPendingPaymentCopy(InvoiceStatus.PENDING)).toBe(true);
  });

  it("invoice OPEN mostra Aguardando confirmação", () => {
    expect(getInvoiceStatusClientMessage(InvoiceStatus.OPEN)).toBe(
      "Aguardando confirmação de pagamento."
    );
  });

  it("invoice PAID não usa copy de pendência", () => {
    expect(invoiceHasPendingPaymentCopy(InvoiceStatus.PAID)).toBe(false);
    expect(getInvoiceStatusClientMessage(InvoiceStatus.PAID)).not.toMatch(
      /Aguardando confirmação/
    );
  });

  it("invoice OVERDUE mostra pagamento vencido", () => {
    expect(getInvoiceStatusClientMessage(InvoiceStatus.OVERDUE)).toBe(
      "Pagamento vencido."
    );
  });

  it("invoice CANCELLED/VOID mostra fatura cancelada", () => {
    expect(getInvoiceStatusClientMessage(InvoiceStatus.CANCELLED)).toBe(
      "Fatura cancelada."
    );
    expect(getInvoiceStatusClientMessage(InvoiceStatus.VOID)).toBe(
      "Fatura cancelada."
    );
  });

  it("disclaimer de conta real não promete liberação automática", () => {
    expect(INVOICE_REAL_ACCOUNT_DISCLAIMER).toMatch(/não libera operação em conta real/i);
    expect(PORTAL_REAL_ACCOUNT_REQUIREMENTS).toMatch(/PRE_MARKET/i);
    expect(PORTAL_REAL_ACCOUNT_REQUIREMENTS).not.toMatch(/conta real liberada/i);
  });
});
