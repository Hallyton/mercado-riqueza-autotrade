import {
  RealTradingApprovalStatus,
  StrategyRuntimeConfigStatus,
  type Prisma,
} from "@prisma/client";
import { recordAdminAction } from "@/lib/admin/record-action";
import { getDailyRiskSnapshotForLicense } from "@/lib/admin/daily-financial-risk-admin";
import prisma from "@/lib/prisma";
import {
  MR_FIBO_D1_GUARD_CODE,
  MR_FIBO_D1_GUARD_DISPLAY_NAME,
} from "@/lib/risk/autonomous-strategy-reasons";
import {
  buildDefaultMrFiboD1GuardConfig,
  toEaMrFiboD1GuardStrategyConfig,
  validateMrFiboD1GuardConfigWithContext,
  type MrFiboD1GuardConfig,
} from "@/lib/strategy/mr-fibo-d1-guard-config";
import { hashMrFiboD1GuardConfig } from "@/lib/strategy/mr-fibo-d1-guard-config-hash";

export class StrategyRuntimeConfigError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "StrategyRuntimeConfigError";
  }
}

type LicenseContext = {
  licenseId: string;
  robotInstanceId: string | null;
  strategyCode: string;
  maxContracts: number;
  magicNumber: number | null;
  symbol: string | null;
  mt5Login: string | null;
  mt5Server: string | null;
  autonomousStrategyEnabled: boolean;
  requiresDailyFinancialStop: boolean;
  requiresPreMarket: boolean;
  requiresRealTradingApproval: boolean;
  dailyLossLimitCents: number | null;
  dailyRiskEnabled: boolean;
  pointValueBrl: number | null;
};

async function loadLicenseContext(licenseId: string): Promise<LicenseContext> {
  const license = await prisma.license.findUnique({
    where: { id: licenseId },
    include: {
      mt5Account: { select: { login: true, server: true } },
      robotInstances: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          robotProduct: {
            select: {
              requiresDailyFinancialStop: true,
              requiresPreMarket: true,
              requiresRealTradingApproval: true,
            },
          },
        },
      },
      realTradingApprovals: {
        where: { status: RealTradingApprovalStatus.APPROVED },
        orderBy: { approvedAt: "desc" },
        take: 1,
        select: { maxContracts: true },
      },
    },
  });

  if (!license) {
    throw new StrategyRuntimeConfigError("Licença não encontrada.", "LICENSE_NOT_FOUND", 404);
  }

  const robot = license.robotInstances[0] ?? null;
  const approvalMax = license.realTradingApprovals[0]?.maxContracts ?? null;
  const maxContracts = approvalMax ?? 1;

  const dailyLimit = await prisma.dailyFinancialRiskLimit.findFirst({
    where: {
      licenseId,
      strategyCode: MR_FIBO_D1_GUARD_CODE,
    },
    orderBy: { updatedAt: "desc" },
  });

  const symbol =
    robot?.symbol ?? license.expectedSymbol ?? null;
  const pointValue = symbol
    ? await prisma.instrumentPointValue.findFirst({
        where: { symbol: symbol.toUpperCase() },
        select: { centsPerPointPerContract: true },
      })
    : null;

  return {
    licenseId,
    robotInstanceId: robot?.id ?? null,
    strategyCode: MR_FIBO_D1_GUARD_CODE,
    maxContracts,
    magicNumber: robot?.magicNumber ?? license.expectedMagicNumber,
    symbol,
    mt5Login: license.mt5Account?.login ?? license.expectedAccountLogin,
    mt5Server: license.mt5Account?.server ?? license.expectedAccountServer,
    autonomousStrategyEnabled: Boolean(
      robot?.autonomousStrategyEnabled &&
        robot.autonomousStrategyCode === MR_FIBO_D1_GUARD_CODE
    ),
    requiresDailyFinancialStop:
      robot?.robotProduct.requiresDailyFinancialStop ?? true,
    requiresPreMarket: robot?.robotProduct.requiresPreMarket ?? true,
    requiresRealTradingApproval:
      robot?.robotProduct.requiresRealTradingApproval ?? true,
    dailyLossLimitCents: dailyLimit?.dailyLossLimitCents ?? null,
    dailyRiskEnabled: dailyLimit?.enabled ?? false,
    pointValueBrl: pointValue ? pointValue.centsPerPointPerContract / 100 : null,
  };
}

