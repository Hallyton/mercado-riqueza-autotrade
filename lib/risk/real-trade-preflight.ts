import {
  AccountSnapshotType,
  RealTradePreflightSource,
  RealTradePreflightStatus,
  RealTradingApprovalStatus,
  TradeMode,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  evaluateRealTradingGuardAsync,
  isRealTradingEnabled,
} from "@/lib/risk/real-trading-guard";
import { findActiveRealTradingApproval } from "@/lib/risk/real-trading-approval-query";
import {
  hasRequiredTermsAcceptance,
  isCommercialPaymentOk,
  isDeviceAuthorizedForLicense,
  isLicenseCommerciallyEligible,
  isRobotQuantityWithinPlan,
  isSubscriptionCommerciallyActive,
} from "@/lib/risk/real-trading-commercial";
import {
  eaOnlineThresholdMs,
  isAutoDispatchEnabled,
  isEnvLicenseAllowlistConfigured,
  isLicenseInEnvAllowlist,
  magicNumberRange,
} from "@/lib/risk/real-trading-config";
import {
  hasPendingProtectionForMagic,
  hasUnresolvedProtectionBlock,
} from "@/lib/risk/execution-protection";
import {
  REAL_TRADING_REASONS,
  REAL_TRADING_REASON_MESSAGES,
  type RealTradingReasonCode,
} from "@/lib/risk/real-trading-reasons";

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
  /** Simulação admin: persiste preflight DRY_RUN sem instruction. */
  dryRun?: boolean;
  /** Quando false, executa checagens sem persistir registro (preview em lote). */
  persist?: boolean;
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
  dryRun?: boolean;
  source?: RealTradePreflightSource;
  flags?: RealTradePreflightFlags;
};

