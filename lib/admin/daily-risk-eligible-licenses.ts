import {
  LicenseStatus,
  UserStatus,
  type DailyFinancialRiskLimit,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { MR_FIBO_D1_GUARD_CODE } from "@/lib/risk/autonomous-strategy-reasons";
import {
  buildDailyRiskLinkageDetail,
  resolveFiboDailyRiskLimit,
} from "@/lib/admin/daily-risk-limit-resolver";
import { normalizeFiboStrategyCode } from "@/lib/strategy/normalize-strategy-code";

export type DailyRiskOperationalStatus =
  | "CONFIGURED"
  | "NOT_CONFIGURED"
  | "INACTIVE"
  | "NO_MT5_ACCOUNT"
  | "STRATEGY_NOT_ENABLED";

export type DailyRiskExistingLimitSummary = {
  id: string;
  enabled: boolean;
  dailyLossLimitCents: number;
  includeOpenPnL: boolean;
  updatedAt: string;
};

export type DailyRiskEligibleLicense = {
  licenseId: string;
  userId: string;
  clientName: string | null;
  clientEmail: string;
  accountLogin: string | null;
  accountServer: string | null;
  symbol: string | null;
  magicNumber: number | null;
  strategyCode: string;
  licenseStatus: LicenseStatus;
  robotInstanceId: string | null;
  autonomousStrategyEnabled: boolean;
  existingDailyRiskLimit: DailyRiskExistingLimitSummary | null;
  storedStrategyCode: string | null;
  strategyCodeMismatch: boolean;
  operationalStatus: DailyRiskOperationalStatus;
  selectable: boolean;
};

function resolveStrategyCode(
  robotStrategyCode: string | null | undefined
): string {
  return normalizeFiboStrategyCode(robotStrategyCode);
}

function findMatchingLimit(
  limits: DailyFinancialRiskLimit[],
  input: {
    accountLogin: string;
    accountServer: string;
    symbol: string;
  }
): {
  summary: DailyRiskExistingLimitSummary | null;
  storedStrategyCode: string | null;
  strategyCodeMismatch: boolean;
} {
  const resolved = resolveFiboDailyRiskLimit(limits, input);
  const effective = resolved.canonical ?? resolved.effective;
  if (!effective) {
    return {
      summary: null,
      storedStrategyCode: resolved.aliasLimits[0]?.strategyCode ?? null,
      strategyCodeMismatch: resolved.strategyMismatch,
    };
  }
  return {
    summary: {
      id: effective.id,
      enabled: effective.enabled,
      dailyLossLimitCents: effective.dailyLossLimitCents,
      includeOpenPnL: effective.includeOpenPnL,
      updatedAt: effective.updatedAt.toISOString(),
    },
    storedStrategyCode: effective.strategyCode,
    strategyCodeMismatch: resolved.strategyMismatch,
  };
}

function deriveOperationalStatus(input: {
  hasMt5: boolean;
  autonomousStrategyEnabled: boolean;
  existing: DailyRiskExistingLimitSummary | null;
  strategyCodeMismatch: boolean;
}): DailyRiskOperationalStatus {
  if (!input.hasMt5) return "NO_MT5_ACCOUNT";
  if (!input.autonomousStrategyEnabled) return "STRATEGY_NOT_ENABLED";
  if (input.strategyCodeMismatch) return "NOT_CONFIGURED";
  if (!input.existing) return "NOT_CONFIGURED";
  if (!input.existing.enabled) return "INACTIVE";
  return "CONFIGURED";
}

export function formatDailyRiskLicenseLabel(license: DailyRiskEligibleLicense): string {
  const name = license.clientName?.trim() || license.clientEmail;
  const account =
    license.accountLogin && license.accountServer
      ? `${license.accountLogin} @ ${license.accountServer}`
      : "sem conta MT5";
  const symbol = license.symbol ?? "—";
  return `${name} — ${license.clientEmail} — ${account} — ${symbol} — ${license.strategyCode}`;
}

export async function listDailyRiskEligibleLicenses(): Promise<
  DailyRiskEligibleLicense[]
> {
  const licenses = await prisma.license.findMany({
    where: {
      status: LicenseStatus.ACTIVE,
      user: { status: UserStatus.ACTIVE },
    },
    include: {
      user: { select: { email: true, name: true, status: true } },
      mt5Account: { select: { login: true, server: true } },
      robotInstances: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      dailyFinancialRiskLimits: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return licenses.map((license) => {
    const robot = license.robotInstances[0] ?? null;
    const accountLogin =
      license.mt5Account?.login ?? license.expectedAccountLogin ?? null;
    const accountServer =
      license.mt5Account?.server ?? license.expectedAccountServer ?? null;
    const symbol = robot?.symbol ?? license.expectedSymbol ?? null;
    const magicNumber = robot?.magicNumber ?? license.expectedMagicNumber ?? null;
    const strategyCode = resolveStrategyCode(robot?.autonomousStrategyCode);
    const autonomousStrategyEnabled = robot?.autonomousStrategyEnabled ?? false;
    const hasMt5 = Boolean(
      license.mt5Account?.login &&
        license.mt5Account?.server &&
        accountLogin &&
        accountServer
    );

    const existingMatch = hasMt5 && symbol
      ? findMatchingLimit(license.dailyFinancialRiskLimits, {
          accountLogin: accountLogin!,
          accountServer: accountServer!,
          symbol,
        })
      : {
          summary: null,
          storedStrategyCode: null,
          strategyCodeMismatch: false,
        };

    const operationalStatus = deriveOperationalStatus({
      hasMt5,
      autonomousStrategyEnabled,
      existing: existingMatch.summary,
      strategyCodeMismatch: existingMatch.strategyCodeMismatch,
    });

    const selectable =
      hasMt5 &&
      Boolean(symbol) &&
      Boolean(accountLogin) &&
      Boolean(accountServer) &&
      (autonomousStrategyEnabled ||
        robot?.autonomousStrategyCode === MR_FIBO_D1_GUARD_CODE ||
        strategyCode === MR_FIBO_D1_GUARD_CODE);

    return {
      licenseId: license.id,
      userId: license.userId,
      clientName: license.user.name,
      clientEmail: license.user.email,
      accountLogin,
      accountServer,
      symbol,
      magicNumber,
      strategyCode,
      licenseStatus: license.status,
      robotInstanceId: robot?.id ?? null,
      autonomousStrategyEnabled,
      existingDailyRiskLimit: existingMatch.summary,
      storedStrategyCode: existingMatch.storedStrategyCode,
      strategyCodeMismatch: existingMatch.strategyCodeMismatch,
      operationalStatus,
      selectable,
    };
  });
}
