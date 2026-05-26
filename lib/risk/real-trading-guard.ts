import { TradeMode } from "@prisma/client";

export const REAL_TRADING_DISABLED_CODE = "REAL_TRADING_DISABLED";
export const REAL_TRADING_DISABLED_REASON =
  "Conta em modo REAL bloqueada pelo Real Trading Guard.";

const ENABLED_VALUES = new Set(["true", "1"]);

type EnvSource = Record<string, string | undefined>;

export type RealTradingGuardInput = {
  tradeMode: TradeMode | string | null | undefined;
  licenseId: string;
};

export type RealTradingGuardDecision =
  | {
      allowed: true;
      code?: never;
      reason?: never;
    }
  | {
      allowed: false;
      code: typeof REAL_TRADING_DISABLED_CODE;
      reason: typeof REAL_TRADING_DISABLED_REASON;
    };

export function isRealTradingEnabled(env: EnvSource = process.env): boolean {
  const raw = env.ENABLE_REAL_TRADING?.trim().toLowerCase();
  return raw ? ENABLED_VALUES.has(raw) : false;
}

export function isLicenseAllowedForRealTrading(
  licenseId: string,
  env: EnvSource = process.env
): boolean {
  const allowed = env.REAL_TRADING_ALLOWED_LICENSE_IDS?.split(/[,\s;]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  return allowed?.includes(licenseId) ?? false;
}

export function evaluateRealTradingGuard(
  input: RealTradingGuardInput,
  env: EnvSource = process.env
): RealTradingGuardDecision {
  if (input.tradeMode !== TradeMode.REAL && input.tradeMode !== "REAL") {
    return { allowed: true };
  }

  if (!isRealTradingEnabled(env)) {
    return {
      allowed: false,
      code: REAL_TRADING_DISABLED_CODE,
      reason: REAL_TRADING_DISABLED_REASON,
    };
  }

  if (!isLicenseAllowedForRealTrading(input.licenseId, env)) {
    return {
      allowed: false,
      code: REAL_TRADING_DISABLED_CODE,
      reason: REAL_TRADING_DISABLED_REASON,
    };
  }

  return { allowed: true };
}