function parseStoredConfig(raw: unknown): MrFiboD1GuardConfig {
  const result = validateMrFiboD1GuardConfigWithContext(raw);
  if (!result.success) {
    return buildDefaultMrFiboD1GuardConfig();
  }
  return result.data;
}

async function appendHistory(input: {
  strategyRuntimeConfigId: string;
  licenseId: string;
  robotInstanceId: string | null;
  strategyCode: string;
  version: number;
  status: StrategyRuntimeConfigStatus;
  config: MrFiboD1GuardConfig;
  configHash: string;
  actorAdminId: string;
  action: string;
  notes?: string | null;
}) {
  await prisma.strategyRuntimeConfigHistory.create({
    data: {
      strategyRuntimeConfigId: input.strategyRuntimeConfigId,
      licenseId: input.licenseId,
      robotInstanceId: input.robotInstanceId,
      strategyCode: input.strategyCode,
      version: input.version,
      status: input.status,
      config: input.config as unknown as Prisma.InputJsonValue,
      configHash: input.configHash,
      actorAdminId: input.actorAdminId,
      action: input.action,
      notes: input.notes ?? null,
    },
  });
}

function serializeConfigRow(row: {
  id: string;
  version: number;
  status: StrategyRuntimeConfigStatus;
  config: unknown;
  configHash: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  publishedBy: { id: string; name: string | null; email: string } | null;
  createdBy: { id: string; name: string | null; email: string };
}) {
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    config: parseStoredConfig(row.config),
    configHash: row.configHash,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    publishedBy: row.publishedBy
      ? {
          id: row.publishedBy.id,
          name: row.publishedBy.name,
          email: row.publishedBy.email,
        }
      : null,
    createdBy: {
      id: row.createdBy.id,
      name: row.createdBy.name,
      email: row.createdBy.email,
    },
  };
}

const configInclude = {
  createdBy: { select: { id: true, name: true, email: true } },
  publishedBy: { select: { id: true, name: true, email: true } },
} as const;

