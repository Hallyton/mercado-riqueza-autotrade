import {
  RealTradingApprovalStatus,
  TradeMode,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  REAL_TRADING_REASONS,
  REAL_TRADING_REASON_MESSAGES,
  type RealTradingReasonCode,
} from "@/lib/risk/real-trading-reasons";
import { findActiveRealTradingApproval } from "@/lib/risk/real-trading-approval-query";

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

export type RealTradingGuardContext = RealTradingGuardInput & {
  userId?: string;
  accountLogin?: string;
  accountServer?: string;
  symbol?: string;
  magicNumber?: number;
  requestedContracts?: number;
};

export type RealTradingGuardDecision =
  | {
      allowed: true;
      outcome: "DEMO_OR_STAGING" | "ALLOWED_CONTROLLED_REAL";
      code?:
        | typeof REAL_TRADING_REASONS.ALLOWED_BY_CONTROLLED_GATE
        | typeof REAL_TRADING_REASONS.ALLOWED_BY_MANUAL_APPROVAL;
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

function isExplicitRealTradeMode(
  tradeMode: TradeMode | string | null | undefined
): boolean {
  return tradeMode === TradeMode.REAL || tradeMode === "REAL";
}

/**
 * Camada síncrona: DEMO liberado; REAL exige master switch e sempre bloqueia até
 * aprovação manual (validada na camada async / preflight).
 */
export function evaluateRealTradingGuard(
  input: RealTradingGuardInput,
  env: EnvSource = process.env
): RealTradingGuardDecision {
  if (!isExplicitRealTradeMode(input.tradeMode)) {
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

  return {
    allowed: false,
    outcome: "BLOCKED",
    code: REAL_TRADING_REASONS.APPROVAL_REQUIRED,
    reason: REAL_TRADING_REASON_MESSAGES.REAL_TRADING_APPROVAL_REQUIRED,
  };
}

/** Contagem de aprovações manuais ativas (admin UI). */
export async function countActiveManualRealApprovals(): Promise<number> {
  return prisma.realTradingApproval.count({
    where: {
      status: RealTradingApprovalStatus.APPROVED,
      allowReal: true,
      revokedAt: null,
    },
  });
}

/**
 * Guard operacional async: master switch + RealTradingApproval APPROVED.
 * Não substitui preflight (margem, snapshot, EA online, etc.).
 */
export async function evaluateRealTradingGuardAsync(
  input: RealTradingGuardContext,
  env: EnvSource = process.env
): Promise<RealTradingGuardDecision> {
  const sync = evaluateRealTradingGuard(input, env);
  if (!isExplicitRealTradeMode(input.tradeMode)) {
    return sync;
  }
  if (!sync.allowed && sync.code === REAL_TRADING_REASONS.ENV_NOT_ENABLED) {
    return sync;
  }

  const login = input.accountLogin?.trim();
  const server = input.accountServer?.trim();
  const symbol = input.symbol?.trim();
  const magicNumber = input.magicNumber;
  const requestedContracts = input.requestedContracts ?? 1;

  let approval = null;

  if (
    input.userId &&
    login &&
    server &&
    symbol &&
    magicNumber != null &&
    Number.isInteger(magicNumber)
  ) {
    approval = await findActiveRealTradingApproval(
      input.licenseId,
      input.userId,
      login,
      server,
      symbol,
      magicNumber
    );
  } else {
    approval = await prisma.realTradingApproval.findFirst({
      where: {
        licenseId: input.licenseId,
        status: RealTradingApprovalStatus.APPROVED,
        allowReal: true,
        revokedAt: null,
        ...(input.userId ? { userId: input.userId } : {}),
      },
      orderBy: { approvedAt: "desc" },
    });
  }

  if (!approval) {
    const inactive = await prisma.realTradingApproval.findFirst({
      where: {
        licenseId: input.licenseId,
        ...(login && server && symbol && magicNumber != null
          ? {
              accountLogin: login,
              accountServer: server,
              symbol: symbol.toUpperCase(),
              magicNumber,
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
    });

    if (
      inactive &&
      (inactive.status === RealTradingApprovalStatus.SUSPENDED ||
        inactive.status === RealTradingApprovalStatus.REVOKED ||
        inactive.status === RealTradingApprovalStatus.BLOCKED)
    ) {
      return {
        allowed: false,
        outcome: "BLOCKED",
        code: REAL_TRADING_REASONS.APPROVAL_NOT_ACTIVE,
        reason: REAL_TRADING_REASON_MESSAGES.REAL_TRADING_APPROVAL_NOT_ACTIVE,
      };
    }

    return {
      allowed: false,
      outcome: "BLOCKED",
      code: REAL_TRADING_REASONS.APPROVAL_REQUIRED,
      reason: REAL_TRADING_REASON_MESSAGES.REAL_TRADING_APPROVAL_REQUIRED,
    };
  }

  if (approval.status !== RealTradingApprovalStatus.APPROVED || !approval.allowReal) {
    return {
      allowed: false,
      outcome: "BLOCKED",
      code: REAL_TRADING_REASONS.APPROVAL_NOT_ACTIVE,
      reason: REAL_TRADING_REASON_MESSAGES.REAL_TRADING_APPROVAL_NOT_ACTIVE,
    };
  }

  if (login && approval.accountLogin.trim() !== login) {
    return {
      allowed: false,
      outcome: "BLOCKED",
      code: REAL_TRADING_REASONS.ACCOUNT_MISMATCH,
      reason: REAL_TRADING_REASON_MESSAGES.REAL_TRADING_ACCOUNT_MISMATCH,
    };
  }

  if (server && approval.accountServer.trim() !== server) {
    return {
      allowed: false,
      outcome: "BLOCKED",
      code: REAL_TRADING_REASONS.ACCOUNT_MISMATCH,
      reason: REAL_TRADING_REASON_MESSAGES.REAL_TRADING_ACCOUNT_MISMATCH,
    };
  }

  if (symbol && approval.symbol.toUpperCase() !== symbol.toUpperCase()) {
    return {
      allowed: false,
      outcome: "BLOCKED",
      code: REAL_TRADING_REASONS.SYMBOL_MISMATCH,
      reason: REAL_TRADING_REASON_MESSAGES.REAL_TRADING_SYMBOL_MISMATCH,
    };
  }

  if (
    magicNumber != null &&
    Number.isInteger(magicNumber) &&
    approval.magicNumber !== magicNumber
  ) {
    return {
      allowed: false,
      outcome: "BLOCKED",
      code: REAL_TRADING_REASONS.MAGIC_MISMATCH,
      reason: REAL_TRADING_REASON_MESSAGES.REAL_TRADING_MAGIC_MISMATCH,
    };
  }

  if (requestedContracts > approval.maxContracts) {
    return {
      allowed: false,
      outcome: "BLOCKED",
      code: REAL_TRADING_REASONS.CONTRACT_LIMIT_EXCEEDED,
      reason: REAL_TRADING_REASON_MESSAGES.REAL_TRADING_CONTRACT_LIMIT_EXCEEDED,
    };
  }

  return {
    allowed: true,
    outcome: "ALLOWED_CONTROLLED_REAL",
    code: REAL_TRADING_REASONS.ALLOWED_BY_MANUAL_APPROVAL,
    reason: REAL_TRADING_REASON_MESSAGES.REAL_TRADING_ALLOWED_BY_MANUAL_APPROVAL,
  };
}

export function toPreflightGuardFlags(env: EnvSource = process.env) {
  return {
    envEnabledOk: isRealTradingEnabled(env),
    envAllowlistOk: (licenseId: string) =>
      isLicenseAllowedForRealTrading(licenseId, env),
  };
}
