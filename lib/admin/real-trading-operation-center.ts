import {
  EAOperationalCommandStatus,
  LicenseStatus,
  RealTradingApprovalStatus,
} from "@prisma/client";
import { getPublishedStrategyConfigForEa } from "@/lib/admin/strategy-runtime-config";
import { isEaOffline } from "@/lib/ea/status";
import { ACTIVE_DEVICE_WHERE } from "@/lib/licensing/device-lifecycle";
import { MR_FIBO_D1_GUARD_CODE } from "@/lib/risk/autonomous-strategy-reasons";
import { normalizeFiboStrategyCode } from "@/lib/strategy/normalize-strategy-code";
import prisma from "@/lib/prisma";

export type OperationalStatusBadge =
  | "ONLINE"
  | "OFFLINE"
  | "PAUSADO"
  | "EM OPERACAO"
  | "SEM POSICAO"
  | "PENDENTES ATIVAS"
  | "STOP DIARIO OK"
  | "STOP DIARIO ATINGIDO"
  | "COMANDO PENDENTE"
  | "COMANDO FALHOU";

export type RealTradingOperationRow = {
  licenseId: string;
  userName: string | null;
  userEmail: string;
  accountLogin: string | null;
  accountServer: string | null;
  symbol: string | null;
  magicNumber: number | null;
  strategyCode: string;
  eaOnline: boolean;
  pausedByAdmin: boolean;
  inOperation: boolean;
  hasOpenPosition: boolean;
  positionSide: string | null;
  positionVolume: number | null;
  positionAveragePrice: number | null;
  positionOpenPnlBrl: number;
  realizedPnlDayBrl: number;
  totalPnlDayBrl: number;
  totalPnlMonthBrl: number;
  dailyLimitBrl: number;
  dailyUsedBrl: number;
  dailyRemainingBrl: number;
  dailyStopHit: boolean;
  pendingOrdersCount: number;
  lastHeartbeatAt: string | null;
  lastCommandType: string | null;
  lastCommandStatus: string | null;
  lastCommandAt: string | null;
  badges: OperationalStatusBadge[];
  detailHref: string;
  maxContracts: number | null;
  configuredContracts: number | null;
  contractsInUse: number | null;
  estimatedRiskBrl: number | null;
  configHash: string | null;
  pnlStatus: string | null;
};

export type RealTradingOperationSummary = {
  monitoredClients: number;
  easOnline: number;
  easOffline: number;
  clientsInOperation: number;
  openPositions: number;
  pendingOrders: number;
  consolidatedPnlDayBrl: number;
  consolidatedPnlMonthBrl: number;
  dailyLimitTotalBrl: number;
  dailyUsedTotalBrl: number;
  dailyRemainingTotalBrl: number;
};

function centsToBrl(cents: number): number {
  return cents / 100;
}

function decimalToNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildBadges(row: {
  eaOnline: boolean;
  pausedByAdmin: boolean;
  inOperation: boolean;
  hasOpenPosition: boolean;
  pendingOrdersCount: number;
  dailyStopHit: boolean;
  lastCommandStatus: string | null;
}): OperationalStatusBadge[] {
  const badges: OperationalStatusBadge[] = [];
  badges.push(row.eaOnline ? "ONLINE" : "OFFLINE");
  if (row.pausedByAdmin) badges.push("PAUSADO");
  if (row.inOperation) badges.push("EM OPERACAO");
  if (!row.hasOpenPosition) badges.push("SEM POSICAO");
  if (row.pendingOrdersCount > 0) badges.push("PENDENTES ATIVAS");
  badges.push(row.dailyStopHit ? "STOP DIARIO ATINGIDO" : "STOP DIARIO OK");
  if (
    row.lastCommandStatus === EAOperationalCommandStatus.PENDING ||
    row.lastCommandStatus === EAOperationalCommandStatus.ACKED
  ) {
    badges.push("COMANDO PENDENTE");
  }
  if (row.lastCommandStatus === EAOperationalCommandStatus.FAILED) {
    badges.push("COMANDO FALHOU");
  }
  return badges;
}