export async function getStrategyConfigAdminView(licenseId: string) {
  const ctx = await loadLicenseContext(licenseId);
  const dailySnapshots = await getDailyRiskSnapshotForLicense(licenseId);

  const [draft, published, historyCount] = await Promise.all([
    prisma.strategyRuntimeConfig.findFirst({
      where: {
        licenseId,
        strategyCode: MR_FIBO_D1_GUARD_CODE,
        status: StrategyRuntimeConfigStatus.DRAFT,
      },
      orderBy: { updatedAt: "desc" },
      include: configInclude,
    }),
    prisma.strategyRuntimeConfig.findFirst({
      where: {
        licenseId,
        strategyCode: MR_FIBO_D1_GUARD_CODE,
        status: StrategyRuntimeConfigStatus.PUBLISHED,
      },
      orderBy: { version: "desc" },
      include: configInclude,
    }),
    prisma.strategyRuntimeConfigHistory.count({
      where: { licenseId, strategyCode: MR_FIBO_D1_GUARD_CODE },
    }),
  ]);

  const workingConfig =
    draft?.config != null
      ? parseStoredConfig(draft.config)
      : published?.config != null
        ? parseStoredConfig(published.config)
        : buildDefaultMrFiboD1GuardConfig();

  const blockers: string[] = [];
  if (!ctx.robotInstanceId) blockers.push("ROBOT_INSTANCE_MISSING");
  if (ctx.requiresDailyFinancialStop && !ctx.dailyRiskEnabled) {
    blockers.push("DAILY_FINANCIAL_STOP_NOT_CONFIGURED");
  }
  if (!ctx.autonomousStrategyEnabled) {
    blockers.push("AUTONOMOUS_STRATEGY_DISABLED");
  }

  return {
    licenseId: ctx.licenseId,
    robotInstanceId: ctx.robotInstanceId,
    strategyCode: MR_FIBO_D1_GUARD_CODE,
    strategyName: MR_FIBO_D1_GUARD_DISPLAY_NAME,
    identification: {
      licenseId: ctx.licenseId,
      robotInstanceId: ctx.robotInstanceId,
      mt5Account: ctx.mt5Login && ctx.mt5Server ? `${ctx.mt5Login}@${ctx.mt5Server}` : null,
      symbol: ctx.symbol,
      magicNumber: ctx.magicNumber,
      maxContracts: ctx.maxContracts,
    },
    platformPolicy: {
      permitirEstrategiaAutonomaDemo: true,
      permitirEstrategiaAutonomaRealSomenteViaSite: true,
      requerDailyFinancialStop: ctx.requiresDailyFinancialStop,
      requerPreMarket: ctx.requiresPreMarket,
      requerApproval: ctx.requiresRealTradingApproval,
    },
    config: workingConfig,
    draft: draft ? serializeConfigRow(draft) : null,
    published: published ? serializeConfigRow(published) : null,
    dailyRisk: dailySnapshots.map(({ limit, state }) => ({
      enabled: limit.enabled,
      dailyLossLimitBrl: limit.dailyLossLimitCents / 100,
      includeOpenPnL: limit.includeOpenPnL,
      symbol: limit.symbol,
      currentPnlBrl: state ? state.totalPnlCents / 100 : 0,
      remainingLossBrl: state ? state.remainingLossCents / 100 : limit.dailyLossLimitCents / 100,
      status: state?.status ?? (limit.enabled ? "OK" : "DISABLED"),
    })),
    blockers,
    historyCount,
    eaSyncNotice:
      "Alterações só entram em vigor após o EA buscar nova configuração via heartbeat/config.",
  };
}

export async function saveStrategyConfigDraft(input: {
  licenseId: string;
  config: unknown;
  notes?: string | null;
  actorId: string;
  ipAddress?: string | null;
}) {
  const ctx = await loadLicenseContext(input.licenseId);
  const validated = validateMrFiboD1GuardConfigWithContext(input.config, {
    maxContracts: ctx.maxContracts,
    dailyLossLimitCents: ctx.dailyLossLimitCents,
    pointValueBrl: ctx.pointValueBrl,
  });
  if (!validated.success) {
    throw new StrategyRuntimeConfigError(
      validated.error.issues.map((i) => i.message).join("; "),
      "INVALID_CONFIG",
      400
    );
  }

  const config = validated.data;
  const configHash = hashMrFiboD1GuardConfig(config);

  const existingDraft = await prisma.strategyRuntimeConfig.findFirst({
    where: {
      licenseId: input.licenseId,
      strategyCode: MR_FIBO_D1_GUARD_CODE,
      status: StrategyRuntimeConfigStatus.DRAFT,
    },
    orderBy: { updatedAt: "desc" },
  });

  const published = await prisma.strategyRuntimeConfig.findFirst({
    where: {
      licenseId: input.licenseId,
      strategyCode: MR_FIBO_D1_GUARD_CODE,
      status: StrategyRuntimeConfigStatus.PUBLISHED,
    },
    orderBy: { version: "desc" },
  });

  const previousHash =
    existingDraft?.configHash ?? published?.configHash ?? null;

  let row;
  if (existingDraft) {
    row = await prisma.strategyRuntimeConfig.update({
      where: { id: existingDraft.id },
      data: {
        config: config as unknown as Prisma.InputJsonValue,
        configHash,
        notes: input.notes ?? existingDraft.notes,
        robotInstanceId: ctx.robotInstanceId,
      },
      include: configInclude,
    });
  } else {
    const nextVersion = (published?.version ?? 0) + 1;
    row = await prisma.strategyRuntimeConfig.create({
      data: {
        licenseId: input.licenseId,
        robotInstanceId: ctx.robotInstanceId,
        strategyCode: MR_FIBO_D1_GUARD_CODE,
        version: nextVersion,
        status: StrategyRuntimeConfigStatus.DRAFT,
        config: config as unknown as Prisma.InputJsonValue,
        configHash,
        createdByAdminId: input.actorId,
        notes: input.notes ?? null,
      },
      include: configInclude,
    });
  }

  await appendHistory({
    strategyRuntimeConfigId: row.id,
    licenseId: input.licenseId,
    robotInstanceId: ctx.robotInstanceId,
    strategyCode: MR_FIBO_D1_GUARD_CODE,
    version: row.version,
    status: row.status,
    config,
    configHash,
    actorAdminId: input.actorId,
    action: "strategy_config.draft_saved",
    notes: input.notes ?? null,
  });

  await recordAdminAction({
    actorId: input.actorId,
    action: "strategy_config.draft_saved",
    targetType: "license",
    targetId: input.licenseId,
    ipAddress: input.ipAddress,
    metadata: {
      licenseId: input.licenseId,
      robotInstanceId: ctx.robotInstanceId,
      strategyCode: MR_FIBO_D1_GUARD_CODE,
      previousConfigHash: previousHash,
      newConfigHash: configHash,
      version: row.version,
    },
  });

  return serializeConfigRow(row);
}

