export type AsaasCustomerResponse = {
  id: string;
  name?: string;
  email?: string;
  cpfCnpj?: string;
  mobilePhone?: string;
  externalReference?: string;
};

export type AsaasPaymentResponse = {
  id: string;
  customer: string;
  billingType?: string;
  value?: number;
  netValue?: number;
  status?: string;
  dueDate?: string;
  description?: string;
  externalReference?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string | null;
  deleted?: boolean;
};

export type AsaasPixQrCodeResponse = {
  encodedImage?: string;
  payload?: string;
  expirationDate?: string;
};

export type AsaasWebhookPayload = {
  id?: string;
  event?: string;
  dateCreated?: string;
  payment?: AsaasPaymentResponse;
};

export type AsaasApiErrorBody = {
  errors?: Array<{ code?: string; description?: string }>;
};

export const ASAAS_PAID_EVENTS = new Set([
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
]);

export const ASAAS_FAILED_EVENTS = new Set([
  "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED",
  "PAYMENT_REPROVED_BY_RISK_ANALYSIS",
]);

export const ASAAS_OVERDUE_EVENTS = new Set(["PAYMENT_OVERDUE"]);

export const ASAAS_CANCELLED_EVENTS = new Set([
  "PAYMENT_DELETED",
  "PAYMENT_REFUNDED",
]);

export const ASAAS_PENDING_EVENTS = new Set([
  "PAYMENT_CREATED",
  "PAYMENT_UPDATED",
  "PAYMENT_AUTHORIZED",
  "PAYMENT_AWAITING_RISK_ANALYSIS",
]);
