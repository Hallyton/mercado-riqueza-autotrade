export const BULK_ELIGIBILITY_REASON_CODES = [
  "USER_NOT_ACTIVE",
  "SUBSCRIPTION_NOT_ACTIVE",
  "PAYMENT_NOT_CONFIRMED",
  "LICENSE_NOT_ACTIVE",
  "PLAN_NOT_COMPATIBLE",
  "ROBOT_INSTANCE_MISSING",
  "MT5_ACCOUNT_NOT_LINKED",
  "EXPECTED_TRADE_MODE_NOT_REAL",
  "EXPECTED_SYMBOL_MISMATCH",
  "EXPECTED_MAGIC_MISSING",
  "DEVICE_NOT_ACTIVE",
  "DEVICE_NOT_REAL",
  "HEARTBEAT_STALE",
  "EA_OFFLINE",
  "REAL_APPROVAL_MISSING",
  "REAL_APPROVAL_MISMATCH",
  "PRE_MARKET_MISSING",
  "MARGIN_INSUFFICIENT",
  "PROTECTION_FAILED_BLOCKING",
  "OPEN_REAL_INSTRUCTION_EXISTS",
  "OPEN_POSITION_OR_PENDING_ORDER_EXISTS",
  "REQUESTED_CONTRACTS_EXCEEDS_APPROVAL",
  "SYMBOL_MISMATCH",
  "MAGIC_MISMATCH",
  "MANAGEMENT_PLAN_INVALID",
] as const;

export type BulkEligibilityReasonCode = (typeof BULK_ELIGIBILITY_REASON_CODES)[number];

export const BULK_ELIGIBILITY_REASON_MESSAGES: Record<BulkEligibilityReasonCode, string> = {
  USER_NOT_ACTIVE: "Usuário inativo ou bloqueado.",
  SUBSCRIPTION_NOT_ACTIVE: "Assinatura inativa ou suspensa.",
  PAYMENT_NOT_CONFIRMED: "Pagamento não confirmado ou billing em atraso.",
  LICENSE_NOT_ACTIVE: "Licença inativa, suspensa ou revogada.",
  PLAN_NOT_COMPATIBLE: "Plano não compatível com operação REAL.",
  ROBOT_INSTANCE_MISSING: "RobotInstance ausente ou não elegível.",
  MT5_ACCOUNT_NOT_LINKED: "Conta MT5 não vinculada à licença.",
  EXPECTED_TRADE_MODE_NOT_REAL: "Modo operacional esperado não é REAL.",
  EXPECTED_SYMBOL_MISMATCH: "Símbolo esperado da licença diverge do lote.",
  EXPECTED_MAGIC_MISSING: "MagicNumber esperado não configurado na licença.",
  DEVICE_NOT_ACTIVE: "Device não está ACTIVE.",
  DEVICE_NOT_REAL: "Device não está em tradeMode REAL.",
  HEARTBEAT_STALE: "Heartbeat ausente ou expirado.",
  EA_OFFLINE: "EA executor offline.",
  REAL_APPROVAL_MISSING: "RealTradingApproval APPROVED ausente.",
  REAL_APPROVAL_MISMATCH: "Approval não compatível com conta/símbolo/magic/contratos.",
  PRE_MARKET_MISSING: "Snapshot PRE_MARKET REAL do dia ausente.",
  MARGIN_INSUFFICIENT: "Margem livre insuficiente.",
  PROTECTION_FAILED_BLOCKING: "Falha de proteção bloqueante pendente.",
  OPEN_REAL_INSTRUCTION_EXISTS: "Instruction REAL_MANUAL aberta não finalizada.",
  OPEN_POSITION_OR_PENDING_ORDER_EXISTS:
    "Posição aberta ou ordem pendente no broker para o símbolo/magic.",
  REQUESTED_CONTRACTS_EXCEEDS_APPROVAL:
    "Contratos solicitados excedem maxContracts aprovado.",
  SYMBOL_MISMATCH: "Símbolo diverge do approval.",
  MAGIC_MISMATCH: "MagicNumber diverge do approval.",
  MANAGEMENT_PLAN_INVALID: "Plano de gestão inválido para a quantidade solicitada.",
};