export async function publishStrategyConfig(input: {
  licenseId: string;
  notes?: string | null;
  actorId: string;
  ipAddress?: string | null;
  allowWithoutDailyStop?: boolean;
}) {
  const ctx = await loadLicenseContext(input.licenseId);

  if (
    ctx.requiresDailyFinancialStop &&
    !ctx.dailyRiskEnabled &&
    !input.allowWithoutDailyStop
  ) {
    throw new StrategyRuntimeConfigError(
      "Configure o stop financeiro diário antes de publicar.",
      "DAILY_FINANCIAL_STOP_NOT_CONFIGURED",
      409
    );
  }

  const draft = await prisma.strategyRuntimeConfig.findFirst({
    where: {
      licenseId: input.licenseId,
      strategyCode: MR_FIBO_D1_GUARD_CODE,
      status: StrategyRuntimeConfigStatus.DRAFT,
    },
    orderBy: { updatedAt: "desc" },
    include: configInclude,
  });

  if (!draft) {
    throw new StrategyRuntimeConfigError(
      "Nenhum rascunho para publicar.",
      "DRAFT_NOT_FOUND",
      404
    );
  }

  const config = parseStoredConfig(draft.config);
  const validated = validateMrFiboD1GuardConfigWithContext(config, {
    maxContracts: ctx.maxContracts,
    dailyLossLimitCents: ctx.dailyLossLimitCents,
    pointValueBrl: ctx.pointValueBrl,
  });
  if (!validated.success) {
    throw new StrategyRuntimeConfigError(
      validated.error.issues.map((i) => i.message).join("; "),
      "INVALID_CONFIG",
      400
    );
  }

  const previousPublished = await prisma.strategyRuntimeConfig.findFirst({
    where: {
      licenseId: input.licenseId,
      strategyCode: MR_FIBO_D1_GUARD_CODE,
      status: StrategyRuntimeConfigStatus.PUBLISHED,
    },
    orderBy: { version: "desc" },
  });

  const published = await prisma.$transaction(async (tx) => {
    if (previousPublished) {
      await tx.strategyRuntimeConfig.update({
        where: { id: previousPublished.id },
        data: { status: StrategyRuntimeConfigStatus.ARCHIVED },
      });
    }

    return tx.strategyRuntimeConfig.update({
      where: { id: draft.id },
      data: {
        status: StrategyRuntimeConfigStatus.PUBLISHED,
        publishedByAdminId: input.actorId,
        publishedAt: new Date(),
        notes: input.notes ?? draft.notes,
        robotInstanceId: ctx.robotInstanceId,
      },
      include: configInclude,
    });
  });

  if (previousPublished) {
    await appendHistory({
      strategyRuntimeConfigId: previousPublished.id,
      licenseId: input.licenseId,
      robotInstanceId: ctx.robotInstanceId,
      strategyCode: MR_FIBO_D1_GUARD_CODE,
      version: previousPublished.version,
      status: StrategyRuntimeConfigStatus.ARCHIVED,
      config: parseStoredConfig(previousPublished.config),
      configHash: previousPublished.configHash,
      actorAdminId: input.actorId,
      action: "strategy_config.archived",
      notes: "Substituída por nova publicação.",
    });
  }

  await appendHistory({
    strategyRuntimeConfigId: published.id,
    licenseId: input.licenseId,
    robotInstanceId: ctx.robotInstanceId,
    strategyCode: MR_FIBO_D1_GUARD_CODE,
    version: published.version,
    status: StrategyRuntimeConfigStatus.PUBLISHED,
    config: validated.data,
    configHash: published.configHash,
    actorAdminId: input.actorId,
    action: "strategy_config.published",
    notes: input.notes ?? null,
  });

  await recordAdminAction({
    actorId: input.actorId,
    action: "strategy_config.published",
    targetType: "license",
    targetId: input.licenseId,
    ipAddress: input.ipAddress,
    metadata: {
      licenseId: input.licenseId,
      robotInstanceId: ctx.robotInstanceId,
      strategyCode: MR_FIBO_D1_GUARD_CODE,
      previousConfigHash: previousPublished?.configHash ?? null,
      newConfigHash: published.configHash,
      version: published.version,
      warnings: ctx.autonomousStrategyEnabled
        ? []
        : ["AUTONOMOUS_STRATEGY_DISABLED"],
    },
  });

  return {
    published: serializeConfigRow(published),
    warnings: ctx.autonomousStrategyEnabled
      ? []
      : ["Estratégia autônoma desabilitada — config publicada mas não opera até habilitar."],
  };
}

