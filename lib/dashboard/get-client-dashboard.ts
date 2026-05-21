import { OrderLogStatus } from "@prisma/client";
import { isEaOffline, EA_OFFLINE_THRESHOLD_SEC } from "@/lib/ea/status";
import { resolveSubscriptionDisplayStatus } from "@/lib/licensing/display";
import { getLicenseOperationalFlags } from "@/lib/licensing/service";
import prisma from "@/lib/prisma";
import { decimalToNumber, formatBrl } from "@/lib/format";
import {
  resolveDayOperationalStatus,
  DAY_STATUS_DESCRIPTIONS,
} from "./day-status";
import type {
  ClientDashboardData,
  DashboardHistoryRow,
  DashboardOpenPosition,
  DashboardPendingOrder,
  BenchmarkPoint,
  EquityPoint,
} from "./types";

type HeartbeatPayload = {
  pending_orders?: Array<{
    symbol?: string;
    side?: string;
    volume?: number | string;
    ticket?: string;
  }>;
  open_positions?: Array<{
    symbol?: string;
    quantity?: number | string;
    avg_price?: number | string;
    unrealized_pnl?: number | string;
  }>;
};

function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function parseHeartbeatPayload(raw: unknown): HeartbeatPayload {
  if (!raw || typeof raw !== "object") return {};
  return raw as HeartbeatPayload;
}

function mapPositionsFromPayload(
  payload: HeartbeatPayload
): DashboardOpenPosition[] {
  const list = payload.open_positions ?? [];
  return list
    .filter((p) => p.symbol)
    .map((p) => ({
      symbol: String(p.symbol),
      quantity: Number(p.quantity ?? 0),
      avgPrice: Number(p.avg_price ?? 0),
      unrealizedPnl:
        p.unrealized_pnl != null ? Number(p.unrealized_pnl) : null,
    }));
}

function mapPendingFromPayload(
  payload: HeartbeatPayload
): DashboardPendingOrder[] {
  const list = payload.pending_orders ?? [];
  return list
    .filter((p) => p.symbol)
    .map((p) => ({
      symbol: String(p.symbol),
      side: String(p.side ?? "—"),
      volume: Number(p.volume ?? 0),
      ticket: p.ticket,
    }));
}

function buildBenchmarkSeries(
  equity: EquityPoint[],
  ibov: { tradeDate: Date; closeValue: { toNumber?: () => number } }[]
): BenchmarkPoint[] {
  if (equity.length < 2 || ibov.length < 2) return [];

  const ibovByDate = new Map(
    ibov.map((b) => [
      b.tradeDate.toISOString().slice(0, 10),
      decimalToNumber(b.closeValue) ?? 0,
    ])
  );

  const firstEquity = equity[0].equity;
  const firstIbov = ibovByDate.get(equity[0].date) ?? ibov[0]
    ? decimalToNumber(ibov[0].closeValue) ?? 1
    : 1;

  return equity.map((point) => {
    const ibovVal = ibovByDate.get(point.date);
    const portfolioPct =
      firstEquity > 0 ? ((point.equity - firstEquity) / firstEquity) * 100 : 0;
    const ibovPct =
      ibovVal != null && firstIbov > 0
        ? ((ibovVal - firstIbov) / firstIbov) * 100
        : 0;
    return {
      date: point.date,
      portfolioPct: Number(portfolioPct.toFixed(2)),
      ibovPct: Number(ibovPct.toFixed(2)),
    };
  });
}