export const BULK_ELIGIBILITY_ACTION_HINTS: Record<BulkEligibilityReasonCode, string> = {
  USER_NOT_ACTIVE: "Ativar usuário.",
  SUBSCRIPTION_NOT_ACTIVE: "Regularizar assinatura.",
  PAYMENT_NOT_CONFIRMED: "Confirmar pagamento.",
  LICENSE_NOT_ACTIVE: "Ativar licença.",
  PLAN_NOT_COMPATIBLE: "Ajustar plano ou RobotInstance.",
  ROBOT_INSTANCE_MISSING: "Criar/vincular RobotInstance.",
  MT5_ACCOUNT_NOT_LINKED: "Vincular conta MT5.",
  EXPECTED_TRADE_MODE_NOT_REAL: "Configurar modo REAL.",
  EXPECTED_SYMBOL_MISMATCH: "Ajustar symbol/magic/approval.",
  EXPECTED_MAGIC_MISSING: "Ajustar symbol/magic/approval.",
  DEVICE_NOT_ACTIVE: "Ativar EA no MT5.",
  DEVICE_NOT_REAL: "Configurar modo REAL.",
  HEARTBEAT_STALE: "Reativar EA no MT5 e rodar novo preview.",
  EA_OFFLINE: "Ativar EA no MT5.",
  REAL_APPROVAL_MISSING: "Criar RealTradingApproval.",
  REAL_APPROVAL_MISMATCH: "Ajustar symbol/magic/approval.",
  PRE_MARKET_MISSING: "Gerar PRE_MARKET.",
  MARGIN_INSUFFICIENT: "Regularizar margem.",
  PROTECTION_FAILED_BLOCKING: "Resolver PROTECTION_FAILED.",
  OPEN_REAL_INSTRUCTION_EXISTS: "Encerrar/anular instruction aberta.",
  OPEN_POSITION_OR_PENDING_ORDER_EXISTS:
    "Aguardar fechamento de posição/ordem ou regularizar exposição.",
  REQUESTED_CONTRACTS_EXCEEDS_APPROVAL: "Ajustar symbol/magic/approval.",
  SYMBOL_MISMATCH: "Ajustar symbol/magic/approval.",
  MAGIC_MISMATCH: "Ajustar symbol/magic/approval.",
  MANAGEMENT_PLAN_INVALID: "Corrigir plano de gestão.",
};

export type BulkRegularizationLinks = {
  userId?: string;
  licenseId?: string;
  approvalId?: string;
  accountSnapshotId?: string;
  instructionId?: string;
  preflightId?: string;
};

export function buildBulkRegularizationLinks(input: BulkRegularizationLinks) {
  return {
    user: input.userId ? `/admin/users/${input.userId}` : null,
    license: input.licenseId ? `/admin/licenses/${input.licenseId}` : null,
    approvals: "/admin/real-trading/approvals",
    approval: input.approvalId
      ? `/admin/real-trading/approvals/${input.approvalId}`
      : "/admin/real-trading/approvals",
    snapshots: "/admin/real-trading/snapshots",
    snapshot: "/admin/real-trading/snapshots",
    protection: "/admin/real-trading/protection",
    instruction: input.instructionId
      ? `/admin/real-trading/instructions/${input.instructionId}`
      : null,
    preflights: "/admin/real-trading/preflights",
    preflight: "/admin/real-trading/preflights",
  };
}

export function isBulkEligibilityReasonCode(
  value: string | null | undefined
): value is BulkEligibilityReasonCode {
  return (
    typeof value === "string" &&
    (BULK_ELIGIBILITY_REASON_CODES as readonly string[]).includes(value)
  );
}
