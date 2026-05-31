import { InvoiceStatus } from "@prisma/client";

export const INVOICE_REAL_ACCOUNT_DISCLAIMER =
  "O pagamento confirma a assinatura comercial, mas não libera operação em conta real automaticamente.";

export const PORTAL_REAL_ACCOUNT_REQUIREMENTS =
  "Operação em conta real depende de aprovação operacional, device ativo, margem, PRE_MARKET, preflight aprovado e confirmação das proteções obrigatórias.";

export function getInvoiceStatusClientMessage(status: InvoiceStatus): string {
  switch (status) {
    case InvoiceStatus.PAID:
      return "Pagamento confirmado.";
    case InvoiceStatus.PENDING:
    case InvoiceStatus.OPEN:
      return "Aguardando confirmação de pagamento.";
    case InvoiceStatus.OVERDUE:
      return "Pagamento vencido.";
    case InvoiceStatus.CANCELLED:
    case InvoiceStatus.VOID:
      return "Fatura cancelada.";
    case InvoiceStatus.FAILED:
      return "Pagamento não concluído.";
    case InvoiceStatus.DRAFT:
      return "Fatura em preparação.";
    case InvoiceStatus.UNCOLLECTIBLE:
      return "Fatura inadimplente.";
    default:
      return "Status de pagamento indisponível.";
  }
}

export function invoiceHasPendingPaymentCopy(status: InvoiceStatus): boolean {
  return status === InvoiceStatus.PENDING || status === InvoiceStatus.OPEN;
}

export function invoiceIsPaid(status: InvoiceStatus): boolean {
  return status === InvoiceStatus.PAID;
}