export async function resetStrategyConfigDefault(input: {
  licenseId: string;
  actorId: string;
  ipAddress?: string | null;
}) {
  const ctx = await loadLicenseContext(input.licenseId);
  const config = buildDefaultMrFiboD1GuardConfig();
  const configHash = hashMrFiboD1GuardConfig(config);

  const existingDraft = await prisma.strategyRuntimeConfig.findFirst({
    where: {
      licenseId: input.licenseId,
      strategyCode: MR_FIBO_D1_GUARD_CODE,
      status: StrategyRuntimeConfigStatus.DRAFT,
    },
    orderBy: { updatedAt: "desc" },
  });

  const published = await prisma.strategyRuntimeConfig.findFirst({
    where: {
      licenseId: input.licenseId,
      strategyCode: MR_FIBO_D1_GUARD_CODE,
      status: StrategyRuntimeConfigStatus.PUBLISHED,
    },
    orderBy: { version: "desc" },
  });

  const previousHash =
    existingDraft?.configHash ?? published?.configHash ?? null;

  let row;
  if (existingDraft) {
    row = await prisma.strategyRuntimeConfig.update({
      where: { id: existingDraft.id },
      data: {
        config: config as unknown as Prisma.InputJsonValue,
        configHash,
        robotInstanceId: ctx.robotInstanceId,
      },
      include: configInclude,
    });
  } else {
    row = await prisma.strategyRuntimeConfig.create({
      data: {
        licenseId: input.licenseId,
        robotInstanceId: ctx.robotInstanceId,
        strategyCode: MR_FIBO_D1_GUARD_CODE,
        version: (published?.version ?? 0) + 1,
        status: StrategyRuntimeConfigStatus.DRAFT,
        config: config as unknown as Prisma.InputJsonValue,
        configHash,
        createdByAdminId: input.actorId,
      },
      include: configInclude,
    });
  }

  await appendHistory({
    strategyRuntimeConfigId: row.id,
    licenseId: input.licenseId,
    robotInstanceId: ctx.robotInstanceId,
    strategyCode: MR_FIBO_D1_GUARD_CODE,
    version: row.version,
    status: row.status,
    config,
    configHash,
    actorAdminId: input.actorId,
    action: "strategy_config.reset_default",
  });

  await recordAdminAction({
    actorId: input.actorId,
    action: "strategy_config.reset_default",
    targetType: "license",
    targetId: input.licenseId,
    ipAddress: input.ipAddress,
    metadata: {
      licenseId: input.licenseId,
      robotInstanceId: ctx.robotInstanceId,
      strategyCode: MR_FIBO_D1_GUARD_CODE,
      previousConfigHash: previousHash,
      newConfigHash: configHash,
      version: row.version,
    },
  });

  return serializeConfigRow(row);
}