export async function getClientDashboard(
  userId: string
): Promise<ClientDashboardData> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  const subscription = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      plan: true,
      licenses: {
        orderBy: { updatedAt: "desc" },
        include: {
          mt5Account: true,
          exposureProfile: true,
          devices: { where: { revokedAt: null }, take: 1 },
        },
      },
    },
  });

  const displayStatus = resolveSubscriptionDisplayStatus(subscription);
  const primaryLicense = subscription?.licenses[0] ?? null;
  const licenseId = primaryLicense?.id;

  const today = startOfDay();
  const monthStart = startOfMonth();

  const [
    latestHeartbeat,
    positionSnapshots,
    armedInstructions,
    todayExecutions,
    equitySnapshots,
    ibovRows,
    dailyToday,
    dailyMonthAgg,
    historyExecutions,
  ] = await Promise.all([
    licenseId
      ? prisma.eaHeartbeat.findFirst({
          where: { licenseId },
          orderBy: { receivedAt: "desc" },
        })
      : null,
    licenseId
      ? prisma.positionSnapshot.findMany({
          where: { licenseId },
          orderBy: { snapshotAt: "desc" },
          take: 10,
        })
      : [],
    licenseId
      ? prisma.instruction.findMany({
          where: {
            licenseId,
            currentStatus: {
              in: [OrderLogStatus.RECEIVED, OrderLogStatus.SENT],
            },
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: "asc" },
          take: 10,
        })
      : [],
    licenseId
      ? prisma.execution.findMany({
          where: {
            licenseId,
            createdAt: { gte: today },
            status: { in: ["FILLED", "PARTIAL", "REJECTED"] },
          },
          orderBy: { createdAt: "desc" },
          include: {
            instruction: {
              select: { symbol: true, side: true, purpose: true },
            },
          },
        })
      : [],
    licenseId
      ? prisma.equitySnapshot.findMany({
          where: { licenseId, snapshotAt: { gte: new Date(Date.now() - 90 * 86400000) } },
          orderBy: { snapshotAt: "asc" },
          take: 120,
        })
      : [],
    prisma.benchmarkIbovDaily.findMany({
      where: { tradeDate: { gte: new Date(Date.now() - 120 * 86400000) } },
      orderBy: { tradeDate: "asc" },
    }),
    licenseId
      ? prisma.dailyPnl.findUnique({
          where: {
            licenseId_tradeDate: {
              licenseId,
              tradeDate: today,
            },
          },
        })
      : null,
    licenseId
      ? prisma.dailyPnl.aggregate({
          where: { licenseId, tradeDate: { gte: monthStart } },
          _sum: { realizedPnl: true },
        })
      : { _sum: { realizedPnl: null } },
    licenseId
      ? prisma.execution.findMany({
          where: { licenseId },
          orderBy: { createdAt: "desc" },
          take: 25,
          include: {
            instruction: {
              select: { symbol: true, side: true, purpose: true },
            },
          },
        })
      : [],
  ]);

  const device = primaryLicense?.devices[0];
  const lastSync = device?.lastSeenAt ?? latestHeartbeat?.receivedAt ?? null;
  const eaOnline = !isEaOffline(lastSync, EA_OFFLINE_THRESHOLD_SEC);

  const flags = licenseId
    ? await getLicenseOperationalFlags(licenseId)
    : null;

  const hbPayload = parseHeartbeatPayload(latestHeartbeat?.reportPayload);
  let positions = mapPositionsFromPayload(hbPayload);
  if (positions.length === 0 && positionSnapshots.length > 0) {
    const seen = new Set<string>();
    for (const snap of positionSnapshots) {
      if (seen.has(snap.symbol)) continue;
      seen.add(snap.symbol);
      positions.push({
        symbol: snap.symbol,
        quantity: decimalToNumber(snap.quantity) ?? 0,
        avgPrice: decimalToNumber(snap.avgPrice) ?? 0,
        unrealizedPnl: decimalToNumber(snap.unrealizedPnl),
      });
    }
  }

  let pendingOrders = mapPendingFromPayload(hbPayload);
  if (armedInstructions.length > 0) {
    for (const instr of armedInstructions) {
      pendingOrders.push({
        symbol: instr.symbol,
        side: instr.side,
        volume: decimalToNumber(instr.quantity) ?? 0,
        ticket: instr.id.slice(0, 8),
      });
    }
  }

  const riskBlocked =
    !!flags &&
    (!flags.canAcceptNewEntries ||
      flags.haltAllTrading ||
      primaryLicense?.status !== "ACTIVE");

  const hadExecutionToday = todayExecutions.some(
    (e) => e.status === "FILLED" || e.status === "PARTIAL"
  );

  const dayStatus = resolveDayOperationalStatus({
    eaOnline,
    riskBlocked,
    hasOpenPosition: positions.length > 0,
    hasArmedOrder: pendingOrders.length > 0,
    hadExecutionToday,
    canAcceptNewEntries: flags?.canAcceptNewEntries ?? false,
  });

  const equityCurve: EquityPoint[] = equitySnapshots.map((s) => ({
    date: s.snapshotAt.toISOString().slice(0, 10),
    equity: decimalToNumber(s.equity) ?? 0,
  }));

  const benchmark = buildBenchmarkSeries(equityCurve, ibovRows);

  const history: DashboardHistoryRow[] = historyExecutions.map((ex) => ({
    id: ex.id,
    at: ex.executedAt?.toISOString() ?? ex.createdAt.toISOString(),
    symbol: ex.instruction.symbol,
    side: ex.instruction.side,
    status: ex.status,
    resultLabel:
      ex.status === "FILLED" || ex.status === "PARTIAL"
        ? "Executada"
        : ex.status === "REJECTED"
          ? "Rejeitada"
          : "Expirada",
  }));

  const dayPnl = decimalToNumber(dailyToday?.realizedPnl);
  const monthPnl = decimalToNumber(dailyMonthAgg._sum.realizedPnl);

  return {
    userEmail: user?.email ?? "",
    subscription: {
      displayStatus,
      planName: subscription?.plan.name ?? null,
      planSlug: subscription?.plan.slug ?? null,
      periodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
    },
    license: primaryLicense
      ? {
          id: primaryLicense.id,
          status: primaryLicense.status,
          exposureProfileName: primaryLicense.exposureProfile?.name ?? null,
          mt5Login: primaryLicense.mt5Account?.login ?? null,
          mt5Server: primaryLicense.mt5Account?.server ?? null,
          brokerName: primaryLicense.mt5Account?.brokerName ?? null,
          haltNewEntries: primaryLicense.haltNewEntries,
          canAcceptNewEntries: flags?.canAcceptNewEntries ?? false,
        }
      : null,
    ea: {
      online: eaOnline,
      lastSyncAt: lastSync?.toISOString() ?? null,
      eaVersion:
        latestHeartbeat?.eaVersion ?? device?.eaVersion ?? null,
    },
    dayStatus,
    dayStatusMessage: DAY_STATUS_DESCRIPTIONS[dayStatus],
    positions,
    pendingOrders,
    pnl: {
      day: dayPnl,
      month: monthPnl,
      dayLabel: formatBrl(dayPnl),
      monthLabel: formatBrl(monthPnl),
    },
    equityCurve,
    benchmark,
    history,
  };
}
