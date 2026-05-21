import { OrderLogStatus, SubscriptionStatus, UserRole } from "@prisma/client";
import { EA_OFFLINE_THRESHOLD_SEC, isEaOffline } from "@/lib/ea/status";
import prisma from "@/lib/prisma";

const METRICS_WINDOW_DAYS = 7;
const LIST_LIMIT = 25;

function windowStart() {
  const d = new Date();
  d.setDate(d.getDate() - METRICS_WINDOW_DAYS);
  return d;
}

export type AdminOperationsDashboard = {
  kpis: {
    totalClients: number;
    activeClients: number;
    delinquentClients: number;
    easOnline: number;
    easOffline: number;
    clientsPositioned: number;
    clientsWithArmedOrders: number;
    avgSlippage: number | null;
    avgLatencyMs: number | null;
    aggregatePnl: number;
  };
  recentSignals: Array<{
    id: string;
    licenseId: string;
    clientEmail: string;
    symbol: string;
    side: string;
    purpose: string;
    status: string;
    source: string | null;
    createdAt: string;
  }>;
  executionsByClient: Array<{
    userId: string;
    email: string;
    executionCount: number;
    filledCount: number;
  }>;
  rejectedOrders: Array<{
    instructionId: string;
    licenseId: string;
    clientEmail: string;
    symbol: string;
    message: string | null;
    at: string;
  }>;
  ignoredOrders: Array<{
    instructionId: string;
    licenseId: string;
    clientEmail: string;
    symbol: string;
    reason: string | null;
    at: string;
  }>;
  resultsByClient: Array<{
    userId: string;
    email: string;
    realizedPnl: number;
    tradeDays: number;
  }>;
  errorLogs: Array<{
    id: string;
    licenseId: string;
    clientEmail: string;
    errorCode: string | null;
    errorMessage: string;
    at: string;
  }>;
  billingEvents: Array<{
    id: string;
    gateway: string;
    eventType: string;
    processed: boolean;
    at: string;
  }>;
  licenseStatuses: Array<{
    licenseId: string;
    clientEmail: string;
    status: string;
    haltNewEntries: boolean;
    mt5: string | null;
    eaOnline: boolean;
  }>;
  licensesForActions: Array<{
    id: string;
    userId: string;
    clientEmail: string;
    haltNewEntries: boolean;
    status: string;
  }>;
};