async function mapLicenseToRow(
  license: Awaited<ReturnType<typeof loadOperationalLicenses>>[number]
): Promise<RealTradingOperationRow | null> {
  const robot = license.robotInstances[0];
  const accountLogin =
    license.mt5Account?.login ?? license.expectedAccountLogin ?? null;
  const accountServer =
    license.mt5Account?.server ?? license.expectedAccountServer ?? null;
  const symbol = robot?.symbol ?? license.expectedSymbol ?? null;
  const strategyCode = normalizeFiboStrategyCode(
    robot?.autonomousStrategyCode ?? MR_FIBO_D1_GUARD_CODE
  );

  if (!accountLogin || !accountServer || !symbol) return null;

  const device = license.devices[0];
  const eaOnline = device ? !isEaOffline(device.lastSeenAt) : false;

  const snapshot = license.eaOperationalSnapshots[0];
  const control = license.licenseOperationControls.find(
    (c) => c.strategyCode === strategyCode
  );
  const lastCommand = license.eaOperationalCommands[0];
  const published = await getPublishedStrategyConfigForEa(license.id);

  const pausedByAdmin =
    control?.paused ?? snapshot?.pausedByAdmin ?? license.adminHaltNewEntries;
  const hasOpenPosition = snapshot?.hasOpenPosition ?? false;
  const pendingOrdersCount = snapshot?.pendingOrdersCount ?? 0;
  const inOperation =
    hasOpenPosition ||
    pendingOrdersCount > 0 ||
    Boolean(snapshot?.autonomousStrategyEnabled && eaOnline && !pausedByAdmin);

  const dailyLimitBrl = centsToBrl(snapshot?.dailyLimitCents ?? 0);
  const dailyUsedBrl = centsToBrl(snapshot?.dailyUsedCents ?? 0);
  const dailyRemainingBrl = centsToBrl(snapshot?.dailyRemainingCents ?? 0);
  const dailyStopHit = dailyLimitBrl > 0 && dailyRemainingBrl <= 0;

  const configuredContracts =
    published?.strategyConfig &&
    typeof published.strategyConfig === "object" &&
    published.strategyConfig !== null &&
    "maxContractsPerEntry" in published.strategyConfig
      ? Number(
          (published.strategyConfig as { maxContractsPerEntry?: number })
            .maxContractsPerEntry
        )
      : null;

  return {
    licenseId: license.id,
    userName: license.user.name,
    userEmail: license.user.email,
    accountLogin,
    accountServer,
    symbol,
    magicNumber: robot?.magicNumber ?? license.expectedMagicNumber ?? null,
    strategyCode,
    eaOnline,
    pausedByAdmin,
    inOperation,
    hasOpenPosition,
    positionSide: snapshot?.positionSide ?? null,
    positionVolume: decimalToNumber(snapshot?.positionVolume),
    positionAveragePrice: decimalToNumber(snapshot?.positionAveragePrice),
    positionOpenPnlBrl: centsToBrl(snapshot?.positionOpenPnlCents ?? 0),
    realizedPnlDayBrl: centsToBrl(snapshot?.realizedPnlDayCents ?? 0),
    totalPnlDayBrl: centsToBrl(snapshot?.totalPnlDayCents ?? 0),
    totalPnlMonthBrl: centsToBrl(snapshot?.totalPnlMonthCents ?? 0),
    dailyLimitBrl,
    dailyUsedBrl,
    dailyRemainingBrl,
    dailyStopHit,
    pendingOrdersCount,
    lastHeartbeatAt: (snapshot?.lastHeartbeatAt ?? device?.lastSeenAt)?.toISOString() ?? null,
    lastCommandType: lastCommand?.commandType ?? null,
    lastCommandStatus: lastCommand?.status ?? snapshot?.lastCommandStatus ?? null,
    lastCommandAt: lastCommand?.requestedAt.toISOString() ?? null,
    badges: buildBadges({
      eaOnline,
      pausedByAdmin,
      inOperation,
      hasOpenPosition,
      pendingOrdersCount,
      dailyStopHit,
      lastCommandStatus: lastCommand?.status ?? snapshot?.lastCommandStatus ?? null,
    }),
    detailHref: `/admin/real-trading/operations/${license.id}`,
    maxContracts: license.realTradingApprovals[0]?.maxContracts ?? null,
    configuredContracts,
    contractsInUse: hasOpenPosition
      ? decimalToNumber(snapshot?.positionVolume)
      : 0,
    estimatedRiskBrl: dailyLimitBrl > 0 ? dailyLimitBrl : null,
    configHash: published?.configHash ?? snapshot?.rawSnapshotJson
      ? ((snapshot.rawSnapshotJson as Record<string, unknown>)?.strategy_config_hash as string | undefined) ?? null
      : published?.configHash ?? null,
    pnlStatus: snapshot?.pnlStatus ?? null,
  };
}

