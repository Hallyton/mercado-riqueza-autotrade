import {
  AccountSnapshotType,
  LicenseStatus,
  RealTradePreflightStatus,
  RealTradingApprovalStatus,
  SubscriptionStatus,
  TradeMode,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  evaluateRealTradingGuard,
  isLicenseAllowedForRealTrading,
  isRealTradingEnabled,
} from "@/lib/risk/real-trading-guard";
import {
  eaOnlineThresholdMs,
  isAutoDispatchEnabled,
  magicNumberRange,
} from "@/lib/risk/real-trading-config";
import {
  REAL_TRADING_REASONS,
  REAL_TRADING_REASON_MESSAGES,
  type RealTradingReasonCode,
} from "@/lib/risk/real-trading-reasons";
import { hasUnresolvedProtectionBlock } from "@/lib/risk/execution-protection";

export type RealTradePreflightInput = {
  userId: string;
  licenseId: string;
  robotInstanceId?: string | null;
  instructionId?: string | null;
  masterSignalId?: string | null;
  accountLogin: string;
  accountServer: string;
  symbol: string;
  magicNumber: number;
  requestedContracts?: number;
  requiredMargin?: number | null;
  environment?: TradeMode;
  isAutoDispatch?: boolean;
};

export type PreflightCheck = {
  key: string;
  ok: boolean;
  detail?: string;
};

export type RealTradePreflightResult = {
  status: RealTradePreflightStatus;
  passed: boolean;
  reasonCode?: RealTradingReasonCode;
  reason?: string;
  checks: PreflightCheck[];
  preflightId?: string;
  approvalId?: string;
  accountSnapshotId?: string;
};

function startOfUtcDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function normalizeAccount(value: string): string {
  return value.trim();
}

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

export async function findActiveRealTradingApproval(
  licenseId: string,
  accountLogin: string,
  accountServer: string,
  symbol: string,
  magicNumber: number
) {
  return prisma.realTradingApproval.findFirst({
    where: {
      licenseId,
      accountLogin: normalizeAccount(accountLogin),
      accountServer: normalizeAccount(accountServer),
      symbol: normalizeSymbol(symbol),
      magicNumber,
      status: RealTradingApprovalStatus.APPROVED,
      allowReal: true,
      revokedAt: null,
    },
  });
}

export async function hasPreMarketSnapshotToday(
  licenseId: string,
  accountLogin: string,
  accountServer: string
): Promise<{ ok: boolean; snapshotId?: string }> {
  const dayStart = startOfUtcDay();
  const snapshot = await prisma.accountSnapshot.findFirst({
    where: {
      licenseId,
      accountLogin: normalizeAccount(accountLogin),
      accountServer: normalizeAccount(accountServer),
      snapshotType: AccountSnapshotType.PRE_MARKET,
      environment: TradeMode.REAL,
      capturedAt: { gte: dayStart },
    },
    orderBy: { capturedAt: "desc" },
  });
  return snapshot ? { ok: true, snapshotId: snapshot.id } : { ok: false };
}

export async function isEaExecutorOnline(licenseId: string): Promise<boolean> {
  const threshold = new Date(Date.now() - eaOnlineThresholdMs());
  const heartbeat = await prisma.eaHeartbeat.findFirst({
    where: {
      licenseId,
      receivedAt: { gte: threshold },
      eaStatus: "ONLINE",
    },
    orderBy: { receivedAt: "desc" },
  });
  return Boolean(heartbeat);
}

async function loadLicenseContext(licenseId: string) {
  return prisma.license.findUnique({
    where: { id: licenseId },
    include: {
      mt5Account: true,
      subscription: true,
    },
  });
}

