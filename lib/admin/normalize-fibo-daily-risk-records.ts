import prisma from "@/lib/prisma";
import { MR_FIBO_D1_GUARD_CODE } from "@/lib/risk/autonomous-strategy-reasons";
import { isMrFiboD1GuardStrategyAlias } from "@/lib/strategy/normalize-strategy-code";

export type NormalizeFiboDailyRiskResult = {
  limitsUpdated: number;
  limitsDeleted: number;
  statesUpdated: number;
};

/**
 * Normaliza strategyCode alias → MR_FIBO_D1_GUARD em DailyFinancialRiskLimit/State.
 * Escopo opcional por licenseId. Idempotente.
 */
export async function normalizeFiboDailyRiskStrategyCodes(input?: {
  licenseId?: string;
}): Promise<NormalizeFiboDailyRiskResult> {
  const limits = await prisma.dailyFinancialRiskLimit.findMany({
    where: input?.licenseId ? { licenseId: input.licenseId } : undefined,
  });

  let limitsUpdated = 0;
  let limitsDeleted = 0;
  let statesUpdated = 0;

  for (const limit of limits) {
    if (!isMrFiboD1GuardStrategyAlias(limit.strategyCode)) continue;

    const canonical = await prisma.dailyFinancialRiskLimit.findUnique({
      where: {
        licenseId_accountLogin_accountServer_strategyCode_symbol: {
          licenseId: limit.licenseId,
          accountLogin: limit.accountLogin,
          accountServer: limit.accountServer,
          strategyCode: MR_FIBO_D1_GUARD_CODE,
          symbol: limit.symbol,
        },
      },
    });

    const states = await prisma.dailyFinancialRiskState.updateMany({
      where: {
        licenseId: limit.licenseId,
        accountLogin: limit.accountLogin,
        accountServer: limit.accountServer,
        strategyCode: limit.strategyCode,
        symbol: limit.symbol,
      },
      data: { strategyCode: MR_FIBO_D1_GUARD_CODE },
    });
    statesUpdated += states.count;

    if (canonical) {
      await prisma.dailyFinancialRiskLimit.delete({ where: { id: limit.id } });
      limitsDeleted++;
      continue;
    }

    await prisma.dailyFinancialRiskLimit.update({
      where: { id: limit.id },
      data: { strategyCode: MR_FIBO_D1_GUARD_CODE },
    });
    limitsUpdated++;
  }

  return { limitsUpdated, limitsDeleted, statesUpdated };
}
