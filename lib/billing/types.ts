import type {
  BillingProvider,
  InvoiceStatus,
  PaymentAttemptStatus,
  PaymentMethod,
} from "@prisma/client";

export const BILLING_CONFIRMATION_PHRASES = {
  MARK_PAID: "MARCAR FATURA PAGA",
  CANCEL_INVOICE: "CANCELAR FATURA",
  SUSPEND_SUBSCRIPTION: "SUSPENDER ASSINATURA",
} as const;

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Rascunho",
  OPEN: "Aberta",
  PENDING: "Pendente",
  PAID: "Paga",
  OVERDUE: "Em atraso",
  CANCELLED: "Cancelada",
  VOID: "Anulada",
  FAILED: "Falhou",
  UNCOLLECTIBLE: "Inadimplente",
};

export const PAYMENT_ATTEMPT_STATUS_LABELS: Record<PaymentAttemptStatus, string> = {
  CREATED: "Criada",
  PENDING: "Pendente",
  PAID: "Paga",
  FAILED: "Falhou",
  CANCELLED: "Cancelada",
  EXPIRED: "Expirada",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  PIX: "Pix",
  CARD: "Cartão",
  BOLETO: "Boleto",
  MANUAL: "Manual",
  UNKNOWN: "Não informado",
};

export const BILLING_PROVIDER_LABELS: Record<BillingProvider, string> = {
  MANUAL: "Manual / administrativo",
  MOCK: "Sandbox (mock)",
  ASAAS: "Asaas",
  MERCADO_PAGO: "Mercado Pago",
  STRIPE: "Stripe",
};

export type ClientInvoiceView = {
  id: string;
  status: InvoiceStatus;
  statusLabel: string;
  amountCents: number;
  currency: string;
  description: string | null;
  provider: BillingProvider;
  providerLabel: string;
  methodLabel: string;
  dueAt: string | null;
  paidAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  paymentUrl: string | null;
  checkoutUrl: string | null;
  pixCopyPaste: string | null;
  pixQrCodeUrl: string | null;
  providerStatus: string | null;
  createdAt: string;
};

export type NormalizedProviderEvent = {
  provider: BillingProvider;
  eventId: string;
  eventType: string;
  idempotencyKey: string;
  invoiceId?: string;
  paymentAttemptId?: string;
  providerPaymentId?: string;
  amountCents?: number;
  paid: boolean;
  failureMessage?: string;
};
