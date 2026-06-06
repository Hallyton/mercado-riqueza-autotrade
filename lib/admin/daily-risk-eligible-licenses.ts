import {
  LicenseStatus,
  UserStatus,
  type DailyFinancialRiskLimit,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { MR_FIBO_D1_GUARD_CODE } from "@/lib/risk/autonomous-strategy-reasons";

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
  operationalStatus: DailyRiskOperationalStatus;
  selectable: boolean;
};

function resolveStrategyCode(
  robotStrategyCode: string | null | undefined
): string {
  if (robotStrategyCode?.trim()) return robotStrategyCode.trim();
  return MR_FIBO_D1_GUARD_CODE;
}

function findMatchingLimit(
  limits: DailyFinancialRiskLimit[],
  input: {
    accountLogin: string;
    accountServer: string;
    symbol: string;
    strategyCode: string;
  }
): DailyFinancialRiskLimit | undefined {
  return limits.find(
    (limit) =>
      limit.accountLogin === input.accountLogin &&
      limit.accountServer === input.accountServer &&
      limit.symbol === input.symbol.toUpperCase() &&
      limit.strategyCode === input.strategyCode
  );
}

function deriveOperationalStatus(input: {
  hasMt5: boolean;
  autonomousStrategyEnabled: boolean;
  existing: DailyFinancialRiskLimit | undefined;
}): DailyRiskOperationalStatus {
  if (!input.hasMt5) return "NO_MT5_ACCOUNT";
  if (!input.autonomousStrategyEnabled) return "STRATEGY_NOT_ENABLED";
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

    const existing = hasMt5 && symbol
      ? findMatchingLimit(license.dailyFinancialRiskLimits, {
          accountLogin: accountLogin!,
          accountServer: accountServer!,
          symbol,
          strategyCode,
        })
      : undefined;

    const operationalStatus = deriveOperationalStatus({
      hasMt5,
      autonomousStrategyEnabled,
      existing,
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
      existingDailyRiskLimit: existing
        ? {
            id: existing.id,
            enabled: existing.enabled,
            dailyLossLimitCents: existing.dailyLossLimitCents,
            includeOpenPnL: existing.includeOpenPnL,
            updatedAt: existing.updatedAt.toISOString(),
          }
        : null,
      operationalStatus,
      selectable,
    };
  });
}
