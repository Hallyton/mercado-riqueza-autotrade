import prisma from "@/lib/prisma";
import { MR_FIBO_D1_GUARD_CODE } from "@/lib/risk/autonomous-strategy-reasons";
import { tradeDateKeySaoPaulo } from "@/lib/risk/daily-financial-risk";

export async function listDailyFinancialRiskLimits(licenseId?: string) {
  return prisma.dailyFinancialRiskLimit.findMany({
    where: licenseId ? { licenseId } : undefined,
    include: {
      license: {
        select: {
          id: true,
          user: { select: { email: true, name: true } },
          mt5Account: { select: { login: true, server: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
}

export async function upsertDailyFinancialRiskLimit(input: {
  licenseId: string;
  accountLogin: string;
  accountServer: string;
  symbol: string;
  strategyCode?: string;
  enabled: boolean;
  dailyLossLimitBrl: number;
  includeOpenPnL: boolean;
  resetTimezone?: string;
  resetAtTime?: string;
}) {
  const strategyCode = input.strategyCode ?? MR_FIBO_D1_GUARD_CODE;
  const dailyLossLimitCents = Math.round(input.dailyLossLimitBrl * 100);

  return prisma.dailyFinancialRiskLimit.upsert({
    where: {
      licenseId_accountLogin_accountServer_strategyCode_symbol: {
        licenseId: input.licenseId,
        accountLogin: input.accountLogin.trim(),
        accountServer: input.accountServer.trim(),
        strategyCode,
        symbol: input.symbol.trim().toUpperCase(),
      },
    },
    create: {
      licenseId: input.licenseId,
      accountLogin: input.accountLogin.trim(),
      accountServer: input.accountServer.trim(),
      strategyCode,
      symbol: input.symbol.trim().toUpperCase(),
      enabled: input.enabled,
      dailyLossLimitCents,
      includeOpenPnL: input.includeOpenPnL,
      resetTimezone: input.resetTimezone ?? "America/Sao_Paulo",
      resetAtTime: input.resetAtTime ?? "00:00",
    },
    update: {
      enabled: input.enabled,
      dailyLossLimitCents,
      includeOpenPnL: input.includeOpenPnL,
      resetTimezone: input.resetTimezone ?? "America/Sao_Paulo",
      resetAtTime: input.resetAtTime ?? "00:00",
    },
  });
}

export async function getDailyRiskSnapshotForLicense(licenseId: string) {
  const tradeDate = tradeDateKeySaoPaulo();
  const limits = await prisma.dailyFinancialRiskLimit.findMany({
    where: { licenseId },
  });
  const states = await prisma.dailyFinancialRiskState.findMany({
    where: { licenseId, tradeDate },
  });
  return limits.map((limit) => {
    const state = states.find(
      (s) =>
        s.accountLogin === limit.accountLogin &&
        s.accountServer === limit.accountServer &&
        s.strategyCode === limit.strategyCode &&
        s.symbol === limit.symbol
    );
    return { limit, state };
  });
}

export async function listAutonomousStrategyDecisions(input?: {
  licenseId?: string;
  limit?: number;
}) {
  return prisma.autonomousStrategyDecision.findMany({
    where: input?.licenseId ? { licenseId: input.licenseId } : undefined,
    include: {
      license: {
        select: {
          user: { select: { email: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: input?.limit ?? 100,
  });
}
