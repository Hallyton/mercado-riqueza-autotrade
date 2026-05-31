import { BillingProvider } from "@prisma/client";

export type AsaasEnvironment = "sandbox" | "production";

export class AsaasConfigError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 503
  ) {
    super(message);
    this.name = "AsaasConfigError";
  }
}

const DEFAULT_SANDBOX_BASE = "https://api-sandbox.asaas.com/v3";
const DEFAULT_PRODUCTION_BASE = "https://api.asaas.com/v3";

export function getAsaasEnvironment(): AsaasEnvironment {
  const raw = process.env.ASAAS_ENV?.trim().toLowerCase();
  if (raw === "production" || raw === "prod") return "production";
  return "sandbox";
}

export function getAsaasBaseUrl(): string {
  const env = getAsaasEnvironment();
  if (env === "sandbox") {
    return process.env.ASAAS_BASE_URL_SANDBOX?.trim() || DEFAULT_SANDBOX_BASE;
  }
  return process.env.ASAAS_BASE_URL_PRODUCTION?.trim() || DEFAULT_PRODUCTION_BASE;
}

export function getAsaasApiKey(): string | undefined {
  const key = process.env.ASAAS_API_KEY?.trim();
  return key && key.length > 0 ? key : undefined;
}

export function getAsaasWebhookToken(): string | undefined {
  const token =
    process.env.ASAAS_WEBHOOK_TOKEN?.trim() ||
    process.env.ASAAS_WEBHOOK_SECRET?.trim();
  return token && token.length > 0 ? token : undefined;
}

export function isAsaasConfigured(): boolean {
  return Boolean(getAsaasApiKey());
}

export function isAsaasSandboxMode(): boolean {
  return getAsaasEnvironment() === "sandbox";
}

export function isRealBillingEnabled(): boolean {
  return process.env.BILLING_REAL_PAYMENTS_ENABLED === "true";
}

/** Bloqueia cobrança Asaas em produção sem flag explícita. */
export function assertAsaasChargeAllowed(): void {
  if (getAsaasEnvironment() === "production" && !isRealBillingEnabled()) {
    throw new AsaasConfigError(
      "Cobrança real desabilitada. Defina BILLING_REAL_PAYMENTS_ENABLED=true para produção Asaas.",
      "REAL_BILLING_DISABLED"
    );
  }

  if (!getAsaasApiKey()) {
    throw new AsaasConfigError(
      "Asaas não configurado. Defina ASAAS_API_KEY no ambiente.",
      "ASAAS_NOT_CONFIGURED"
    );
  }
}

export function isAsaasWebhookAllowedWithoutRealFlag(): boolean {
  return isAsaasSandboxMode() && isAsaasConfigured();
}

export function getSandboxDefaultCpfCnpj(): string {
  return process.env.ASAAS_SANDBOX_DEFAULT_CPF?.trim() || "24971563792";
}

export const ASAAS_CONFIRMATION_PHRASES = {
  CANCEL_CHARGE: "CANCELAR COBRANCA ASAAS",
  SYNC: "SINCRONIZAR ASAAS",
} as const;
