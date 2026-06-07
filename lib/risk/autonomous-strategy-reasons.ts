export const MR_FIBO_D1_GUARD_CODE = "MR_FIBO_D1_GUARD";
export const MR_FIBO_D1_GUARD_VERSION = "2.0.0";
export const MR_FIBO_D1_GUARD_DISPLAY_NAME = "MR Fibo D1 Guard";

export const CAN_TRADE_REASON_CODES = [
  "OK",
  "LICENSE_NOT_ACTIVE",
  "SUBSCRIPTION_NOT_ACTIVE",
  "PAYMENT_NOT_CONFIRMED",
  "ROBOT_INSTANCE_NOT_ACTIVE",
  "STRATEGY_NOT_ENABLED_FOR_LICENSE",
  "AUTONOMOUS_STRATEGY_DISABLED",
  "DEVICE_NOT_ACTIVE",
  "DEVICE_ACCOUNT_MISMATCH",
  "TRADE_MODE_NOT_ALLOWED",
  "SYMBOL_MISMATCH",
  "MAGIC_MISMATCH",
  "STRATEGY_CONFIG_MISSING",
  "STRATEGY_CONFIG_HASH_MISMATCH",
  "DAILY_FINANCIAL_STOP_NOT_CONFIGURED",
  "DAILY_FINANCIAL_STOP_STRATEGY_MISMATCH",
  "DAILY_FINANCIAL_STOP_REACHED",
  "DAILY_FINANCIAL_STOP_WOULD_BE_EXCEEDED",
  "DAILY_RISK_REPORT_MISSING",
  "DAILY_RISK_REPORT_STALE",
  "DAILY_RISK_REPORT_DATE_MISMATCH",
  "REAL_TRADING_NOT_ENABLED",
  "EA_OFFLINE",
  "EA_OFFLINE_NO_RECENT_ACTIVITY",
  "EA_LIVENESS_CHECKING",
  "EA_LIVENESS_UNRESPONSIVE",
  "EA_ACTIVITY_DEGRADED",
  "EA_HEARTBEAT_STALE_BUT_ACTIVITY_RECENT",
  "EA_CONFIG_OUTDATED",
  "EA_AUTOTRADING_DISABLED",
  "EA_REAL_ORDERS_DISABLED",
  "EA_TERMINAL_DISCONNECTED",
  "EA_SYMBOL_NOT_READY",
  "LOT_TOTAL_EXCEEDS_MAX_CONTRACTS",
  "UNKNOWN_BLOCK",
  "ADMIN_OPERATION_PAUSED",
] as const;

export type CanTradeReasonCode = (typeof CAN_TRADE_REASON_CODES)[number];

export const CAN_TRADE_REASON_MESSAGES: Record<CanTradeReasonCode, string> = {
  OK: "Autorizado a operar.",
  LICENSE_NOT_ACTIVE: "Licença inativa ou suspensa.",
  SUBSCRIPTION_NOT_ACTIVE: "Assinatura inativa.",
  PAYMENT_NOT_CONFIRMED: "Pagamento não confirmado.",
  ROBOT_INSTANCE_NOT_ACTIVE: "RobotInstance inativo ou aguardando pagamento.",
  STRATEGY_NOT_ENABLED_FOR_LICENSE:
    "Estratégia MR Fibo D1 Guard não habilitada na licença.",
  AUTONOMOUS_STRATEGY_DISABLED:
    "Estratégia autônoma desabilitada no servidor (ENABLE_AUTONOMOUS_STRATEGY).",
  DEVICE_NOT_ACTIVE: "Device inativo ou revogado.",
  DEVICE_ACCOUNT_MISMATCH: "Conta MT5 do EA não confere com a licença.",
  TRADE_MODE_NOT_ALLOWED: "Modo de operação não permitido para esta licença.",
  SYMBOL_MISMATCH: "Símbolo do EA diverge do esperado.",
  MAGIC_MISMATCH: "MagicNumber diverge do RobotInstance.",
  STRATEGY_CONFIG_MISSING: "Nenhuma configuração publicada para a estratégia.",
  STRATEGY_CONFIG_HASH_MISMATCH:
    "Hash da config no EA difere da versão publicada no site.",
  DAILY_FINANCIAL_STOP_NOT_CONFIGURED: "Stop financeiro diário não configurado.",
  DAILY_FINANCIAL_STOP_STRATEGY_MISMATCH:
    "Existe stop diário configurado, mas para outro código de estratégia.",
  DAILY_FINANCIAL_STOP_REACHED: "Stop financeiro diário atingido.",
  DAILY_FINANCIAL_STOP_WOULD_BE_EXCEEDED:
    "Risco estimado excede a perda restante do stop diário.",
  DAILY_RISK_REPORT_MISSING:
    "Stop diário configurado, mas o EA ainda não enviou o relatório de PnL/risco do dia.",
  DAILY_RISK_REPORT_STALE:
    "Stop diário configurado, mas o relatório de risco diário está desatualizado.",
  DAILY_RISK_REPORT_DATE_MISMATCH:
    "Stop diário configurado, mas o relatório foi salvo com tradeDate diferente do dia operacional.",
  REAL_TRADING_NOT_ENABLED: "Conta REAL não habilitada no servidor.",
  EA_OFFLINE: "EA offline ou sem heartbeat recente.",
  EA_OFFLINE_NO_RECENT_ACTIVITY:
    "Nenhuma atividade autenticada recente do EA.",
  EA_LIVENESS_CHECKING:
    "Verificação de presença do EA em andamento — aguardando resposta.",
  EA_LIVENESS_UNRESPONSIVE:
    "Health check expirou sem resposta do EA.",
  EA_ACTIVITY_DEGRADED:
    "EA com atividade recente, porém heartbeat específico atrasado.",
  EA_HEARTBEAT_STALE_BUT_ACTIVITY_RECENT:
    "Heartbeat atrasado, mas outras rotinas do EA comunicaram recentemente.",
  EA_CONFIG_OUTDATED: "EA com config desatualizada — aguardar sync.",
  EA_AUTOTRADING_DISABLED: "AutoTrading desligado no MetaTrader.",
  EA_REAL_ORDERS_DISABLED: "EA em modo que não envia ordens reais.",
  EA_TERMINAL_DISCONNECTED: "Terminal MT5 desconectado.",
  EA_SYMBOL_NOT_READY: "Símbolo sem tick recente.",
  LOT_TOTAL_EXCEEDS_MAX_CONTRACTS:
    "Configuração da estratégia usa mais contratos do que a licença permite.",
  UNKNOWN_BLOCK: "Bloqueio operacional não classificado.",
  ADMIN_OPERATION_PAUSED:
    "Novas entradas pausadas pelo centro de operações administrativo.",
};

