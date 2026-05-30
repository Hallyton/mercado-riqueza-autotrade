/** Códigos legíveis para gate de conta real (sem expor estratégia). */
export const REAL_TRADING_REASONS = {
  DISABLED: "REAL_TRADING_DISABLED",
  ENV_NOT_ENABLED: "REAL_TRADING_ENV_NOT_ENABLED",
  LICENSE_NOT_ALLOWLISTED: "REAL_TRADING_LICENSE_NOT_ALLOWLISTED",
  PAYMENT_NOT_ACTIVE: "REAL_TRADING_PAYMENT_NOT_ACTIVE",
  SUBSCRIPTION_NOT_ACTIVE: "REAL_TRADING_SUBSCRIPTION_NOT_ACTIVE",
  TERMS_NOT_ACCEPTED: "REAL_TRADING_TERMS_NOT_ACCEPTED",
  LICENSE_NOT_ACTIVE: "REAL_TRADING_LICENSE_NOT_ACTIVE",
  DEVICE_OFFLINE: "REAL_TRADING_DEVICE_OFFLINE",
  APPROVAL_REQUIRED: "REAL_TRADING_APPROVAL_REQUIRED",
  APPROVAL_NOT_ACTIVE: "REAL_TRADING_APPROVAL_NOT_ACTIVE",
  SNAPSHOT_REQUIRED: "REAL_TRADING_SNAPSHOT_REQUIRED",
  MARGIN_INSUFFICIENT: "REAL_TRADING_MARGIN_INSUFFICIENT",
  EXECUTOR_OFFLINE: "REAL_TRADING_EXECUTOR_OFFLINE",
  ACCOUNT_MISMATCH: "REAL_TRADING_ACCOUNT_MISMATCH",
  MAGIC_MISMATCH: "REAL_TRADING_MAGIC_MISMATCH",
  SYMBOL_MISMATCH: "REAL_TRADING_SYMBOL_MISMATCH",
  CONTRACT_LIMIT_EXCEEDED: "REAL_TRADING_CONTRACT_LIMIT_EXCEEDED",
  PROTECTION_NOT_CONFIRMED: "REAL_TRADING_PROTECTION_NOT_CONFIRMED",
  PREVIOUS_PROTECTION_FAILED: "REAL_TRADING_PREVIOUS_PROTECTION_FAILED",
  PROTECTION_PENDING: "REAL_TRADING_PROTECTION_PENDING",
  AUTO_DISPATCH_DISABLED: "REAL_TRADING_AUTO_DISPATCH_DISABLED",
  PREFLIGHT_FAILED: "REAL_TRADING_PREFLIGHT_FAILED",
  ALLOWED_BY_CONTROLLED_GATE: "REAL_TRADING_ALLOWED_BY_CONTROLLED_GATE",
  ALLOWED_BY_MANUAL_APPROVAL: "REAL_TRADING_ALLOWED_BY_MANUAL_APPROVAL",
} as const;

export type RealTradingReasonCode =
  (typeof REAL_TRADING_REASONS)[keyof typeof REAL_TRADING_REASONS];

export const REAL_TRADING_REASON_MESSAGES: Record<RealTradingReasonCode, string> = {
  REAL_TRADING_DISABLED:
    "Conta em modo REAL bloqueada pelo Real Trading Guard (default deny).",
  REAL_TRADING_ENV_NOT_ENABLED:
    "Conta real bloqueada: ENABLE_REAL_TRADING não está habilitado.",
  REAL_TRADING_LICENSE_NOT_ALLOWLISTED:
    "Conta real bloqueada: licença sem aprovação manual ativa nem allowlist técnica opcional.",
  REAL_TRADING_PAYMENT_NOT_ACTIVE:
    "Conta real bloqueada: pagamento/assinatura comercial não está em dia.",
  REAL_TRADING_SUBSCRIPTION_NOT_ACTIVE:
    "Conta real bloqueada: assinatura inativa ou suspensa.",
  REAL_TRADING_TERMS_NOT_ACCEPTED:
    "Conta real bloqueada: termos comerciais obrigatórios não aceitos.",
  REAL_TRADING_LICENSE_NOT_ACTIVE:
    "Conta real bloqueada: licença inválida ou suspensa.",
  REAL_TRADING_DEVICE_OFFLINE:
    "Conta real bloqueada: dispositivo EA não autorizado ou sem heartbeat recente.",
  REAL_TRADING_APPROVAL_REQUIRED:
    "Conta real bloqueada: aprovação administrativa ausente.",
  REAL_TRADING_APPROVAL_NOT_ACTIVE:
    "Conta real bloqueada: aprovação real não está APPROVED com allowReal.",
  REAL_TRADING_SNAPSHOT_REQUIRED:
    "Snapshot pré-pregão (PRE_MARKET) do dia ausente para conta real.",
  REAL_TRADING_MARGIN_INSUFFICIENT:
    "Margem livre insuficiente para a operação real.",
  REAL_TRADING_EXECUTOR_OFFLINE:
    "EA Executor offline ou sem heartbeat recente.",
  REAL_TRADING_ACCOUNT_MISMATCH:
    "Conta MT5 divergente da aprovação ou licença.",
  REAL_TRADING_MAGIC_MISMATCH:
    "MagicNumber divergente ou ausente.",
  REAL_TRADING_SYMBOL_MISMATCH:
    "Símbolo divergente da aprovação.",
  REAL_TRADING_CONTRACT_LIMIT_EXCEEDED:
    "Quantidade de contratos excede o limite aprovado.",
  REAL_TRADING_PROTECTION_NOT_CONFIRMED:
    "Stop/take não confirmados. Nova ordem bloqueada até revisão.",
  REAL_TRADING_PREVIOUS_PROTECTION_FAILED:
    "Proteção anterior falhou. Nova ordem bloqueada.",
  REAL_TRADING_PROTECTION_PENDING:
    "Proteção stop/take pendente. Nova ordem bloqueada.",
  REAL_TRADING_AUTO_DISPATCH_DISABLED:
    "Dispatch automático desativado para conta real.",
  REAL_TRADING_PREFLIGHT_FAILED: "Preflight de conta real falhou.",
  REAL_TRADING_ALLOWED_BY_CONTROLLED_GATE:
    "REAL liberado somente por gate controlado — todos os critérios OK.",
  REAL_TRADING_ALLOWED_BY_MANUAL_APPROVAL:
    "REAL permitido para preflight: master switch ativo e aprovação manual APPROVED.",
};
