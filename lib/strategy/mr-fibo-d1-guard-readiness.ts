import type { MrFiboD1GuardConfig } from "@/lib/strategy/mr-fibo-d1-guard-config";
import { validateMrFiboD1GuardConfigWithContext } from "@/lib/strategy/mr-fibo-d1-guard-config";

export const LOT_TOTAL_EXCEEDS_MAX_CONTRACTS = "LOT_TOTAL_EXCEEDS_MAX_CONTRACTS";
export const ESTIMATED_RISK_EXCEEDS_DAILY_STOP = "ESTIMATED_RISK_EXCEEDS_DAILY_STOP";
export const DAILY_FINANCIAL_STOP_NOT_CONFIGURED = "DAILY_FINANCIAL_STOP_NOT_CONFIGURED";

export type StrategyConfigIssueCode =
  | typeof LOT_TOTAL_EXCEEDS_MAX_CONTRACTS
  | typeof ESTIMATED_RISK_EXCEEDS_DAILY_STOP
  | typeof DAILY_FINANCIAL_STOP_NOT_CONFIGURED
  | "INVALID_CONFIG";

export type StrategyConfigIssue = {
  code: StrategyConfigIssueCode;
  message: string;
  actionHint: string;
  blocksPublish: boolean;
};

export type EstimatedStopRisk = {
  contracts: number;
  stopPoints: number;
  pointValueBrl: number | null;
  estimatedRiskBrl: number | null;
  dailyLimitBrl: number | null;
  remainingLossBrl: number | null;
  dailyRiskStatus: "OK" | "EXCEEDS_DAILY_STOP" | "NOT_CONFIGURED" | "UNKNOWN";
};

export type ContractLimitSummary = {
  approvedMaxContracts: number;
  configuredContracts: number;
  exceedsLimit: boolean;
  contractsToRelease: number;
  publishBlocked: boolean;
};

export type StrategyConfigReadinessContext = {
  maxContracts: number;
  pointValueBrl?: number | null;
  dailyLossLimitCents?: number | null;
  dailyRiskEnabled?: boolean;
  remainingLossBrl?: number | null;
  requiresDailyFinancialStop?: boolean;
};

export function computeEstimatedStopRiskBrl(input: {
  contracts: number;
  stopPoints: number;
  pointValueBrl: number | null | undefined;
}): number | null {
  if (
    input.contracts <= 0 ||
    input.stopPoints <= 0 ||
    input.pointValueBrl == null ||
    input.pointValueBrl <= 0
  ) {
    return null;
  }
  return input.contracts * input.stopPoints * input.pointValueBrl;
}

export function applyLoteTotalToApprovedMax(
  config: MrFiboD1GuardConfig,
  maxContracts: number
): MrFiboD1GuardConfig {
  return {
    ...config,
    risk: {
      ...config.risk,
      loteTotal: maxContracts,
    },
  };
}

export function analyzeStrategyConfigReadiness(
  config: MrFiboD1GuardConfig,
  ctx: StrategyConfigReadinessContext
): {
  issues: StrategyConfigIssue[];
  estimatedRisk: EstimatedStopRisk;
  contractLimit: ContractLimitSummary;
  canPublish: boolean;
  schemaValid: boolean;
} {
  const issues: StrategyConfigIssue[] = [];
  const configuredContracts = config.risk.loteTotal;
  const approvedMaxContracts = ctx.maxContracts;
  const exceedsLimit = configuredContracts > approvedMaxContracts;
  const contractsToRelease = exceedsLimit
    ? configuredContracts - approvedMaxContracts
    : 0;

  if (exceedsLimit) {
    issues.push({
      code: LOT_TOTAL_EXCEEDS_MAX_CONTRACTS,
      message:
        `A estratégia MR Fibo D1 Guard está configurada para operar ${configuredContracts} contratos, ` +
        `mas esta licença permite apenas ${approvedMaxContracts} contrato(s). ` +
        `Para publicar esta configuração, ajuste o limite operacional da licença/aprovação para pelo menos ` +
        `${configuredContracts} contratos ou reduza o loteTotal da estratégia.`,
      actionHint:
        "Ajuste o limite operacional na aprovação/RobotInstance ou reduza loteTotal.",
      blocksPublish: true,
    });
  }

  const estimatedRiskBrl = computeEstimatedStopRiskBrl({
    contracts: configuredContracts,
    stopPoints: config.risk.stopPontos,
    pointValueBrl: ctx.pointValueBrl,
  });

  let dailyRiskStatus: EstimatedStopRisk["dailyRiskStatus"] = "UNKNOWN";
  const dailyLimitBrl =
    ctx.dailyLossLimitCents != null ? ctx.dailyLossLimitCents / 100 : null;

  if (ctx.requiresDailyFinancialStop && !ctx.dailyRiskEnabled) {
    dailyRiskStatus = "NOT_CONFIGURED";
    issues.push({
      code: DAILY_FINANCIAL_STOP_NOT_CONFIGURED,
      message: "Stop financeiro diário não configurado para esta licença.",
      actionHint: "Configurar stop financeiro diário",
      blocksPublish: true,
    });
  } else if (
    estimatedRiskBrl != null &&
    ctx.remainingLossBrl != null &&
    estimatedRiskBrl > ctx.remainingLossBrl
  ) {
    dailyRiskStatus = "EXCEEDS_DAILY_STOP";
    issues.push({
      code: ESTIMATED_RISK_EXCEEDS_DAILY_STOP,
      message: `Risco estimado (R$ ${estimatedRiskBrl.toFixed(2)}) excede a perda restante do stop diário (R$ ${ctx.remainingLossBrl.toFixed(2)}).`,
      actionHint: "Reduzir contratos ou aumentar stop financeiro",
      blocksPublish: true,
    });
  } else if (ctx.dailyRiskEnabled) {
    dailyRiskStatus = "OK";
  }

  const validated = validateMrFiboD1GuardConfigWithContext(config, {
    maxContracts: ctx.maxContracts,
    dailyLossLimitCents: ctx.dailyLossLimitCents,
    pointValueBrl: ctx.pointValueBrl,
  });

  if (!validated.success) {
    const schemaMessages = validated.error.issues
      .filter(
        (issue) =>
          !(
            exceedsLimit &&
            issue.path.join(".") === "risk.loteTotal"
          )
      )
      .map((issue) => issue.message);

    if (schemaMessages.length > 0) {
      issues.push({
        code: "INVALID_CONFIG",
        message: schemaMessages.join("; "),
        actionHint: "Corrija os campos inválidos da configuração.",
        blocksPublish: true,
      });
    }
  }

  const publishBlocked = issues.some((i) => i.blocksPublish) || !validated.success;

  return {
    issues,
    estimatedRisk: {
      contracts: configuredContracts,
      stopPoints: config.risk.stopPontos,
      pointValueBrl: ctx.pointValueBrl ?? null,
      estimatedRiskBrl,
      dailyLimitBrl,
      remainingLossBrl: ctx.remainingLossBrl ?? null,
      dailyRiskStatus,
    },
    contractLimit: {
      approvedMaxContracts,
      configuredContracts,
      exceedsLimit,
      contractsToRelease,
      publishBlocked,
    },
    canPublish: !publishBlocked,
    schemaValid: validated.success,
  };
}