async function loadOperationalLicenses(licenseId?: string) {
  return prisma.license.findMany({
    where: {
      status: LicenseStatus.ACTIVE,
      realTradingApprovals: {
        some: { status: RealTradingApprovalStatus.APPROVED },
      },
      robotInstances: { some: { autonomousStrategyEnabled: true } },
      ...(licenseId ? { id: licenseId } : {}),
    },
    include: {
      user: { select: { email: true, name: true } },
      mt5Account: true,
      robotInstances: {
        where: { autonomousStrategyEnabled: true },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
      devices: {
        where: ACTIVE_DEVICE_WHERE,
        orderBy: { lastSeenAt: "desc" },
        take: 1,
      },
      eaOperationalSnapshots: {
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
      licenseOperationControls: true,
      eaOperationalCommands: {
        orderBy: { requestedAt: "desc" },
        take: 1,
      },
      realTradingApprovals: {
        where: { status: RealTradingApprovalStatus.APPROVED },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getRealTradingOperationCenterView() {
  const licenses = await loadOperationalLicenses();
  const rows: RealTradingOperationRow[] = [];

  for (const license of licenses) {
    const row = await mapLicenseToRow(license);
    if (row) rows.push(row);
  }

  const summary: RealTradingOperationSummary = {
    monitoredClients: rows.length,
    easOnline: rows.filter((r) => r.eaOnline).length,
    easOffline: rows.filter((r) => !r.eaOnline).length,
    clientsInOperation: rows.filter((r) => r.inOperation).length,
    openPositions: rows.filter((r) => r.hasOpenPosition).length,
    pendingOrders: rows.reduce((acc, r) => acc + r.pendingOrdersCount, 0),
    consolidatedPnlDayBrl: rows.reduce((acc, r) => acc + r.totalPnlDayBrl, 0),
    consolidatedPnlMonthBrl: rows.reduce((acc, r) => acc + r.totalPnlMonthBrl, 0),
    dailyLimitTotalBrl: rows.reduce((acc, r) => acc + r.dailyLimitBrl, 0),
    dailyUsedTotalBrl: rows.reduce((acc, r) => acc + r.dailyUsedBrl, 0),
    dailyRemainingTotalBrl: rows.reduce((acc, r) => acc + r.dailyRemainingBrl, 0),
  };

  return { summary, rows };
}

export async function getRealTradingOperationDetailView(licenseId: string) {
  const licenses = await loadOperationalLicenses(licenseId);
  const license = licenses[0];
  if (!license) return null;

  const row = await mapLicenseToRow(license);
  if (!row) return null;

  const snapshot = license.eaOperationalSnapshots[0];
  const device = license.devices[0];
  const commands = await prisma.eAOperationalCommand.findMany({
    where: { licenseId },
    orderBy: { requestedAt: "desc" },
    take: 30,
    include: {
      requestedBy: { select: { email: true, name: true } },
    },
  });

  const heartbeats = await prisma.eaHeartbeat.findMany({
    where: { licenseId },
    orderBy: { receivedAt: "desc" },
    take: 10,
  });

  const canTradeDecisions = await prisma.autonomousStrategyDecision.findMany({
    where: { licenseId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return {
    row,
    snapshot,
    device,
    commands,
    heartbeats,
    canTradeDecisions,
    control: license.licenseOperationControls.find(
      (c) => c.strategyCode === row.strategyCode
    ),
  };
}