export const CAN_TRADE_ACTION_HINTS: Partial<Record<CanTradeReasonCode, string>> = {
  STRATEGY_CONFIG_MISSING: "Publicar configuração da estratégia",
  STRATEGY_NOT_ENABLED_FOR_LICENSE: "Habilitar MR Fibo D1 Guard na licença",
  DAILY_FINANCIAL_STOP_NOT_CONFIGURED: "Configurar stop financeiro diário",
  DAILY_FINANCIAL_STOP_STRATEGY_MISMATCH:
    "Atualizar configuração para MR_FIBO_D1_GUARD",
  DAILY_RISK_REPORT_MISSING:
    "Verificar EA online e POST /api/v1/ea/daily-risk/report",
  DAILY_RISK_REPORT_STALE:
    "Aguardar novo report do EA ou verificar heartbeat",
  DAILY_RISK_REPORT_DATE_MISMATCH:
    "Verificar tradeDate do EA vs America/Sao_Paulo e reenviar daily-risk/report",
  EA_OFFLINE: "Verificar VPS/MT5",
  EA_OFFLINE_NO_RECENT_ACTIVITY: "Verificar VPS/MT5 e rotinas do EA",
  EA_LIVENESS_CHECKING: "Aguardar health check ou usar Verificar agora",
  EA_LIVENESS_UNRESPONSIVE: "Verificar VPS/MT5 e polling de comandos",
  EA_AUTOTRADING_DISABLED: "Ativar AutoTrading",
  EA_REAL_ORDERS_DISABLED: "Desativar modo não envia ordens reais",
  STRATEGY_CONFIG_HASH_MISMATCH: "Recompilar/atualizar EA ou republicar config",
  DAILY_FINANCIAL_STOP_WOULD_BE_EXCEEDED:
    "Reduzir contratos ou aumentar stop financeiro",
  LOT_TOTAL_EXCEEDS_MAX_CONTRACTS:
    "Ajustar limite operacional ou reduzir contratos",
  ADMIN_OPERATION_PAUSED:
    "Retomar operações no centro de operações ou aguardar fim da pausa admin",
};

export const AUTONOMOUS_STRATEGY_REASON_CODES = [
  "STRATEGY_NOT_ENABLED_FOR_LICENSE",
  "AUTONOMOUS_STRATEGY_DISABLED",
  "AUTONOMOUS_STRATEGY_SITE_AUTH_REQUIRED",
  "DAILY_FINANCIAL_STOP_NOT_CONFIGURED",
  "DAILY_FINANCIAL_STOP_REACHED",
  "DAILY_FINANCIAL_STOP_WOULD_BE_EXCEEDED",
  "DAILY_RISK_STATE_STALE",
  "DAILY_RISK_REPORT_MISSING",
  "DAILY_RISK_REPORT_STALE",
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
  DAILY_RISK_REPORT_STALE:
    "Relatório de risco diário desatualizado.",
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
