import type { LicenseStatus, SubscriptionStatus } from "@prisma/client";

export type LicenseFlagInput = {
  licenseStatus: LicenseStatus;
  subscriptionStatus: SubscriptionStatus | null;
  haltNewEntries: boolean;
  haltAllTrading: boolean;
};

/**
 * Novas entradas bloqueadas quando licença/assinatura inativa ou flags do servidor.
 */
export function canAcceptNewEntries(input: LicenseFlagInput): boolean {
  if (input.haltAllTrading || input.haltNewEntries) return false;
  if (input.licenseStatus !== "ACTIVE") return false;
  if (input.subscriptionStatus !== "ACTIVE") return false;
  return true;
}

/**
 * Gestão de posição aberta (saída/ajuste) permitida mesmo com assinatura em atraso,
 * desde que não haja halt total nem revogação.
 */
export function canManageOpenPositions(input: LicenseFlagInput): boolean {
  if (input.haltAllTrading) return false;
  if (input.licenseStatus === "REVOKED") return false;
  if (input.licenseStatus === "PENDING_ACTIVATION") return false;
  return (
    input.licenseStatus === "ACTIVE" || input.licenseStatus === "SUSPENDED"
  );
}

export function buildOperationalMessage(input: LicenseFlagInput): string {
  if (input.haltAllTrading) {
    return "Execução totalmente pausada por proteção ou decisão operacional.";
  }
  if (input.licenseStatus === "REVOKED") {
    return "Licença revogada. Entre em contato com o suporte.";
  }
  if (canAcceptNewEntries(input)) {
    return "Licença ativa para novas entradas conforme seu plano.";
  }
  if (canManageOpenPositions(input)) {
    return "Novas entradas bloqueadas. Gestão de posições abertas mantida.";
  }
  return "Licença inativa. Ative sua assinatura para operar.";
}