export async function getAdminOperationsDashboard(): Promise<AdminOperationsDashboard> {
  const since = windowStart();
  const now = new Date();

  const [
    totalClients,
    activeClients,
    delinquentClients,
    devices,
    positionedLicenseIds,
    armedByHeartbeat,
    armedByInstruction,
    slippageAgg,
    latencyRows,
    recentSignals,
    executionsGrouped,
    rejectedLogs,
    ignoredLogs,
    dailyPnls,
    errorLogs,
    billingEvents,
    licenses,
  ] = await Promise.all([
    prisma.user.count({ where: { role: UserRole.CLIENT } }),
    prisma.user.count({
      where: {
        role: UserRole.CLIENT,
        subscriptions: { some: { status: SubscriptionStatus.ACTIVE } },
        licenses: { some: { status: "ACTIVE" } },
      },
    }),
    prisma.user.count({
      where: {
        role: UserRole.CLIENT,
        subscriptions: { some: { status: SubscriptionStatus.PAST_DUE } },
      },
    }),
    prisma.device.findMany({
      where: { revokedAt: null },
      select: { licenseId: true, lastSeenAt: true },
    }),
    prisma.positionSnapshot.findMany({
      where: {
        snapshotAt: { gte: new Date(now.getTime() - 15 * 60 * 1000) },
        quantity: { not: 0 },
      },
      distinct: ["licenseId"],
      select: { licenseId: true },
    }),
    prisma.eaHeartbeat.findMany({
      where: { receivedAt: { gte: since }, pendingCount: { gt: 0 } },
      distinct: ["licenseId"],
      select: { licenseId: true },
    }),
    prisma.instruction.findMany({
      where: {
        currentStatus: { in: [OrderLogStatus.RECEIVED, OrderLogStatus.SENT] },
        orderType: { in: ["LIMIT", "STOP", "STOP_LIMIT"] },
      },
      distinct: ["licenseId"],
      select: { licenseId: true },
    }),
    prisma.execution.aggregate({
      where: {
        executedAt: { gte: since },
        slippage: { not: null },
        status: "FILLED",
      },
      _avg: { slippage: true },
    }),
    prisma.$queryRaw<Array<{ avg_ms: number | null }>>`
      SELECT AVG(EXTRACT(EPOCH FROM (e.executed_at - i.created_at)) * 1000)::float AS avg_ms
      FROM executions e
      INNER JOIN instructions i ON i.id = e.instruction_id
      WHERE e.executed_at IS NOT NULL
        AND e.executed_at >= ${since}
        AND e.status = 'FILLED'
    `,
    prisma.instruction.findMany({
      take: LIST_LIMIT,
      orderBy: { createdAt: "desc" },
      include: {
        license: {
          include: { user: { select: { email: true } } },
        },
      },
    }),
    prisma.execution.groupBy({
      by: ["licenseId"],
      where: { createdAt: { gte: since } },
      _count: { id: true },
    }),
    prisma.instructionStatusLog.findMany({
      where: { status: OrderLogStatus.REJECTED, createdAt: { gte: since } },
      take: LIST_LIMIT,
      orderBy: { createdAt: "desc" },
      include: {
        instruction: {
          include: {
            license: { include: { user: { select: { email: true } } } },
          },
        },
      },
    }),
    prisma.instructionStatusLog.findMany({
      where: { status: OrderLogStatus.IGNORED, createdAt: { gte: since } },
      take: LIST_LIMIT,
      orderBy: { createdAt: "desc" },
      include: {
        instruction: {
          include: {
            license: { include: { user: { select: { email: true } } } },
          },
        },
      },
    }),
    prisma.dailyPnl.findMany({
      where: { tradeDate: { gte: since } },
      include: {
        license: { include: { user: { select: { id: true, email: true } } } },
      },
    }),
    prisma.eaErrorReport.findMany({
      take: LIST_LIMIT,
      orderBy: { createdAt: "desc" },
      include: {
        license: { include: { user: { select: { email: true } } } },
      },
    }),
    prisma.webhookEvent.findMany({
      take: LIST_LIMIT,
      orderBy: { createdAt: "desc" },
    }),
    prisma.license.findMany({
      include: {
        user: { select: { email: true } },
        mt5Account: { select: { login: true } },
        devices: {
          where: { revokedAt: null },
          orderBy: { lastSeenAt: "desc" },
          take: 1,
        },
      },
    }),
  ]);

  const latestDeviceByLicense = new Map<string, Date | null>();
  for (const d of devices) {
    const prev = latestDeviceByLicense.get(d.licenseId);
    const ts = d.lastSeenAt?.getTime() ?? 0;
    const prevTs = prev?.getTime() ?? 0;
    if (!prev || ts > prevTs) {
      latestDeviceByLicense.set(d.licenseId, d.lastSeenAt);
    }
  }

  let easOnline = 0;
  let easOffline = 0;
  for (const [, lastSeen] of latestDeviceByLicense) {
    if (isEaOffline(lastSeen, EA_OFFLINE_THRESHOLD_SEC, now)) {
      easOffline += 1;
    } else {
      easOnline += 1;
    }
  }

  const armedSet = new Set([
    ...armedByHeartbeat.map((r) => r.licenseId),
    ...armedByInstruction.map((r) => r.licenseId),
  ]);

  const licenseIdsForExec = executionsGrouped.map((g) => g.licenseId);
  const licenseUsers = licenseIdsForExec.length
    ? await prisma.license.findMany({
        where: { id: { in: licenseIdsForExec } },
        include: { user: { select: { id: true, email: true } } },
      })
    : [];
  const licenseUserMap = new Map(
    licenseUsers.map((l) => [l.id, { userId: l.userId, email: l.user.email }])
  );

  const filledByLicense = await prisma.execution.groupBy({
    by: ["licenseId"],
    where: { createdAt: { gte: since }, status: "FILLED" },
    _count: { id: true },
  });
  const filledMap = new Map(filledByLicense.map((f) => [f.licenseId, f._count.id]));

  const pnlByUser = new Map<string, { email: string; pnl: number; days: Set<string> }>();
  let aggregatePnl = 0;
  for (const row of dailyPnls) {
    const uid = row.license.user.id;
    const email = row.license.user.email;
    const val = Number(row.realizedPnl);
    aggregatePnl += val;
    const cur = pnlByUser.get(uid) ?? { email, pnl: 0, days: new Set<string>() };
    cur.pnl += val;
    cur.days.add(row.tradeDate.toISOString().slice(0, 10));
    pnlByUser.set(uid, cur);
  }

  const executionsByClientMap = new Map<
    string,
    { email: string; executionCount: number; filledCount: number }
  >();
  for (const g of executionsGrouped) {
    const u = licenseUserMap.get(g.licenseId);
    if (!u) continue;
    const cur = executionsByClientMap.get(u.userId) ?? {
      email: u.email,
      executionCount: 0,
      filledCount: 0,
    };
    cur.executionCount += g._count.id;
    cur.filledCount += filledMap.get(g.licenseId) ?? 0;
    executionsByClientMap.set(u.userId, cur);
  }

  return {
    kpis: {
      totalClients,
      activeClients,
      delinquentClients,
      easOnline,
      easOffline,
      clientsPositioned: positionedLicenseIds.length,
      clientsWithArmedOrders: armedSet.size,
      avgSlippage: slippageAgg._avg.slippage
        ? Number(slippageAgg._avg.slippage)
        : null,
      avgLatencyMs:
        latencyRows[0]?.avg_ms != null ? Math.round(latencyRows[0].avg_ms) : null,
      aggregatePnl,
    },
    recentSignals: recentSignals.map((s) => ({
      id: s.id,
      licenseId: s.licenseId,
      clientEmail: s.license.user.email,
      symbol: s.symbol,
      side: s.side,
      purpose: s.purpose,
      status: s.currentStatus,
      source: s.source,
      createdAt: s.createdAt.toISOString(),
    })),
    executionsByClient: [...executionsByClientMap.entries()]
      .map(([userId, v]) => ({
        userId,
        email: v.email,
        executionCount: v.executionCount,
        filledCount: v.filledCount,
      }))
      .sort((a, b) => b.executionCount - a.executionCount)
      .slice(0, LIST_LIMIT),
    rejectedOrders: rejectedLogs.map((log) => ({
      instructionId: log.instructionId,
      licenseId: log.instruction.licenseId,
      clientEmail: log.instruction.license.user.email,
      symbol: log.instruction.symbol,
      message: log.message,
      at: log.createdAt.toISOString(),
    })),
    ignoredOrders: ignoredLogs.map((log) => ({
      instructionId: log.instructionId,
      licenseId: log.instruction.licenseId,
      clientEmail: log.instruction.license.user.email,
      symbol: log.instruction.symbol,
      reason: log.message,
      at: log.createdAt.toISOString(),
    })),
    resultsByClient: [...pnlByUser.entries()]
      .map(([userId, v]) => ({
        userId,
        email: v.email,
        realizedPnl: v.pnl,
        tradeDays: v.days.size,
      }))
      .sort((a, b) => b.realizedPnl - a.realizedPnl)
      .slice(0, LIST_LIMIT),
    errorLogs: errorLogs.map((e) => ({
      id: e.id,
      licenseId: e.licenseId,
      clientEmail: e.license.user.email,
      errorCode: e.errorCode,
      errorMessage: e.errorMessage,
      at: e.createdAt.toISOString(),
    })),
    billingEvents: billingEvents.map((w) => ({
      id: w.id,
      gateway: w.gateway,
      eventType: w.eventType,
      processed: w.processedAt != null,
      at: w.createdAt.toISOString(),
    })),
    licenseStatuses: licenses.map((lic) => {
      const lastSeen = lic.devices[0]?.lastSeenAt ?? null;
      return {
        licenseId: lic.id,
        clientEmail: lic.user.email,
        status: lic.status,
        haltNewEntries: lic.haltNewEntries,
        mt5: lic.mt5Account?.login ?? null,
        eaOnline: !isEaOffline(lastSeen, EA_OFFLINE_THRESHOLD_SEC, now),
      };
    }),
    licensesForActions: licenses.map((lic) => ({
      id: lic.id,
      userId: lic.userId,
      clientEmail: lic.user.email,
      haltNewEntries: lic.haltNewEntries,
      status: lic.status,
    })),
  };
}