export type RealTradePreflightFlags = {
  marginOk: boolean;
  eaOnline: boolean;
  snapshotOk: boolean;
  realApprovalOk: boolean;
  protectionPreviousOk: boolean;
  deviceOk: boolean;
  accountOk: boolean;
  licenseOk: boolean;
  subscriptionOk: boolean;
  paymentOk: boolean;
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

export { findActiveRealTradingApproval } from "@/lib/risk/real-trading-approval-query";

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

function pushCheck(
  checks: PreflightCheck[],
  key: string,
  ok: boolean,
  detail?: RealTradingReasonCode
) {
  checks.push({ key, ok, detail: ok ? undefined : detail });
}

export async function runRealTradePreflight(
  input: RealTradePreflightInput
): Promise<RealTradePreflightResult> {
  const checks: PreflightCheck[] = [];
  const dryRun = input.dryRun === true;
  const persist = input.persist !== false;
  const environment = input.environment ?? TradeMode.REAL;
  const requestedContracts = input.requestedContracts ?? 1;
  const login = normalizeAccount(input.accountLogin);
  const server = normalizeAccount(input.accountServer);
  const symbol = normalizeSymbol(input.symbol);
  const magicNumber = input.magicNumber;

  const envEnabledOk = isRealTradingEnabled();
  pushCheck(
    checks,
    "env_enabled",
    environment !== TradeMode.REAL || envEnabledOk,
    REAL_TRADING_REASONS.ENV_NOT_ENABLED
  );

  const guardDecision = await evaluateRealTradingGuardAsync({
    tradeMode: environment,
    licenseId: input.licenseId,
    userId: input.userId,
    accountLogin: login,
    accountServer: server,
    symbol,
    magicNumber,
    requestedContracts,
  });
  const guardSyncOk = guardDecision.allowed;
  pushCheck(
    checks,
    "real_trading_guard_sync",
    guardSyncOk,
    guardDecision.allowed
      ? undefined
      : guardDecision.code
  );

  const autoDispatchOk =
    dryRun ||
    !(input.isAutoDispatch && !isAutoDispatchEnabled());
  pushCheck(
    checks,
    "auto_dispatch",
    autoDispatchOk,
    REAL_TRADING_REASONS.AUTO_DISPATCH_DISABLED
  );

  const range = magicNumberRange();
  const magicInRange =
    Number.isInteger(magicNumber) &&
    magicNumber >= range.min &&
    magicNumber <= range.max;
  pushCheck(
    checks,
    "magic_number_range",
    magicInRange,
    REAL_TRADING_REASONS.MAGIC_MISMATCH
  );

  const commercial = await isLicenseCommerciallyEligible(input.licenseId);
  const licenseOk =
    commercial.licenseOk && commercial.userId === input.userId;
  pushCheck(
    checks,
    "license",
    licenseOk,
    REAL_TRADING_REASONS.LICENSE_NOT_ACTIVE
  );

  const subscriptionId = commercial.subscriptionId;
  let subscriptionOk = true;
  if (subscriptionId) {
    subscriptionOk = await isSubscriptionCommerciallyActive(subscriptionId);
    pushCheck(
      checks,
      "subscription",
      subscriptionOk,
      REAL_TRADING_REASONS.SUBSCRIPTION_NOT_ACTIVE
    );
  } else {
    pushCheck(checks, "subscription", false, REAL_TRADING_REASONS.SUBSCRIPTION_NOT_ACTIVE);
    subscriptionOk = false;
  }

  const paymentOk = await isCommercialPaymentOk(subscriptionId);
  pushCheck(
    checks,
    "payment",
    paymentOk,
    REAL_TRADING_REASONS.PAYMENT_NOT_ACTIVE
  );

  const termsOk = await hasRequiredTermsAcceptance(input.userId);
  pushCheck(
    checks,
    "terms",
    termsOk,
    REAL_TRADING_REASONS.TERMS_NOT_ACCEPTED
  );

  const deviceOk = await isDeviceAuthorizedForLicense(input.licenseId);
  pushCheck(
    checks,
    "device",
    deviceOk,
    REAL_TRADING_REASONS.DEVICE_OFFLINE
  );

  const planRobotOk = await isRobotQuantityWithinPlan(subscriptionId, 1);
  pushCheck(checks, "plan_robot", planRobotOk, REAL_TRADING_REASONS.SUBSCRIPTION_NOT_ACTIVE);

  const approval =
    licenseOk && guardSyncOk
      ? await findActiveRealTradingApproval(
          input.licenseId,
          input.userId,
          login,
          server,
          symbol,
          magicNumber
        )
      : null;

  const envAllowlistConfigured = isEnvLicenseAllowlistConfigured();
  const allowlistOk =
    environment !== TradeMode.REAL ||
    !envAllowlistConfigured ||
    isLicenseInEnvAllowlist(input.licenseId);
  pushCheck(
    checks,
    "allowlist",
    allowlistOk,
    REAL_TRADING_REASONS.LICENSE_NOT_IN_ENV_ALLOWLIST
  );

  if (!approval) {
    const anyApproval = await prisma.realTradingApproval.findFirst({
      where: { licenseId: input.licenseId, magicNumber },
    });
    pushCheck(
      checks,
      "real_approval",
      false,
      anyApproval
        ? REAL_TRADING_REASONS.APPROVAL_NOT_ACTIVE
        : REAL_TRADING_REASONS.APPROVAL_REQUIRED
    );
  } else {
    pushCheck(checks, "real_approval", true);
  }

  const license = await prisma.license.findUnique({
    where: { id: input.licenseId },
    include: { mt5Account: true },
  });
  const linked = license?.mt5Account;
  const accountOk =
    Boolean(linked) &&
    normalizeAccount(linked!.login) === login &&
    normalizeAccount(linked!.server) === server;
  pushCheck(
    checks,
    "account",
    accountOk,
    REAL_TRADING_REASONS.ACCOUNT_MISMATCH
  );

  const symbolOk = !approval || normalizeSymbol(approval.symbol) === symbol;
  pushCheck(
    checks,
    "symbol",
    symbolOk,
    REAL_TRADING_REASONS.SYMBOL_MISMATCH
  );

  const magicNumberOk = !approval || approval.magicNumber === magicNumber;
  pushCheck(
    checks,
    "magic_number",
    magicNumberOk,
    REAL_TRADING_REASONS.MAGIC_MISMATCH
  );

  const snapshotResult = await hasPreMarketSnapshotToday(
    input.licenseId,
    login,
    server
  );
  pushCheck(
    checks,
    "pre_market_snapshot",
    snapshotResult.ok,
    REAL_TRADING_REASONS.SNAPSHOT_REQUIRED
  );

  const eaOnline = await isEaExecutorOnline(input.licenseId);
  pushCheck(
    checks,
    "ea_online",
    eaOnline,
    REAL_TRADING_REASONS.EXECUTOR_OFFLINE
  );

  const protectionFailed = await hasUnresolvedProtectionBlock(
    input.licenseId,
    magicNumber
  );
  const protectionPending = await hasPendingProtectionForMagic(
    input.licenseId,
    magicNumber
  );
  const protectionPreviousOk = !protectionFailed && !protectionPending;
  pushCheck(
    checks,
    "protection_previous",
    protectionPreviousOk,
    protectionFailed
      ? REAL_TRADING_REASONS.PREVIOUS_PROTECTION_FAILED
      : REAL_TRADING_REASONS.PROTECTION_PENDING
  );

  let freeMargin: number | null = null;
  if (snapshotResult.snapshotId) {
    const snap = await prisma.accountSnapshot.findUnique({
      where: { id: snapshotResult.snapshotId },
      select: { freeMargin: true, equity: true, balance: true },
    });
    if (snap?.freeMargin != null) freeMargin = Number(snap.freeMargin);
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
  pushCheck(
    checks,
    "margin",
    marginOk,
    REAL_TRADING_REASONS.MARGIN_INSUFFICIENT
  );

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
  pushCheck(
    checks,
    "existing_exposure",
    !collision,
    REAL_TRADING_REASONS.MAGIC_MISMATCH
  );

  const maxContractsOk = !approval || requestedContracts <= approval.maxContracts;
  pushCheck(
    checks,
    "max_contracts",
    maxContractsOk,
    REAL_TRADING_REASONS.CONTRACT_LIMIT_EXCEEDED
  );

  const failed = checks.find((c) => !c.ok);
  const status: RealTradePreflightStatus = failed
    ? failed.key === "auto_dispatch" ||
      failed.key === "env_enabled" ||
      failed.key === "allowlist"
      ? RealTradePreflightStatus.BLOCKED
      : RealTradePreflightStatus.FAILED
    : RealTradePreflightStatus.PASSED;

  const reasonCode: RealTradingReasonCode | undefined = failed
    ? (failed.detail as RealTradingReasonCode | undefined) ??
      REAL_TRADING_REASONS.PREFLIGHT_FAILED
    : REAL_TRADING_REASONS.ALLOWED_BY_CONTROLLED_GATE;

  const reason = reasonCode
    ? REAL_TRADING_REASON_MESSAGES[reasonCode]
    : undefined;

  const preflightSource = dryRun
    ? RealTradePreflightSource.DRY_RUN
    : RealTradePreflightSource.INSTRUCTION;

  if (!persist) {
    return {
      status,
      passed: status === RealTradePreflightStatus.PASSED,
      reasonCode,
      reason,
      checks,
      approvalId: approval?.id,
      accountSnapshotId: snapshotResult.snapshotId,
      dryRun,
      source: preflightSource,
      flags: {
        marginOk,
        eaOnline,
        snapshotOk: snapshotResult.ok,
        realApprovalOk: Boolean(approval),
        protectionPreviousOk,
        deviceOk,
        accountOk,
        licenseOk,
        subscriptionOk,
        paymentOk,
      },
    };
  }

  const record = await prisma.realTradePreflight.create({
    data: {
      userId: input.userId,
      licenseId: input.licenseId,
      source: preflightSource,
      instructionId: dryRun
        ? undefined
        : (input.instructionId ?? undefined),
      masterSignalId: dryRun
        ? undefined
        : (input.masterSignalId ?? undefined),
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
      realApprovalOk: Boolean(approval),
      snapshotOk: snapshotResult.ok,
      existingExposureOk: !collision,
      protectionPreviousOk,
      paymentOk,
      termsOk,
      deviceOk,
      allowlistOk,
      envEnabledOk,
      maxContractsOk,
      autoDispatchOk,
      planRobotOk,
      reasonCode,
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
    dryRun,
    source: preflightSource,
    flags: {
      marginOk,
      eaOnline,
      snapshotOk: snapshotResult.ok,
      realApprovalOk: Boolean(approval),
      protectionPreviousOk,
      deviceOk,
      accountOk,
      licenseOk,
      subscriptionOk: subscriptionOk ?? false,
      paymentOk,
    },
  };
}