export async function archiveStrategyConfigDraft(input: {
  licenseId: string;
  actorId: string;
  ipAddress?: string | null;
}) {
  const ctx = await loadLicenseContext(input.licenseId);
  const draft = await prisma.strategyRuntimeConfig.findFirst({
    where: {
      licenseId: input.licenseId,
      strategyCode: MR_FIBO_D1_GUARD_CODE,
      status: StrategyRuntimeConfigStatus.DRAFT,
    },
    orderBy: { updatedAt: "desc" },
    include: configInclude,
  });

  if (!draft) {
    throw new StrategyRuntimeConfigError(
      "Nenhum rascunho para arquivar.",
      "DRAFT_NOT_FOUND",
      404
    );
  }

  const config = parseStoredConfig(draft.config);
  const archived = await prisma.strategyRuntimeConfig.update({
    where: { id: draft.id },
    data: { status: StrategyRuntimeConfigStatus.ARCHIVED },
    include: configInclude,
  });

  await appendHistory({
    strategyRuntimeConfigId: archived.id,
    licenseId: input.licenseId,
    robotInstanceId: ctx.robotInstanceId,
    strategyCode: MR_FIBO_D1_GUARD_CODE,
    version: archived.version,
    status: StrategyRuntimeConfigStatus.ARCHIVED,
    config,
    configHash: archived.configHash,
    actorAdminId: input.actorId,
    action: "strategy_config.archived",
  });

  await recordAdminAction({
    actorId: input.actorId,
    action: "strategy_config.archived",
    targetType: "license",
    targetId: input.licenseId,
    ipAddress: input.ipAddress,
    metadata: {
      licenseId: input.licenseId,
      robotInstanceId: ctx.robotInstanceId,
      strategyCode: MR_FIBO_D1_GUARD_CODE,
      previousConfigHash: archived.configHash,
      newConfigHash: archived.configHash,
      version: archived.version,
    },
  });

  return serializeConfigRow(archived);
}

export async function getStrategyConfigHistory(licenseId: string, limit = 50) {
  const rows = await prisma.strategyRuntimeConfigHistory.findMany({
    where: { licenseId, strategyCode: MR_FIBO_D1_GUARD_CODE },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      actor: { select: { id: true, name: true, email: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    version: row.version,
    status: row.status,
    configHash: row.configHash,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    actor: {
      id: row.actor.id,
      name: row.actor.name,
      email: row.actor.email,
    },
  }));
}

export async function getPublishedStrategyConfigForEa(licenseId: string) {
  const published = await prisma.strategyRuntimeConfig.findFirst({
    where: {
      licenseId,
      strategyCode: MR_FIBO_D1_GUARD_CODE,
      status: StrategyRuntimeConfigStatus.PUBLISHED,
    },
    orderBy: { version: "desc" },
  });

  if (!published) return null;

  const config = parseStoredConfig(published.config);
  return {
    version: published.version,
    configHash: published.configHash,
    strategyConfig: toEaMrFiboD1GuardStrategyConfig(config),
  };
}
