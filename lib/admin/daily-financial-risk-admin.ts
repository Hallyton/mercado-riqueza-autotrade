import {
  LicenseStatus,
  UserStatus,
  type DailyFinancialRiskLimit,
} from "@prisma/client";
import { recordAdminAction } from "@/lib/admin/record-action";
import { normalizeFiboDailyRiskStrategyCodes } from "@/lib/admin/normalize-fibo-daily-risk-records";
import { resolveFiboDailyRiskLimit } from "@/lib/admin/daily-risk-limit-resolver";
import prisma from "@/lib/prisma";
import { MR_FIBO_D1_GUARD_CODE } from "@/lib/risk/autonomous-strategy-reasons";
import { maskAccountLogin, maskLicenseId } from "@/lib/risk/real-trading-guard-status";
import { tradeDateKeySaoPaulo } from "@/lib/risk/daily-financial-risk";
import { normalizeFiboStrategyCode } from "@/lib/strategy/normalize-strategy-code";

export const DAILY_RISK_ADMIN_ERROR_CODES = [
  "LICENSE_NOT_FOUND",
  "LICENSE_NOT_ACTIVE",
  "USER_NOT_ACTIVE",
  "MT5_ACCOUNT_MISSING",
  "MT5_ACCOUNT_MISMATCH",
  "DAILY_LIMIT_INVALID",
  "SYMBOL_REQUIRED",
  "STRATEGY_CODE_REQUIRED",
  "ACCOUNT_FIELDS_REQUIRED",
] as const;

export type DailyRiskAdminErrorCode =
  (typeof DAILY_RISK_ADMIN_ERROR_CODES)[number];

export class DailyFinancialRiskAdminError extends Error {
  constructor(
    message: string,
    public readonly code: DailyRiskAdminErrorCode,
    public readonly status: number,
    public readonly options?: {
      detail?: string;
      actionHint?: string;
      editLimitId?: string;
    }
  ) {
    super(message);
    this.name = "DailyFinancialRiskAdminError";
  }

  toPayload() {
    return {
      ok: false as const,
      code: this.code,
      message: this.message,
      detail: this.options?.detail,
      actionHint: this.options?.actionHint,
      editLimitId: this.options?.editLimitId,
    };
  }
}

export type DailyRiskExistingConfigView = {
  id: string;
  licenseId: string;
  clientName: string | null;
  clientEmail: string;
  accountLogin: string;
  accountServer: string;
  symbol: string;
  strategyCode: string;
  dailyLossLimitBrl: number;
  includeOpenPnL: boolean;
  enabled: boolean;
  updatedAt: string;
};

