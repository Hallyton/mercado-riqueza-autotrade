import { DailyFinancialRiskStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { MR_FIBO_D1_GUARD_CODE } from "@/lib/risk/autonomous-strategy-reasons";
import { resolveFiboDailyRiskLimit } from "@/lib/admin/daily-risk-limit-resolver";
import { normalizeFiboStrategyCode } from "@/lib/strategy/normalize-strategy-code";

const DAILY_RISK_STALE_MS = 20 * 60 * 1000;

export type DailyRiskSnapshot = {
  enabled: boolean;
  limitCents: number;
  currentRealizedPnlCents: number;
  openPnlCents: number;
  totalPnlCents: number;
  remainingLossCents: number;
  status: DailyFinancialRiskStatus;
  tradeDate: string;
  lastUpdatedAt: string | null;
};

export function tradeDateKeySaoPaulo(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function getInstrumentCentsPerPoint(symbol: string): Promise<number | null> {
  const normalized = symbol.trim().toUpperCase();
  const row = await prisma.instrumentPointValue.findUnique({
    where: { symbol: normalized },
  });
  if (row) return row.centsPerPointPerContract;

  if (normalized.startsWith("WDO")) {
    const fallback = await prisma.instrumentPointValue.findUnique({
      where: { symbol: "WDO" },
    });
    return fallback?.centsPerPointPerContract ?? null;
  }
  return null;
}

export function computeTotalPnlCents(input: {
  realizedPnlCents: number;
  openPnlCents: number;
  includeOpenPnL: boolean;
}): number {
  return input.includeOpenPnL
    ? input.realizedPnlCents + input.openPnlCents
    : input.realizedPnlCents;
}

export function evaluateDailyRiskStatus(input: {
  totalPnlCents: number;
  limitCents: number;
}): { status: DailyFinancialRiskStatus; remainingLossCents: number } {
  const remainingLossCents = Math.max(0, input.limitCents + input.totalPnlCents);
  if (input.totalPnlCents <= -input.limitCents) {
    return { status: DailyFinancialRiskStatus.BLOCKED, remainingLossCents: 0 };
  }
  if (remainingLossCents <= Math.floor(input.limitCents * 0.2)) {
    return { status: DailyFinancialRiskStatus.WARNING, remainingLossCents };
  }
  return { status: DailyFinancialRiskStatus.OK, remainingLossCents };
}

export async function upsertDailyFinancialRiskState(input: {
  licenseId: string;
  accountLogin: string;
  accountServer: string;
  strategyCode: string;
  symbol: string;
  tradeDate: string;
  realizedPnlCents: number;
  openPnlCents: number;
  limitCents: number;
  includeOpenPnL: boolean;
}) {
  const totalPnlCents = computeTotalPnlCents({
    realizedPnlCents: input.realizedPnlCents,
    openPnlCents: input.openPnlCents,
    includeOpenPnL: input.includeOpenPnL,
  });
  const { status, remainingLossCents } = evaluateDailyRiskStatus({
    totalPnlCents,
    limitCents: input.limitCents,
  });
  const now = new Date();

  return prisma.dailyFinancialRiskState.upsert({
    where: {
      licenseId_accountLogin_accountServer_strategyCode_symbol_tradeDate: {
        licenseId: input.licenseId,
        accountLogin: input.accountLogin.trim(),
        accountServer: input.accountServer.trim(),
        strategyCode: input.strategyCode,
        symbol: input.symbol.trim().toUpperCase(),
        tradeDate: input.tradeDate,
      },
    },
    create: {
      licenseId: input.licenseId,
      accountLogin: input.accountLogin.trim(),
      accountServer: input.accountServer.trim(),
      strategyCode: input.strategyCode,
      symbol: input.symbol.trim().toUpperCase(),
      tradeDate: input.tradeDate,
      realizedPnlCents: input.realizedPnlCents,
      openPnlCents: input.openPnlCents,
      totalPnlCents,
      limitCents: input.limitCents,
      remainingLossCents,
      status,
      lastUpdatedAt: now,
    },
    update: {
      realizedPnlCents: input.realizedPnlCents,
      openPnlCents: input.openPnlCents,
      totalPnlCents,
      limitCents: input.limitCents,
      remainingLossCents,
      status,
      lastUpdatedAt: now,
    },
  });
}

export async function loadDailyRiskContext(input: {
  licenseId: string;
  accountLogin: string;
  accountServer: string;
  strategyCode: string;
  symbol: string;
  tradeDate?: string;
}): Promise<{
  limit: Awaited<ReturnType<typeof prisma.dailyFinancialRiskLimit.findUnique>> | null;
  state: Awaited<ReturnType<typeof prisma.dailyFinancialRiskState.findUnique>> | null;
  snapshot: DailyRiskSnapshot | null;
}> {
  const tradeDate = input.tradeDate ?? tradeDateKeySaoPaulo();
  const login = input.accountLogin.trim();
  const server = input.accountServer.trim();
  const symbol = input.symbol.trim().toUpperCase();
  const strategyCode = normalizeFiboStrategyCode(input.strategyCode);

  let limit = await prisma.dailyFinancialRiskLimit.findUnique({
    where: {
      licenseId_accountLogin_accountServer_strategyCode_symbol: {
        licenseId: input.licenseId,
        accountLogin: login,
        accountServer: server,
        strategyCode,
        symbol,
      },
    },
  });

  if (!limit && strategyCode === MR_FIBO_D1_GUARD_CODE) {
    const siblings = await prisma.dailyFinancialRiskLimit.findMany({
      where: {
        licenseId: input.licenseId,
        accountLogin: login,
        accountServer: server,
        symbol,
      },
    });
    limit = resolveFiboDailyRiskLimit(siblings, {
      accountLogin: login,
      accountServer: server,
      symbol,
    }).effective;
  }

  const state = limit
    ? await prisma.dailyFinancialRiskState.findUnique({
        where: {
          licenseId_accountLogin_accountServer_strategyCode_symbol_tradeDate: {
            licenseId: input.licenseId,
            accountLogin: login,
            accountServer: server,
            strategyCode: limit.strategyCode,
            symbol,
            tradeDate,
          },
        },
      })
    : null;

  if (!limit?.enabled) {
    return { limit, state, snapshot: null };
  }

  const snapshot: DailyRiskSnapshot = {
    enabled: true,
    limitCents: limit.dailyLossLimitCents,
    currentRealizedPnlCents: state?.realizedPnlCents ?? 0,
    openPnlCents: state?.openPnlCents ?? 0,
    totalPnlCents: state?.totalPnlCents ?? 0,
    remainingLossCents: state?.remainingLossCents ?? limit.dailyLossLimitCents,
    status: state?.status ?? DailyFinancialRiskStatus.OK,
    tradeDate,
    lastUpdatedAt: state?.lastUpdatedAt?.toISOString() ?? null,
  };

  return { limit, state, snapshot };
}

export function isDailyRiskStateStale(lastUpdatedAt: Date | null | undefined): boolean {
  if (!lastUpdatedAt) return true;
  return Date.now() - lastUpdatedAt.getTime() > DAILY_RISK_STALE_MS;
}

export async function evaluateDailyFinancialStopForEntry(input: {
  licenseId: string;
  accountLogin: string;
  accountServer: string;
  strategyCode: string;
  symbol: string;
  requestedContracts: number;
  stopPoints: number;
  requiresDailyStop: boolean;
}): Promise<
  | { ok: true; snapshot: DailyRiskSnapshot }
  | { ok: false; reasonCode: string; detail: string; snapshot?: DailyRiskSnapshot }
> {
  if (!input.requiresDailyStop) {
    return {
      ok: true,
      snapshot: {
        enabled: false,
        limitCents: 0,
        currentRealizedPnlCents: 0,
        openPnlCents: 0,
        totalPnlCents: 0,
        remainingLossCents: 0,
        status: DailyFinancialRiskStatus.OK,
        tradeDate: tradeDateKeySaoPaulo(),
        lastUpdatedAt: null,
      },
    };
  }

  const { limit, state, snapshot } = await loadDailyRiskContext(input);

  if (!limit?.enabled) {
    return {
      ok: false,
      reasonCode: "DAILY_FINANCIAL_STOP_NOT_CONFIGURED",
      detail: "Stop financeiro diário não configurado.",
    };
  }

  if (!snapshot) {
    return {
      ok: false,
      reasonCode: "DAILY_FINANCIAL_STOP_NOT_CONFIGURED",
      detail: "Stop financeiro diário indisponível.",
    };
  }

  if (!state) {
    return {
      ok: false,
      reasonCode: "DAILY_RISK_REPORT_MISSING",
      detail: "EA ainda não reportou PnL diário.",
      snapshot,
    };
  }

  if (isDailyRiskStateStale(state.lastUpdatedAt)) {
    return {
      ok: false,
      reasonCode: "DAILY_RISK_STATE_STALE",
      detail: "Relatório de risco diário expirado. Aguarde heartbeat/daily-risk.",
      snapshot,
    };
  }

  if (snapshot.status === DailyFinancialRiskStatus.BLOCKED) {
    return {
      ok: false,
      reasonCode: "DAILY_FINANCIAL_STOP_REACHED",
      detail: "Stop financeiro diário atingido.",
      snapshot,
    };
  }

  const centsPerPoint = await getInstrumentCentsPerPoint(input.symbol);
  if (centsPerPoint != null && input.stopPoints > 0) {
    const potentialLossCents = Math.round(
      input.requestedContracts * input.stopPoints * centsPerPoint
    );
    if (potentialLossCents > snapshot.remainingLossCents) {
      return {
        ok: false,
        reasonCode: "DAILY_FINANCIAL_STOP_WOULD_BE_EXCEEDED",
        detail: `Perda potencial (${potentialLossCents} centavos) excede saldo restante (${snapshot.remainingLossCents}).`,
        snapshot,
      };
    }
  }

  return { ok: true, snapshot };
}

export async function processDailyRiskReport(input: {
  licenseId: string;
  accountLogin: string;
  accountServer: string;
  strategyCode: string;
  symbol: string;
  tradeDate: string;
  realizedPnl: number;
  openPnl: number;
}) {
  const strategyCode = normalizeFiboStrategyCode(input.strategyCode);
  const limit = await prisma.dailyFinancialRiskLimit.findUnique({
    where: {
      licenseId_accountLogin_accountServer_strategyCode_symbol: {
        licenseId: input.licenseId,
        accountLogin: input.accountLogin.trim(),
        accountServer: input.accountServer.trim(),
        strategyCode,
        symbol: input.symbol.trim().toUpperCase(),
      },
    },
  });

  const limitCents = limit?.enabled ? limit.dailyLossLimitCents : 0;
  const includeOpenPnL = limit?.includeOpenPnL ?? true;

  const realizedPnlCents = Math.round(input.realizedPnl * 100);
  const openPnlCents = Math.round(input.openPnl * 100);

  const state = await upsertDailyFinancialRiskState({
    licenseId: input.licenseId,
    accountLogin: input.accountLogin,
    accountServer: input.accountServer,
    strategyCode: input.strategyCode || MR_FIBO_D1_GUARD_CODE,
    symbol: input.symbol,
    tradeDate: input.tradeDate,
    realizedPnlCents,
    openPnlCents,
    limitCents,
    includeOpenPnL,
  });

  return state;
}
