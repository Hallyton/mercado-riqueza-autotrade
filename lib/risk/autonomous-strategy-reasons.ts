export const MR_FIBO_D1_GUARD_CODE = "MR_FIBO_D1_GUARD";
export const MR_FIBO_D1_GUARD_VERSION = "1.0.0";
export const MR_FIBO_D1_GUARD_DISPLAY_NAME = "MR Fibo D1 Guard";

export const AUTONOMOUS_STRATEGY_REASON_CODES = [
  "STRATEGY_NOT_ENABLED_FOR_LICENSE",
  "AUTONOMOUS_STRATEGY_DISABLED",
  "AUTONOMOUS_STRATEGY_SITE_AUTH_REQUIRED",
  "DAILY_FINANCIAL_STOP_NOT_CONFIGURED",
  "DAILY_FINANCIAL_STOP_REACHED",
  "DAILY_FINANCIAL_STOP_WOULD_BE_EXCEEDED",
  "DAILY_RISK_STATE_STALE",
  "DAILY_RISK_REPORT_MISSING",
  "STRATEGY_DAILY_TRADE_LIMIT_REACHED",
  "STRATEGY_DAILY_SIDE_ALREADY_TRADED",
  "STRATEGY_REVERSAL_NOT_ALLOWED",
  "STRATEGY_SIGNAL_OUTSIDE_OPERATIONAL_WINDOW",
  "STRATEGY_PREVIOUS_D1_LEVELS_MISSING",
  "STRATEGY_MANAGEMENT_PLAN_INVALID",
] as const;

export type AutonomousStrategyReasonCode =
  (typeof AUTONOMOUS_STRATEGY_REASON_CODES)[number];

export const AUTONOMOUS_STRATEGY_REASON_MESSAGES: Record<
  AutonomousStrategyReasonCode,
  string
> = {
  STRATEGY_NOT_ENABLED_FOR_LICENSE:
    "Estratégia autônoma não habilitada para esta licença.",
  AUTONOMOUS_STRATEGY_DISABLED:
    "Estratégia autônoma desabilitada no servidor.",
  AUTONOMOUS_STRATEGY_SITE_AUTH_REQUIRED:
    "Autorização da plataforma obrigatória antes de operar.",
  DAILY_FINANCIAL_STOP_NOT_CONFIGURED:
    "Stop financeiro diário não configurado para esta licença.",
  DAILY_FINANCIAL_STOP_REACHED:
    "Stop financeiro diário atingido para esta licença.",
  DAILY_FINANCIAL_STOP_WOULD_BE_EXCEEDED:
    "Perda potencial do stop inicial excede saldo restante do limite diário.",
  DAILY_RISK_STATE_STALE:
    "Relatório de risco diário desatualizado.",
  DAILY_RISK_REPORT_MISSING:
    "Relatório de risco diário ausente.",
  STRATEGY_DAILY_TRADE_LIMIT_REACHED:
    "Limite diário de operações da estratégia atingido.",
  STRATEGY_DAILY_SIDE_ALREADY_TRADED:
    "Já houve operação neste lado no dia.",
  STRATEGY_REVERSAL_NOT_ALLOWED:
    "Reversão não permitida neste momento.",
  STRATEGY_SIGNAL_OUTSIDE_OPERATIONAL_WINDOW:
    "Sinal fora da janela operacional permitida.",
  STRATEGY_PREVIOUS_D1_LEVELS_MISSING:
    "Níveis D1 anteriores indisponíveis para validação.",
  STRATEGY_MANAGEMENT_PLAN_INVALID:
    "Plano de gestão planejado inválido.",
};

export function isAutonomousStrategyReasonCode(
  value: string | null | undefined
): value is AutonomousStrategyReasonCode {
  return (
    typeof value === "string" &&
    (AUTONOMOUS_STRATEGY_REASON_CODES as readonly string[]).includes(value)
  );
}
