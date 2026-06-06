import type { DailyFinancialRiskState } from "@prisma/client";
import { MR_FIBO_D1_GUARD_CODE } from "@/lib/risk/autonomous-strategy-reasons";
import { normalizeFiboStrategyCode } from "@/lib/strategy/normalize-strategy-code";

export type DailyRiskStateEffectiveKey = {
  licenseId: string;
  accountLogin: string;
  accountServer: string;
  symbol: string;
  strategyCode: string;
  tradeDate: string;
};

export type DailyRiskStateKeyReceived = {
  strategyCodeRaw: string;
  strategyCodeNormalized: string;
  symbolRaw: string;
  symbolNormalized: string;
  tradeDateRaw: string | null;
  tradeDateOperational: string;
  tradeDateMismatch: boolean;
};

export type DailyRiskStateDiagnosisCode =
  | "DAILY_RISK_STATE_FOUND"
  | "DAILY_RISK_STATE_MISSING"
  | "DAILY_RISK_STATE_TRADE_DATE_MISMATCH"
  | "DAILY_RISK_STATE_SYMBOL_MISMATCH"
  | "DAILY_RISK_STATE_STRATEGY_MISMATCH"
  | "DAILY_RISK_STATE_ACCOUNT_SERVER_MISMATCH"
  | "DAILY_RISK_STATE_LICENSE_MISMATCH";

export function tradeDateKeySaoPaulo(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function normalizeDailyRiskAccountLogin(value: string | number): string {
  return String(value).trim();
}

export function normalizeDailyRiskAccountServer(value: string): string {
  return value.trim();
}

export function normalizeDailyRiskSymbol(value: string): string {
  return value.trim().toUpperCase();
}

export function resolveOperationalTradeDate(input?: {
  tradeDateFromEa?: string | null;
  now?: Date;
}): {
  operationalTradeDate: string;
  receivedTradeDate: string | null;
  tradeDateMismatch: boolean;
} {
  const operationalTradeDate = tradeDateKeySaoPaulo(input?.now);
  const receivedTradeDate = input?.tradeDateFromEa?.trim() || null;
  return {
    operationalTradeDate,
    receivedTradeDate,
    tradeDateMismatch: Boolean(
      receivedTradeDate && receivedTradeDate !== operationalTradeDate
    ),
  };
}

export function resolveDailyRiskStateKey(input: {
  licenseId: string;
  accountLogin: string | number;
  accountServer: string;
  symbol: string;
  strategyCode: string;
  tradeDate?: string | null;
  tradeDateFromEa?: string | null;
}): {
  effectiveKey: DailyRiskStateEffectiveKey;
  received: DailyRiskStateKeyReceived;
} {
  const strategyCodeNormalized = normalizeFiboStrategyCode(input.strategyCode);
  const accountLogin = normalizeDailyRiskAccountLogin(input.accountLogin);
  const accountServer = normalizeDailyRiskAccountServer(input.accountServer);
  const symbolNormalized = normalizeDailyRiskSymbol(input.symbol);
  const tradeDateInput = input.tradeDate ?? input.tradeDateFromEa ?? null;
  const { operationalTradeDate, receivedTradeDate, tradeDateMismatch } =
    resolveOperationalTradeDate({ tradeDateFromEa: tradeDateInput });

  return {
    effectiveKey: {
      licenseId: input.licenseId,
      accountLogin,
      accountServer,
      strategyCode: strategyCodeNormalized,
      symbol: symbolNormalized,
      tradeDate: operationalTradeDate,
    },
    received: {
      strategyCodeRaw: input.strategyCode,
      strategyCodeNormalized,
      symbolRaw: input.symbol,
      symbolNormalized,
      tradeDateRaw: receivedTradeDate,
      tradeDateOperational: operationalTradeDate,
      tradeDateMismatch,
    },
  };
}

export function dailyRiskStateUniqueWhere(key: DailyRiskStateEffectiveKey) {
  return {
    licenseId_accountLogin_accountServer_strategyCode_symbol_tradeDate: key,
  };
}

export function formatDailyRiskStateKey(key: DailyRiskStateEffectiveKey): string {
  return `${key.licenseId}|${key.accountLogin}@${key.accountServer}|${key.symbol}|${key.strategyCode}|${key.tradeDate}`;
}

export function classifyNearbyDailyRiskState(
  expected: DailyRiskStateEffectiveKey,
  candidate: DailyRiskStateEffectiveKey
): DailyRiskStateDiagnosisCode | null {
  if (formatDailyRiskStateKey(expected) === formatDailyRiskStateKey(candidate)) {
    return "DAILY_RISK_STATE_FOUND";
  }

  const mismatches: DailyRiskStateDiagnosisCode[] = [];
  if (candidate.licenseId !== expected.licenseId) {
    mismatches.push("DAILY_RISK_STATE_LICENSE_MISMATCH");
  }
  if (
    candidate.accountLogin !== expected.accountLogin ||
    candidate.accountServer !== expected.accountServer
  ) {
    mismatches.push("DAILY_RISK_STATE_ACCOUNT_SERVER_MISMATCH");
  }
  if (candidate.symbol !== expected.symbol) {
    mismatches.push("DAILY_RISK_STATE_SYMBOL_MISMATCH");
  }
  if (candidate.strategyCode !== expected.strategyCode) {
    mismatches.push("DAILY_RISK_STATE_STRATEGY_MISMATCH");
  }
  if (candidate.tradeDate !== expected.tradeDate) {
    mismatches.push("DAILY_RISK_STATE_TRADE_DATE_MISMATCH");
  }

  return mismatches[0] ?? null;
}

export function toDailyRiskStateEffectiveKey(
  state: Pick<
    DailyFinancialRiskState,
    | "licenseId"
    | "accountLogin"
    | "accountServer"
    | "symbol"
    | "strategyCode"
    | "tradeDate"
  >
): DailyRiskStateEffectiveKey {
  return resolveDailyRiskStateKey({
    licenseId: state.licenseId,
    accountLogin: state.accountLogin,
    accountServer: state.accountServer,
    symbol: state.symbol,
    strategyCode: state.strategyCode,
    tradeDate: state.tradeDate,
  }).effectiveKey;
}

export function isMrFiboGuardStrategyCode(strategyCode: string): boolean {
  return normalizeFiboStrategyCode(strategyCode) === MR_FIBO_D1_GUARD_CODE;
}
