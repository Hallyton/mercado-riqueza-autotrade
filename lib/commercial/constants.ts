/** Plano comercial oficial — AutoTrade Single Robot (R$ 300/mês). */
export const AUTOTRADE_SINGLE_ROBOT_PLAN_SLUG = "autotrade-single-robot";

/** Produto robô vinculado ao plano single robot. */
export const AUTOTRADE_ROBOT_PRODUCT_SLUG = "autotrade-single-robot";

/** Versão dos termos comerciais aceitos no cadastro. */
export const COMMERCIAL_TERMS_VERSION = "2026-05-27";

/** Limite desta fase: 1 robô por cliente. */
export const MAX_ROBOTS_CURRENT_PHASE = 1;

/** Estrutura futura: até 4 robôs por cliente. */
export const MAX_ROBOTS_FUTURE = 4;

/** Faixa de magicNumber gerada pelo backend/admin. */
export const MAGIC_NUMBER_MIN = 910001;
export const MAGIC_NUMBER_MAX = 910999;

/** Preço mensal por robô em centavos BRL. */
export const ROBOT_MONTHLY_PRICE_CENTS = 30000;

export const COMMERCIAL_SIGNUP_TERM_TYPES = [
  "COMMERCIAL_SUBSCRIPTION_TERMS",
  "RISK_DISCLAIMER",
  "NO_RETURN_GUARANTEE",
  "REAL_REQUIRES_ADMIN_APPROVAL",
  "BLACK_BOX_ACKNOWLEDGMENT",
] as const;

export type CommercialSignupTermType =
  (typeof COMMERCIAL_SIGNUP_TERM_TYPES)[number];

export const ROBOT_INSTANCE_STATUS_LABELS: Record<string, string> = {
  AWAITING_PAYMENT: "Aguardando pagamento",
  AWAITING_APPROVAL: "Aguardando aprovação",
  AWAITING_EA_ACTIVATION: "Aguardando ativação do EA",
  EA_ONLINE: "EA online",
  REAL_PENDING_VALIDATION: "Conta real pendente de validação",
  OPERATIONAL_CONTROLLED: "Operacional controlado",
  SUSPENDED: "Suspenso",
  BLOCKED: "Bloqueado",
};

export const ADMIN_PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pagamento pendente",
  CONFIRMED: "Pagamento confirmado",
  OVERDUE: "Pagamento em atraso",
};
