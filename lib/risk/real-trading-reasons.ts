/** Códigos legíveis para bloqueio de conta real (sem expor estratégia). */
export const REAL_TRADING_REASONS = {
  DISABLED: "REAL_TRADING_DISABLED",
  APPROVAL_REQUIRED: "REAL_TRADING_APPROVAL_REQUIRED",
  SNAPSHOT_REQUIRED: "REAL_TRADING_SNAPSHOT_REQUIRED",
  MARGIN_INSUFFICIENT: "REAL_TRADING_MARGIN_INSUFFICIENT",
  EXECUTOR_OFFLINE: "REAL_TRADING_EXECUTOR_OFFLINE",
  ACCOUNT_MISMATCH: "REAL_TRADING_ACCOUNT_MISMATCH",
  MAGIC_MISMATCH: "REAL_TRADING_MAGIC_MISMATCH",
  SYMBOL_MISMATCH: "REAL_TRADING_SYMBOL_MISMATCH",
  PROTECTION_NOT_CONFIRMED: "REAL_TRADING_PROTECTION_NOT_CONFIRMED",
  AUTO_DISPATCH_DISABLED: "REAL_TRADING_AUTO_DISPATCH_DISABLED",
  LICENSE_INVALID: "REAL_TRADING_LICENSE_INVALID",
  SUBSCRIPTION_INACTIVE: "REAL_TRADING_SUBSCRIPTION_INACTIVE",
  PREFLIGHT_FAILED: "REAL_TRADING_PREFLIGHT_FAILED",
} as const;

export type RealTradingReasonCode =
  (typeof REAL_TRADING_REASONS)[keyof typeof REAL_TRADING_REASONS];

export const REAL_TRADING_REASON_MESSAGES: Record<RealTradingReasonCode, string> = {
  REAL_TRADING_DISABLED: "Conta em modo REAL bloqueada pelo Real Trading Guard.",
  REAL_TRADING_APPROVAL_REQUIRED: "Conta real bloqueada: aprovação administrativa ausente ou inválida.",
  REAL_TRADING_SNAPSHOT_REQUIRED: "Snapshot pré-pregão (PRE_MARKET) do dia ausente.",
  REAL_TRADING_MARGIN_INSUFFICIENT: "Margem livre insuficiente para a operação.",
  REAL_TRADING_EXECUTOR_OFFLINE: "EA Executor offline ou sem heartbeat recente.",
  REAL_TRADING_ACCOUNT_MISMATCH: "Conta MT5 divergente da aprovação ou licença.",
  REAL_TRADING_MAGIC_MISMATCH: "MagicNumber divergente ou ausente.",
  REAL_TRADING_SYMBOL_MISMATCH: "Símbolo divergente da aprovação.",
  REAL_TRADING_PROTECTION_NOT_CONFIRMED:
    "Stop/take da ordem anterior não confirmados. Revisão administrativa necessária.",
  REAL_TRADING_AUTO_DISPATCH_DISABLED: "Dispatch automático desativado para conta real.",
  REAL_TRADING_LICENSE_INVALID: "Licença inválida ou suspensa para operação real.",
  REAL_TRADING_SUBSCRIPTION_INACTIVE: "Assinatura inativa para novas entradas em conta real.",
  REAL_TRADING_PREFLIGHT_FAILED: "Preflight de conta real falhou.",
};