export async function listDailyFinancialRiskLimits(licenseId?: string) {
  return prisma.dailyFinancialRiskLimit.findMany({
    where: licenseId ? { licenseId } : undefined,
    include: {
      license: {
        select: {
          id: true,
          user: { select: { email: true, name: true } },
          mt5Account: { select: { login: true, server: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
}

export async function listDailyRiskExistingConfigViews(
  licenseId?: string
): Promise<DailyRiskExistingConfigView[]> {
  const rows = await listDailyFinancialRiskLimits(licenseId);
  return rows.map((row) => ({
    id: row.id,
    licenseId: row.licenseId,
    clientName: row.license.user.name,
    clientEmail: row.license.user.email,
    accountLogin: row.accountLogin,
    accountServer: row.accountServer,
    symbol: row.symbol,
    strategyCode: row.strategyCode,
    dailyLossLimitBrl: row.dailyLossLimitCents / 100,
    includeOpenPnL: row.includeOpenPnL,
    enabled: row.enabled,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

function uniqueKey(input: {
  licenseId: string;
  accountLogin: string;
  accountServer: string;
  symbol: string;
  strategyCode: string;
}) {
  return {
    licenseId_accountLogin_accountServer_strategyCode_symbol: {
      licenseId: input.licenseId,
      accountLogin: input.accountLogin.trim(),
      accountServer: input.accountServer.trim(),
      strategyCode: input.strategyCode,
      symbol: input.symbol.trim().toUpperCase(),
    },
  };
}

export async function findExistingDailyFinancialRiskLimit(input: {
  licenseId: string;
  accountLogin: string;
  accountServer: string;
  symbol: string;
  strategyCode: string;
}): Promise<DailyFinancialRiskLimit | null> {
  return prisma.dailyFinancialRiskLimit.findUnique({
    where: uniqueKey(input),
  });
}

export async function upsertDailyFinancialRiskLimit(input: {
  licenseId: string;
  accountLogin: string;
  accountServer: string;
  symbol: string;
  strategyCode?: string;
  enabled: boolean;
  dailyLossLimitBrl: number;
  includeOpenPnL: boolean;
  resetTimezone?: string;
  resetAtTime?: string;
}) {
  const strategyCode = normalizeFiboStrategyCode(
    input.strategyCode ?? MR_FIBO_D1_GUARD_CODE
  );
  const dailyLossLimitCents = Math.round(input.dailyLossLimitBrl * 100);

  return prisma.dailyFinancialRiskLimit.upsert({
    where: uniqueKey({
      licenseId: input.licenseId,
      accountLogin: input.accountLogin,
      accountServer: input.accountServer,
      symbol: input.symbol,
      strategyCode,
    }),
    create: {
      licenseId: input.licenseId,
      accountLogin: input.accountLogin.trim(),
      accountServer: input.accountServer.trim(),
      strategyCode,
      symbol: input.symbol.trim().toUpperCase(),
      enabled: input.enabled,
      dailyLossLimitCents,
      includeOpenPnL: input.includeOpenPnL,
      resetTimezone: input.resetTimezone ?? "America/Sao_Paulo",
      resetAtTime: input.resetAtTime ?? "00:00",
    },
    update: {
      enabled: input.enabled,
      dailyLossLimitCents,
      includeOpenPnL: input.includeOpenPnL,
      resetTimezone: input.resetTimezone ?? "America/Sao_Paulo",
      resetAtTime: input.resetAtTime ?? "00:00",
    },
  });
}

export async function upsertDailyFinancialRiskLimitValidated(input: {
  licenseId: string;
  accountLogin: string;
  accountServer: string;
  symbol: string;
  strategyCode?: string;
  enabled: boolean;
  dailyLossLimitBrl: number;
  includeOpenPnL: boolean;
  resetTimezone?: string;
  resetAtTime?: string;
  actorId: string;
  ipAddress?: string | null;
}) {
  const strategyCode = normalizeFiboStrategyCode(input.strategyCode);

  if (!input.licenseId.trim()) {
    throw new DailyFinancialRiskAdminError(
      "Licença obrigatória.",
      "LICENSE_NOT_FOUND",
      400
    );
  }
  if (!input.accountLogin.trim() || !input.accountServer.trim()) {
    throw new DailyFinancialRiskAdminError(
      "Conta login e servidor são obrigatórios.",
      "ACCOUNT_FIELDS_REQUIRED",
      400
    );
  }
  if (!input.symbol.trim()) {
    throw new DailyFinancialRiskAdminError(
      "Símbolo obrigatório.",
      "SYMBOL_REQUIRED",
      400
    );
  }
  if (!strategyCode) {
    throw new DailyFinancialRiskAdminError(
      "Estratégia obrigatória.",
      "STRATEGY_CODE_REQUIRED",
      400
    );
  }
  if (!(input.dailyLossLimitBrl > 0)) {
    throw new DailyFinancialRiskAdminError(
      "Limite diário deve ser maior que zero.",
      "DAILY_LIMIT_INVALID",
      400,
      { actionHint: "Informe um valor em reais, ex.: 500." }
    );
  }

  const license = await prisma.license.findUnique({
    where: { id: input.licenseId },
    include: {
      user: { select: { status: true } },
      mt5Account: { select: { login: true, server: true } },
    },
  });

  if (!license) {
    throw new DailyFinancialRiskAdminError(
      "Licença não encontrada.",
      "LICENSE_NOT_FOUND",
      404,
      { actionHint: "Selecione uma licença ativa da lista." }
    );
  }
  if (license.status !== LicenseStatus.ACTIVE) {
    throw new DailyFinancialRiskAdminError(
      "Licença não está ativa.",
      "LICENSE_NOT_ACTIVE",
      409,
      { detail: `Status atual: ${license.status}` }
    );
  }
  if (license.user.status !== UserStatus.ACTIVE) {
    throw new DailyFinancialRiskAdminError(
      "Usuário da licença não está ativo.",
      "USER_NOT_ACTIVE",
      409
    );
  }
  if (!license.mt5Account) {
    throw new DailyFinancialRiskAdminError(
      "Licença sem conta MT5 vinculada.",
      "MT5_ACCOUNT_MISSING",
      409,
      { actionHint: "Vincule a conta MT5 na licença antes de configurar o stop." }
    );
  }

  const login = input.accountLogin.trim();
  const server = input.accountServer.trim();
  if (
    license.mt5Account.login !== login ||
    license.mt5Account.server !== server
  ) {
    throw new DailyFinancialRiskAdminError(
      "Conta informada não corresponde à conta MT5 vinculada à licença.",
      "MT5_ACCOUNT_MISMATCH",
      409,
      {
        detail: `Esperado: ${maskAccountLogin(license.mt5Account.login)} @ ${license.mt5Account.server}`,
        actionHint: "Selecione a licença na lista para preencher automaticamente.",
      }
    );
  }

  const existing = await findExistingDailyFinancialRiskLimit({
    licenseId: input.licenseId,
    accountLogin: login,
    accountServer: server,
    symbol: input.symbol,
    strategyCode,
  });

  const row = await upsertDailyFinancialRiskLimit({
    licenseId: input.licenseId,
    accountLogin: login,
    accountServer: server,
    symbol: input.symbol,
    strategyCode,
    enabled: input.enabled,
    dailyLossLimitBrl: input.dailyLossLimitBrl,
    includeOpenPnL: input.includeOpenPnL,
    resetTimezone: input.resetTimezone,
    resetAtTime: input.resetAtTime,
  });

  await normalizeFiboDailyRiskStrategyCodes({ licenseId: input.licenseId });

  const previousLimitCents = existing?.dailyLossLimitCents ?? null;

  await recordAdminAction({
    actorId: input.actorId,
    action: existing ? "daily_risk.limit.updated" : "daily_risk.limit.created",
    targetType: "daily_financial_risk_limit",
    targetId: row.id,
    ipAddress: input.ipAddress,
    metadata: {
      licenseId: maskLicenseId(row.licenseId),
      accountLogin: maskAccountLogin(row.accountLogin),
      accountServer: row.accountServer,
      symbol: row.symbol,
      strategyCode: row.strategyCode,
      previousLimitCents,
      newLimitCents: row.dailyLossLimitCents,
      enabled: row.enabled,
      includeOpenPnL: row.includeOpenPnL,
      timestamp: new Date().toISOString(),
    },
  });

  return {
    item: row,
    created: !existing,
    previousLimitCents,
  };
}

export async function getDailyRiskSnapshotForLicense(licenseId: string) {
  const tradeDate = tradeDateKeySaoPaulo();
  const limits = await prisma.dailyFinancialRiskLimit.findMany({
    where: { licenseId },
  });
  const states = await prisma.dailyFinancialRiskState.findMany({
    where: { licenseId, tradeDate },
  });
  return limits.map((limit) => {
    const state = states.find(
      (s) =>
        s.accountLogin === limit.accountLogin &&
        s.accountServer === limit.accountServer &&
        s.strategyCode === limit.strategyCode &&
        s.symbol === limit.symbol
    );
    return { limit, state };
  });
}

export async function listAutonomousStrategyDecisions(input?: {
  licenseId?: string;
  limit?: number;
}) {
  return prisma.autonomousStrategyDecision.findMany({
    where: input?.licenseId ? { licenseId: input.licenseId } : undefined,
    include: {
      license: {
        select: {
          user: { select: { email: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: input?.limit ?? 100,
  });
}
