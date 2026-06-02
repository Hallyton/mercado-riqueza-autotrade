import {
  InstructionSource,
  LicenseStatus,
  OrderLogStatus,
  RobotInstanceStatus,
  TradeMode,
  UserStatus,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { ACTIVE_DEVICE_WHERE } from "@/lib/licensing/device-lifecycle";
import {
  validateManagementPlan,
  type RealManualManagementPlan,
} from "@/lib/admin/real-manual-management-plan";
import {
  buildBulkRegularizationLinks,
  BULK_ELIGIBILITY_ACTION_HINTS,
  BULK_ELIGIBILITY_REASON_MESSAGES,
  type BulkEligibilityReasonCode,
} from "@/lib/admin/real-manual-bulk-reasons";
import {
  findActiveRealTradingApproval,
  hasPreMarketSnapshotToday,
  isEaExecutorOnline,
  runRealTradePreflight,
} from "@/lib/risk/real-trade-preflight";
import {
  isCommercialPaymentOk,
  isLicenseCommerciallyEligible,
  isRobotQuantityWithinPlan,
  isSubscriptionCommerciallyActive,
} from "@/lib/risk/real-trading-commercial";
import { eaOnlineThresholdMs } from "@/lib/risk/real-trading-config";
import { hasUnresolvedProtectionBlock } from "@/lib/risk/execution-protection";
import { REAL_TRADING_REASONS } from "@/lib/risk/real-trading-reasons";

const OPEN_REAL_INSTRUCTION_STATUSES: OrderLogStatus[] = [
  OrderLogStatus.RECEIVED,
  OrderLogStatus.SENT,
  OrderLogStatus.EXECUTED,
  OrderLogStatus.REJECTED,
];

const ELIGIBLE_ROBOT_STATUSES: RobotInstanceStatus[] = [
  RobotInstanceStatus.AWAITING_APPROVAL,
  RobotInstanceStatus.AWAITING_EA_ACTIVATION,
  RobotInstanceStatus.EA_ONLINE,
  RobotInstanceStatus.REAL_PENDING_VALIDATION,
  RobotInstanceStatus.OPERATIONAL_CONTROLLED,
];

export type BulkOrderParams = {
  symbol: string;
  side: "BUY" | "SELL";
  orderType: "MARKET" | "LIMIT" | "STOP";
  orderPrice?: number;
  requestedContracts: number;
  managementPlan: RealManualManagementPlan;
};

export type BulkEligibilitySuccess = {
  eligible: true;
  userId: string;
  licenseId: string;
  userEmail: string;
  userName: string | null;
  accountLogin: string;
  accountServer: string;
  symbol: string;
  magicNumber: number;
  requestedContracts: number;
  maxContracts: number;
  freeMargin: number | null;
  eaOnline: boolean;
  deviceActiveReal: boolean;
  heartbeatAt: string | null;
  approvalId: string;
  accountSnapshotId: string | null;
  openInstructionId: string | null;
};

export type BulkEligibilityFailure = {
  eligible: false;
  userId: string;
  licenseId: string;
  userEmail: string;
  userName: string | null;
  accountLogin: string | null;
  accountServer: string | null;
  symbol: string;
  magicNumber: number | null;
  reasonCode: BulkEligibilityReasonCode;
  reasonDetail: string;
  actionHint: string;
  regularizationLinks: ReturnType<typeof buildBulkRegularizationLinks>;
};

export type BulkEligibilityResult = BulkEligibilitySuccess | BulkEligibilityFailure;

function normalizeAccount(value: string): string {
  return value.trim();
}

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

function block(
  partial: Omit<
    BulkEligibilityFailure,
    "eligible" | "reasonDetail" | "actionHint" | "regularizationLinks"
  > & { reasonDetail?: string }
): BulkEligibilityFailure {
  const reasonDetail =
    partial.reasonDetail ?? BULK_ELIGIBILITY_REASON_MESSAGES[partial.reasonCode];
  return {
    eligible: false,
    userId: partial.userId,
    licenseId: partial.licenseId,
    userEmail: partial.userEmail,
    userName: partial.userName,
    accountLogin: partial.accountLogin,
    accountServer: partial.accountServer,
    symbol: partial.symbol,
    magicNumber: partial.magicNumber,
    reasonCode: partial.reasonCode,
    reasonDetail,
    actionHint: BULK_ELIGIBILITY_ACTION_HINTS[partial.reasonCode],
    regularizationLinks: buildBulkRegularizationLinks({
      userId: partial.userId,
      licenseId: partial.licenseId,
    }),
  };
}

function mapPreflightReasonToBulk(
  reasonCode: string | undefined
): BulkEligibilityReasonCode {
  switch (reasonCode) {
    case REAL_TRADING_REASONS.LICENSE_NOT_ACTIVE:
      return "LICENSE_NOT_ACTIVE";
    case REAL_TRADING_REASONS.SUBSCRIPTION_NOT_ACTIVE:
      return "SUBSCRIPTION_NOT_ACTIVE";
    case REAL_TRADING_REASONS.PAYMENT_NOT_ACTIVE:
      return "PAYMENT_NOT_CONFIRMED";
    case REAL_TRADING_REASONS.APPROVAL_REQUIRED:
      return "REAL_APPROVAL_MISSING";
    case REAL_TRADING_REASONS.APPROVAL_NOT_ACTIVE:
      return "REAL_APPROVAL_MISMATCH";
    case REAL_TRADING_REASONS.SNAPSHOT_REQUIRED:
      return "PRE_MARKET_MISSING";
    case REAL_TRADING_REASONS.EXECUTOR_OFFLINE:
      return "EA_OFFLINE";
    case REAL_TRADING_REASONS.DEVICE_OFFLINE:
      return "DEVICE_NOT_ACTIVE";
    case REAL_TRADING_REASONS.PREVIOUS_PROTECTION_FAILED:
    case REAL_TRADING_REASONS.PROTECTION_PENDING:
      return "PROTECTION_FAILED_BLOCKING";
    case REAL_TRADING_REASONS.MARGIN_INSUFFICIENT:
      return "MARGIN_INSUFFICIENT";
    case REAL_TRADING_REASONS.SYMBOL_MISMATCH:
      return "SYMBOL_MISMATCH";
    case REAL_TRADING_REASONS.MAGIC_MISMATCH:
      return "MAGIC_MISMATCH";
    case REAL_TRADING_REASONS.CONTRACT_LIMIT_EXCEEDED:
      return "REQUESTED_CONTRACTS_EXCEEDS_APPROVAL";
    case REAL_TRADING_REASONS.ACCOUNT_MISMATCH:
      return "MT5_ACCOUNT_NOT_LINKED";
    default:
      return "REAL_APPROVAL_MISMATCH";
  }
}

export async function evaluateBulkLicenseEligibility(input: {
  licenseId: string;
  order: BulkOrderParams;
}): Promise<BulkEligibilityResult> {
  const symbol = normalizeSymbol(input.order.symbol);
  const license = await prisma.license.findUnique({
    where: { id: input.licenseId },
    include: {
      user: { select: { id: true, email: true, name: true, status: true } },
      subscription: { select: { id: true, status: true, adminPaymentStatus: true } },
      mt5Account: { select: { login: true, server: true } },
      robotInstances: {
        select: { id: true, status: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!license?.user) {
    return block({
      userId: "unknown",
      licenseId: input.licenseId,
      userEmail: "—",
      userName: null,
      accountLogin: null,
      accountServer: null,
      symbol,
      magicNumber: null,
      reasonCode: "LICENSE_NOT_ACTIVE",
    });
  }

  const base = {
    userId: license.user.id,
    licenseId: license.id,
    userEmail: license.user.email,
    userName: license.user.name,
    symbol,
    magicNumber: license.expectedMagicNumber,
  };

  if (license.user.status !== UserStatus.ACTIVE) {
    return block({ ...base, accountLogin: null, accountServer: null, reasonCode: "USER_NOT_ACTIVE" });
  }

  if (license.status !== LicenseStatus.ACTIVE) {
    return block({ ...base, accountLogin: null, accountServer: null, reasonCode: "LICENSE_NOT_ACTIVE" });
  }

  const commercial = await isLicenseCommerciallyEligible(license.id);
  if (!commercial.subscriptionId) {
    return block({ ...base, accountLogin: null, accountServer: null, reasonCode: "SUBSCRIPTION_NOT_ACTIVE" });
  }

  const subscriptionOk = await isSubscriptionCommerciallyActive(commercial.subscriptionId);
  if (!subscriptionOk) {
    return block({ ...base, accountLogin: null, accountServer: null, reasonCode: "SUBSCRIPTION_NOT_ACTIVE" });
  }

  const paymentOk = await isCommercialPaymentOk(commercial.subscriptionId);
  if (!paymentOk) {
    return block({ ...base, accountLogin: null, accountServer: null, reasonCode: "PAYMENT_NOT_CONFIRMED" });
  }

  const planOk = await isRobotQuantityWithinPlan(commercial.subscriptionId, 1);
  if (!planOk) {
    return block({ ...base, accountLogin: null, accountServer: null, reasonCode: "PLAN_NOT_COMPATIBLE" });
  }

  const hasRobot = license.robotInstances.some((ri) =>
    ELIGIBLE_ROBOT_STATUSES.includes(ri.status)
  );
  if (!hasRobot) {
    return block({ ...base, accountLogin: null, accountServer: null, reasonCode: "ROBOT_INSTANCE_MISSING" });
  }

  if (!license.mt5Account) {
    return block({ ...base, accountLogin: null, accountServer: null, reasonCode: "MT5_ACCOUNT_NOT_LINKED" });
  }

  const accountLogin = normalizeAccount(license.mt5Account.login);
  const accountServer = normalizeAccount(license.mt5Account.server);

  if (license.expectedTradeMode !== TradeMode.REAL) {
    return block({
      ...base,
      accountLogin,
      accountServer,
      reasonCode: "EXPECTED_TRADE_MODE_NOT_REAL",
    });
  }

  if (
    license.expectedSymbol &&
    normalizeSymbol(license.expectedSymbol) !== symbol
  ) {
    return block({
      ...base,
      accountLogin,
      accountServer,
      reasonCode: "EXPECTED_SYMBOL_MISMATCH",
    });
  }

  if (license.expectedMagicNumber == null) {
    return block({
      ...base,
      accountLogin,
      accountServer,
      magicNumber: null,
      reasonCode: "EXPECTED_MAGIC_MISSING",
    });
  }

  const magicNumber = license.expectedMagicNumber;

  const planValidation = validateManagementPlan({
    plan: input.order.managementPlan,
    requestedContracts: input.order.requestedContracts,
    side: input.order.side,
    entryPrice: input.order.orderPrice ?? null,
  });
  if (planValidation) {
    return block({
      ...base,
      accountLogin,
      accountServer,
      magicNumber,
      reasonCode: "MANAGEMENT_PLAN_INVALID",
      reasonDetail: planValidation.message,
    });
  }

  const threshold = new Date(Date.now() - eaOnlineThresholdMs());
  const latestHb = await prisma.eaHeartbeat.findFirst({
    where: { licenseId: license.id },
    orderBy: { receivedAt: "desc" },
    select: {
      receivedAt: true,
      eaStatus: true,
      tradeMode: true,
      deviceId: true,
      reportPayload: true,
    },
  });

  if (!latestHb || latestHb.receivedAt < threshold) {
    return block({
      ...base,
      accountLogin,
      accountServer,
      magicNumber,
      reasonCode: "HEARTBEAT_STALE",
    });
  }

  if (latestHb.eaStatus !== "ONLINE") {
    return block({
      ...base,
      accountLogin,
      accountServer,
      magicNumber,
      reasonCode: "EA_OFFLINE",
    });
  }

  if (latestHb.tradeMode !== TradeMode.REAL) {
    return block({
      ...base,
      accountLogin,
      accountServer,
      magicNumber,
      reasonCode: "DEVICE_NOT_REAL",
    });
  }

  const activeDevice = await prisma.device.findFirst({
    where: {
      licenseId: license.id,
      deviceId: latestHb.deviceId,
      ...ACTIVE_DEVICE_WHERE,
    },
    select: { id: true },
  });
  if (!activeDevice) {
    return block({
      ...base,
      accountLogin,
      accountServer,
      magicNumber,
      reasonCode: "DEVICE_NOT_ACTIVE",
    });
  }

  const approval = await findActiveRealTradingApproval(
    license.id,
    license.user.id,
    accountLogin,
    accountServer,
    symbol,
    magicNumber
  );
  if (!approval) {
    return block({
      ...base,
      accountLogin,
      accountServer,
      magicNumber,
      reasonCode: "REAL_APPROVAL_MISSING",
    });
  }

  if (input.order.requestedContracts > approval.maxContracts) {
    return block({
      ...base,
      accountLogin,
      accountServer,
      magicNumber,
      reasonCode: "REQUESTED_CONTRACTS_EXCEEDS_APPROVAL",
    });
  }

  const preMarket = await hasPreMarketSnapshotToday(
    license.id,
    accountLogin,
    accountServer
  );
  if (!preMarket.ok) {
    return block({
      ...base,
      accountLogin,
      accountServer,
      magicNumber,
      reasonCode: "PRE_MARKET_MISSING",
    });
  }

  const protectionBlock = await hasUnresolvedProtectionBlock(license.id, magicNumber);
  if (protectionBlock) {
    return block({
      ...base,
      accountLogin,
      accountServer,
      magicNumber,
      reasonCode: "PROTECTION_FAILED_BLOCKING",
    });
  }

  const openInstruction = await prisma.instruction.findFirst({
    where: {
      licenseId: license.id,
      source: InstructionSource.REAL_MANUAL,
      symbol,
      magicNumber,
      currentStatus: { in: OPEN_REAL_INSTRUCTION_STATUSES },
    },
    select: { id: true },
  });
  if (openInstruction) {
    return {
      ...block({
        ...base,
        accountLogin,
        accountServer,
        magicNumber,
        reasonCode: "OPEN_REAL_INSTRUCTION_EXISTS",
      }),
      regularizationLinks: buildBulkRegularizationLinks({
        userId: license.user.id,
        licenseId: license.id,
        instructionId: openInstruction.id,
      }),
    };
  }

  const payload =
    latestHb.reportPayload &&
    typeof latestHb.reportPayload === "object" &&
    !Array.isArray(latestHb.reportPayload)
      ? (latestHb.reportPayload as {
          open_positions?: Array<{ symbol?: string; magic?: number; magic_number?: number }>;
          pending_orders?: Array<{ symbol?: string; magic?: number; magic_number?: number }>;
        })
      : {};

  const matchesExposure = (row: { symbol?: string; magic?: number; magic_number?: number }) => {
    const rowSymbol = (row.symbol ?? "").toUpperCase();
    if (rowSymbol !== symbol) return false;
    const rowMagic =
      typeof row.magic_number === "number"
        ? row.magic_number
        : typeof row.magic === "number"
          ? row.magic
          : null;
    return rowMagic == null || rowMagic === magicNumber;
  };

  const hasOpenExposure =
    (payload.open_positions ?? []).some(matchesExposure) ||
    (payload.pending_orders ?? []).some(matchesExposure);
  if (hasOpenExposure) {
    return block({
      ...base,
      accountLogin,
      accountServer,
      magicNumber,
      reasonCode: "OPEN_POSITION_OR_PENDING_ORDER_EXISTS",
    });
  }

  const preflight = await runRealTradePreflight({
    userId: license.user.id,
    licenseId: license.id,
    accountLogin,
    accountServer,
    symbol,
    magicNumber,
    requestedContracts: input.order.requestedContracts,
    dryRun: true,
    persist: false,
  });

  if (!preflight.passed) {
    const bulkReason = mapPreflightReasonToBulk(preflight.reasonCode);
    return block({
      ...base,
      accountLogin,
      accountServer,
      magicNumber,
      reasonCode: bulkReason,
      reasonDetail: preflight.reason ?? BULK_ELIGIBILITY_REASON_MESSAGES[bulkReason],
    });
  }

  let freeMargin: number | null = null;
  if (preMarket.snapshotId) {
    const snap = await prisma.accountSnapshot.findUnique({
      where: { id: preMarket.snapshotId },
      select: { freeMargin: true },
    });
    if (snap?.freeMargin != null) freeMargin = Number(snap.freeMargin);
  }

  const eaOnline = await isEaExecutorOnline(license.id);

  return {
    eligible: true,
    userId: license.user.id,
    licenseId: license.id,
    userEmail: license.user.email,
    userName: license.user.name,
    accountLogin,
    accountServer,
    symbol,
    magicNumber,
    requestedContracts: input.order.requestedContracts,
    maxContracts: approval.maxContracts,
    freeMargin,
    eaOnline,
    deviceActiveReal: latestHb.tradeMode === TradeMode.REAL && Boolean(activeDevice),
    heartbeatAt: latestHb.receivedAt.toISOString(),
    approvalId: approval.id,
    accountSnapshotId: preMarket.snapshotId ?? null,
    openInstructionId: null,
  };
}

export async function listBulkCandidateLicenseIds(): Promise<string[]> {
  const rows = await prisma.license.findMany({
    where: { subscriptionId: { not: null } },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => r.id);
}
