import type { DailyFinancialRiskLimit } from "@prisma/client";
import { MR_FIBO_D1_GUARD_CODE } from "@/lib/risk/autonomous-strategy-reasons";
import {
  isMrFiboD1GuardStrategyAlias,
  normalizeFiboStrategyCode,
} from "@/lib/strategy/normalize-strategy-code";

export type FiboDailyRiskLimitResolution = {
  canonical: DailyFinancialRiskLimit | null;
  aliasLimits: DailyFinancialRiskLimit[];
  effective: DailyFinancialRiskLimit | null;
  strategyMismatch: boolean;
  mismatchStrategyCodes: string[];
};

export function resolveFiboDailyRiskLimit(
  limits: DailyFinancialRiskLimit[],
  input: {
    accountLogin: string;
    accountServer: string;
    symbol: string;
  }
): FiboDailyRiskLimitResolution {
  const login = input.accountLogin.trim();
  const server = input.accountServer.trim();
  const symbol = input.symbol.trim().toUpperCase();

  const matching = limits.filter(
    (limit) =>
      limit.accountLogin === login &&
      limit.accountServer === server &&
      limit.symbol === symbol
  );

  const canonical =
    matching.find((limit) => limit.strategyCode === MR_FIBO_D1_GUARD_CODE) ??
    null;

  const aliasLimits = matching.filter((limit) =>
    isMrFiboD1GuardStrategyAlias(limit.strategyCode)
  );

  const mismatchStrategyCodes = matching
    .filter(
      (limit) =>
        limit.strategyCode !== MR_FIBO_D1_GUARD_CODE &&
        !isMrFiboD1GuardStrategyAlias(limit.strategyCode)
    )
    .map((limit) => limit.strategyCode);

  const strategyMismatch = !canonical && aliasLimits.length > 0;
  const effective = canonical ?? aliasLimits[0] ?? null;

  return {
    canonical,
    aliasLimits,
    effective,
    strategyMismatch,
    mismatchStrategyCodes: [
      ...aliasLimits.map((limit) => limit.strategyCode),
      ...mismatchStrategyCodes,
    ],
  };
}

export function buildDailyRiskLinkageDetail(input: {
  resolution: FiboDailyRiskLimitResolution;
  expectedStrategyCode: string;
  accountLogin: string | null;
  accountServer: string | null;
  symbol: string | null;
}): string | null {
  const { resolution, expectedStrategyCode, accountLogin, accountServer, symbol } =
    input;

  if (resolution.strategyMismatch) {
    const alias = resolution.aliasLimits[0]?.strategyCode ?? "desconhecido";
    return `Stop diário não encontrado para ${expectedStrategyCode} nesta licença/conta/símbolo. Existe configuração com strategyCode diferente: ${alias}.`;
  }

  if (!resolution.effective) {
    return `Stop diário não encontrado para ${expectedStrategyCode} em ${accountLogin ?? "—"}@${accountServer ?? "—"} · ${symbol ?? "—"}.`;
  }

  if (
    resolution.mismatchStrategyCodes.length > 0 &&
    !resolution.canonical
  ) {
    return `Existe stop diário com código de estratégia não reconhecido: ${resolution.mismatchStrategyCodes.join(", ")}.`;
  }

  return null;
}

export function canonicalFiboStrategyCodeForSave(
  strategyCode: string | null | undefined
): string {
  return normalizeFiboStrategyCode(strategyCode);
}