export async function runRealTradePreflight(
  input: RealTradePreflightInput
): Promise<RealTradePreflightResult> {
  const checks: PreflightCheck[] = [];
  const environment = input.environment ?? TradeMode.REAL;
  const requestedContracts = input.requestedContracts ?? 1;
  const login = normalizeAccount(input.accountLogin);
  const server = normalizeAccount(input.accountServer);
  const symbol = normalizeSymbol(input.symbol);
  const magicNumber = input.magicNumber;

  const guardDecision = evaluateRealTradingGuard({
    tradeMode: environment,
    licenseId: input.licenseId,
  });
  const guardOk =
    environment !== TradeMode.REAL ||
    (guardDecision.allowed &&
      isRealTradingEnabled() &&
      isLicenseAllowedForRealTrading(input.licenseId));
  checks.push({
    key: "real_trading_guard",
    ok: guardOk,
    detail: guardOk ? undefined : REAL_TRADING_REASONS.DISABLED,
  });

  if (input.isAutoDispatch && !isAutoDispatchEnabled()) {
    checks.push({
      key: "auto_dispatch",
      ok: false,
      detail: REAL_TRADING_REASONS.AUTO_DISPATCH_DISABLED,
    });
  } else {
    checks.push({ key: "auto_dispatch", ok: true });
  }

  const range = magicNumberRange();
  const magicInRange =
    Number.isInteger(magicNumber) &&
    magicNumber >= range.min &&
    magicNumber <= range.max;
  checks.push({
    key: "magic_number_range",
    ok: magicInRange,
    detail: magicInRange ? undefined : REAL_TRADING_REASONS.MAGIC_MISMATCH,
  });

  const license = await loadLicenseContext(input.licenseId);
  const licenseOk =
    Boolean(license) &&
    license!.status === LicenseStatus.ACTIVE &&
    !license!.haltAllTrading;
  checks.push({
    key: "license",
    ok: licenseOk,
    detail: licenseOk ? undefined : REAL_TRADING_REASONS.LICENSE_INVALID,
  });

  let subscriptionOk: boolean | null = null;
  if (license?.subscription) {
    subscriptionOk = license.subscription.status === SubscriptionStatus.ACTIVE;
    checks.push({
      key: "subscription",
      ok: subscriptionOk,
      detail: subscriptionOk ? undefined : REAL_TRADING_REASONS.SUBSCRIPTION_INACTIVE,
    });
  } else {
    checks.push({ key: "subscription", ok: true, detail: "no_subscription_linked" });
  }

  const approval = licenseOk
    ? await findActiveRealTradingApproval(
        input.licenseId,
        login,
        server,
        symbol,
        magicNumber
      )
    : null;
  const realApprovalOk = Boolean(approval);
  checks.push({
    key: "real_approval",
    ok: realApprovalOk,
    detail: realApprovalOk ? undefined : REAL_TRADING_REASONS.APPROVAL_REQUIRED,
  });

  const linked = license?.mt5Account;
  const accountOk =
    !linked ||
    (normalizeAccount(linked.login) === login &&
      normalizeAccount(linked.server) === server);
  checks.push({
    key: "account",
    ok: accountOk,
    detail: accountOk ? undefined : REAL_TRADING_REASONS.ACCOUNT_MISMATCH,
  });

  const symbolOk = !approval || normalizeSymbol(approval.symbol) === symbol;
  checks.push({
    key: "symbol",
    ok: symbolOk,
    detail: symbolOk ? undefined : REAL_TRADING_REASONS.SYMBOL_MISMATCH,
  });

  const magicNumberOk = !approval || approval.magicNumber === magicNumber;
  checks.push({
    key: "magic_number",
    ok: magicNumberOk,
    detail: magicNumberOk ? undefined : REAL_TRADING_REASONS.MAGIC_MISMATCH,
  });

  const snapshotResult = await hasPreMarketSnapshotToday(
    input.licenseId,
    login,
    server
  );
  checks.push({
    key: "pre_market_snapshot",
    ok: snapshotResult.ok,
    detail: snapshotResult.ok ? undefined : REAL_TRADING_REASONS.SNAPSHOT_REQUIRED,
  });

  const eaOnline = await isEaExecutorOnline(input.licenseId);
  checks.push({
    key: "ea_online",
    ok: eaOnline,
    detail: eaOnline ? undefined : REAL_TRADING_REASONS.EXECUTOR_OFFLINE,
  });

  const protectionPreviousOk = !(await hasUnresolvedProtectionBlock(
    input.licenseId,
    magicNumber
  ));
  checks.push({
    key: "protection_previous",
    ok: protectionPreviousOk,
    detail: protectionPreviousOk
      ? undefined
      : REAL_TRADING_REASONS.PROTECTION_NOT_CONFIRMED,
  });

  let freeMargin: number | null = null;
  const latestHb = await prisma.eaHeartbeat.findFirst({
    where: { licenseId: input.licenseId },
    orderBy: { receivedAt: "desc" },
    select: { margin: true, balance: true, equity: true, reportPayload: true },
  });
  if (snapshotResult.snapshotId) {
    const snap = await prisma.accountSnapshot.findUnique({
      where: { id: snapshotResult.snapshotId },
      select: { freeMargin: true },
    });
    if (snap?.freeMargin != null) freeMargin = Number(snap.freeMargin);
  }
  if (freeMargin == null && latestHb?.reportPayload) {
    const payload = latestHb.reportPayload as { free_margin?: number };
    if (typeof payload.free_margin === "number") freeMargin = payload.free_margin;
  }

  const requiredMargin = input.requiredMargin ?? 0;
  const bufferPct = approval ? Number(approval.marginBufferPercent) : 10;
  const minFree = approval?.minFreeMargin
    ? Number(approval.minFreeMargin)
    : 0;
  const marginRequired =
    requiredMargin > 0
      ? requiredMargin * (1 + bufferPct / 100)
      : minFree;
  const marginOk =
    freeMargin == null ? requiredMargin === 0 : freeMargin >= marginRequired;
  checks.push({
    key: "margin",
    ok: marginOk,
    detail: marginOk ? undefined : REAL_TRADING_REASONS.MARGIN_INSUFFICIENT,
  });

  const collision = await prisma.realTradingApproval.findFirst({
    where: {
      accountLogin: login,
      accountServer: server,
      magicNumber,
      status: RealTradingApprovalStatus.APPROVED,
      allowReal: true,
      licenseId: { not: input.licenseId },
    },
  });
  const existingExposureOk = !collision;
  checks.push({
    key: "existing_exposure",
    ok: existingExposureOk,
    detail: existingExposureOk ? undefined : REAL_TRADING_REASONS.MAGIC_MISMATCH,
  });

  if (approval && requestedContracts > approval.maxContracts) {
    checks.push({
      key: "max_contracts",
      ok: false,
      detail: REAL_TRADING_REASONS.MARGIN_INSUFFICIENT,
    });
  } else {
    checks.push({ key: "max_contracts", ok: true });
  }

  const failed = checks.find((c) => !c.ok);
  const status: RealTradePreflightStatus = failed
    ? failed.key === "auto_dispatch" || failed.key === "real_trading_guard"
      ? RealTradePreflightStatus.BLOCKED
      : RealTradePreflightStatus.FAILED
    : RealTradePreflightStatus.PASSED;

  const reasonCode = (failed?.detail as RealTradingReasonCode | undefined) ??
    (failed ? REAL_TRADING_REASONS.PREFLIGHT_FAILED : undefined);
  const reason = reasonCode
    ? REAL_TRADING_REASON_MESSAGES[reasonCode]
    : undefined;

  const record = await prisma.realTradePreflight.create({
    data: {
      userId: input.userId,
      licenseId: input.licenseId,
      instructionId: input.instructionId ?? undefined,
      masterSignalId: input.masterSignalId ?? undefined,
      accountSnapshotId: snapshotResult.snapshotId,
      accountLogin: login,
      accountServer: server,
      symbol,
      magicNumber,
      requestedContracts,
      requiredMargin: requiredMargin > 0 ? requiredMargin : undefined,
      freeMargin: freeMargin ?? undefined,
      marginOk,
      eaOnline,
      accountOk,
      symbolOk,
      magicNumberOk,
      subscriptionOk,
      licenseOk,
      realApprovalOk,
      snapshotOk: snapshotResult.ok,
      existingExposureOk,
      protectionPreviousOk,
      status,
      reason,
    },
  });

  return {
    status,
    passed: status === RealTradePreflightStatus.PASSED,
    reasonCode,
    reason,
    checks,
    preflightId: record.id,
    approvalId: approval?.id,
    accountSnapshotId: snapshotResult.snapshotId,
  };
}
