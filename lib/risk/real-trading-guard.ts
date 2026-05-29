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

export type RealTradingGuardOutcome =
  | "DEMO_OR_STAGING"
  | "BLOCKED"
  | "ALLOWED_CONTROLLED_REAL";

export type RealTradingGuardInput = {
  tradeMode: TradeMode | string | null | undefined;
  licenseId: string;
};

export type RealTradingGuardDecision =
  | {
      allowed: true;
      outcome: "DEMO_OR_STAGING" | "ALLOWED_CONTROLLED_REAL";
      code?: typeof REAL_TRADING_REASONS.ALLOWED_BY_CONTROLLED_GATE;
      reason?: string;
    }
  | {
      allowed: false;
      outcome: "BLOCKED";
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

/** Camada síncrona: env + allowlist (default deny). Preflight completa o gate condicional. */
export function evaluateRealTradingGuard(
  input: RealTradingGuardInput,
  env: EnvSource = process.env
): RealTradingGuardDecision {
  if (input.tradeMode !== TradeMode.REAL && input.tradeMode !== "REAL") {
    return { allowed: true, outcome: "DEMO_OR_STAGING" };
  }

  if (!isRealTradingEnabled(env)) {
    return {
      allowed: false,
      outcome: "BLOCKED",
      code: REAL_TRADING_REASONS.ENV_NOT_ENABLED,
      reason: REAL_TRADING_REASON_MESSAGES.REAL_TRADING_ENV_NOT_ENABLED,
    };
  }

  if (!isLicenseAllowedForRealTrading(input.licenseId, env)) {
    return {
      allowed: false,
      outcome: "BLOCKED",
      code: REAL_TRADING_REASONS.LICENSE_NOT_ALLOWLISTED,
      reason:
        REAL_TRADING_REASON_MESSAGES.REAL_TRADING_LICENSE_NOT_ALLOWLISTED,
    };
  }

  return { allowed: true, outcome: "DEMO_OR_STAGING" };
}

export function toPreflightGuardFlags(env: EnvSource = process.env) {
  return {
    envEnabledOk: isRealTradingEnabled(env),
    allowlistOk: (licenseId: string) =>
      isLicenseAllowedForRealTrading(licenseId, env),
  };
}
