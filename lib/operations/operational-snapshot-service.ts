import { recordOperationalAudit } from "@/lib/operations/operational-audit";
import { resolveDailyRiskStateLookup } from "@/lib/admin/daily-risk-state-trace";
import { getLicenseOperationControl } from "@/lib/operations/license-operation-control-service";
import { isEaOffline } from "@/lib/ea/status";
import { MR_FIBO_D1_GUARD_CODE } from "@/lib/risk/autonomous-strategy-reasons";
import { maskAccountLogin } from "@/lib/risk/real-trading-guard-status";
import { normalizeFiboStrategyCode } from "@/lib/strategy/normalize-strategy-code";
import prisma from "@/lib/prisma";
import type { z } from "zod";
import type { operationSnapshotBodySchema } from "@/lib/ea/schemas";

type SnapshotBody = z.infer<typeof operationSnapshotBodySchema>;

function toCents(value: number | undefined): number {
  if (value == null || Number.isNaN(value)) return 0;
  return Math.round(value * 100);
}

export async function upsertOperationalSnapshotFromEa(
  licenseId: string,
  deviceId: string,
  body: SnapshotBody
) {
  const strategyCode = normalizeFiboStrategyCode(
    body.strategy_code ?? MR_FIBO_D1_GUARD_CODE
  );
  const accountLogin = String(body.account_login).trim();
  const accountServer = String(body.account_server).trim();
  const symbol = body.symbol.trim().toUpperCase();

  const control = await getLicenseOperationControl(licenseId, strategyCode);
  const device = await prisma.device.findFirst({
    where: { licenseId, deviceId },
  });
  const isOnline = device ? !isEaOffline(device.lastSeenAt) : false;

  const dailyRisk = await resolveDailyRiskStateLookup({
    licenseId,
    accountLogin,
    accountServer,
    symbol,
    strategyCode,
  });
  const dailyLimit = await prisma.dailyFinancialRiskLimit.findUnique({
    where: {
      licenseId_accountLogin_accountServer_strategyCode_symbol: {
        licenseId,
        accountLogin,
        accountServer,
        strategyCode,
        symbol,
      },
    },
  });

  const limitCents = dailyLimit?.enabled ? dailyLimit.dailyLossLimitCents : 0;
  const state = dailyRisk.exactState;
  const dailyUsedCents = state
    ? Math.max(0, -Math.min(0, state.totalPnlCents))
    : 0;
  const dailyRemainingCents =
    state?.remainingLossCents ?? Math.max(0, limitCents - dailyUsedCents);

  const openPnlCents = toCents(body.open_pnl ?? body.position_open_pnl);
  const realizedDayCents = toCents(body.realized_pnl_day);
  const realizedMonthCents = toCents(body.realized_pnl_month);
  const totalDayCents = realizedDayCents + openPnlCents;

  const pendingOrders = body.pending_orders ?? [];
  const pausedByAdmin =
    body.paused_by_admin ?? control?.paused ?? false;

  const snapshot = await prisma.eAOperationalSnapshot.upsert({
    where: {
      licenseId_accountLogin_accountServer_symbol_strategyCode: {
        licenseId,
        accountLogin,
        accountServer,
        symbol,
        strategyCode,
      },
    },
    create: {
      licenseId,
      deviceId,
      accountLogin,
      accountServer,
      symbol,
      strategyCode,
      magicNumber: body.magic_number ?? null,
      tradeMode: body.trade_mode ?? null,
      eaVersion: body.ea_version ?? null,
      isOnline,
      terminalConnected: body.terminal_connected ?? false,
      autoTradingAllowed: body.auto_trading_allowed ?? false,
      realOrdersEnabled: body.real_orders_enabled ?? false,
      autonomousStrategyEnabled: body.autonomous_strategy_enabled ?? false,
      pausedByAdmin,
      pauseReason: control?.pausedReason ?? null,
      hasOpenPosition: body.has_open_position ?? false,
      positionSide: body.position_side ?? null,
      positionVolume: body.position_volume ?? null,
      positionAveragePrice: body.position_average_price ?? null,
      positionCurrentPrice: body.position_current_price ?? null,
      positionOpenPnlCents: openPnlCents,
      hasPendingOrders: pendingOrders.length > 0,
      pendingOrdersCount: pendingOrders.length,
      pendingOrdersJson: pendingOrders,
      realizedPnlDayCents: realizedDayCents,
      openPnlCents,
      totalPnlDayCents: totalDayCents,
      realizedPnlMonthCents: realizedMonthCents,
      totalPnlMonthCents: realizedMonthCents + openPnlCents,
      dailyLimitCents: limitCents,
      dailyUsedCents,
      dailyRemainingCents,
      lastTickAt: body.last_tick_time ? new Date(body.last_tick_time) : null,
      lastHeartbeatAt: device?.lastSeenAt ?? null,
      pnlStatus: body.pnl_status ?? "OK",
      rawSnapshotJson: body,
    },
    update: {
      deviceId,
      magicNumber: body.magic_number ?? null,
      tradeMode: body.trade_mode ?? null,
      eaVersion: body.ea_version ?? null,
      isOnline,
      terminalConnected: body.terminal_connected ?? false,
      autoTradingAllowed: body.auto_trading_allowed ?? false,
      realOrdersEnabled: body.real_orders_enabled ?? false,
      autonomousStrategyEnabled: body.autonomous_strategy_enabled ?? false,
      pausedByAdmin,
      pauseReason: control?.pausedReason ?? null,
      hasOpenPosition: body.has_open_position ?? false,
      positionSide: body.position_side ?? null,
      positionVolume: body.position_volume ?? null,
      positionAveragePrice: body.position_average_price ?? null,
      positionCurrentPrice: body.position_current_price ?? null,
      positionOpenPnlCents: openPnlCents,
      hasPendingOrders: pendingOrders.length > 0,
      pendingOrdersCount: pendingOrders.length,
      pendingOrdersJson: pendingOrders,
      realizedPnlDayCents: realizedDayCents,
      openPnlCents,
      totalPnlDayCents: totalDayCents,
      realizedPnlMonthCents: realizedMonthCents,
      totalPnlMonthCents: realizedMonthCents + openPnlCents,
      dailyLimitCents: limitCents,
      dailyUsedCents,
      dailyRemainingCents,
      lastTickAt: body.last_tick_time ? new Date(body.last_tick_time) : null,
      lastHeartbeatAt: device?.lastSeenAt ?? null,
      pnlStatus: body.pnl_status ?? "OK",
      rawSnapshotJson: body,
    },
  });

  await recordOperationalAudit({
    action: "operation.snapshot.received",
    entityType: "ea_operational_snapshot",
    entityId: snapshot.id,
    licenseId,
    metadata: {
      accountLogin: maskAccountLogin(accountLogin),
      symbol,
      strategyCode,
      hasOpenPosition: snapshot.hasOpenPosition,
      pendingOrdersCount: snapshot.pendingOrdersCount,
    },
  });

  return snapshot;
}
