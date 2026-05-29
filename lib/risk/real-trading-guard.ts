import { TradeMode } from "@prisma/client";
import {
  REAL_TRADING_REASONS,
  REAL_TRADING_REASON_MESSAGES,
  type RealTradingReasonCode,
} from "@/lib/risk/real-trading-reasons";

export const REAL_TRADING_DISABLED_CODE = REAL_TRADING_REASONS.DISABLED;
export const REAL_TRADING_DISABLED_REASON =
  REAL_TRADING_REASON_MESSAGES.REAL_TRADING_DISABLED;

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
      code: RealTradingReasonCode;
      reason: string;
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
