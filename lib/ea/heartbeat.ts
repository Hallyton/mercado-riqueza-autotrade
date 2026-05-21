import { AuditActorType, TradeMode } from "@prisma/client";
import { createAuditLog } from "@/lib/audit/log";
import { getLicenseOperationalFlags } from "@/lib/licensing/service";
import prisma from "@/lib/prisma";
import type { EaAuthContext } from "./auth";
import type { heartbeatBodySchema } from "./schemas";
import type { z } from "zod";

type HeartbeatBody = z.infer<typeof heartbeatBodySchema>;

function toDecimal(value: string | number | undefined) {
  if (value === undefined) return undefined;
  return Number(value);
}

export async function processHeartbeat(
  ctx: EaAuthContext,
  body: HeartbeatBody
) {
  const flags = await getLicenseOperationalFlags(ctx.license.id);
  const snapshotAt = new Date();

  await prisma.device.update({
    where: { id: ctx.device.id },
    data: {
      lastSeenAt: snapshotAt,
      eaVersion: body.ea_version ?? ctx.eaVersion ?? undefined,
    },
  });

  await prisma.eaHeartbeat.create({
    data: {
      licenseId: ctx.license.id,
      deviceId: ctx.device.deviceId,
      eaVersion: body.ea_version ?? ctx.eaVersion,
      eaStatus: body.ea_status,
      equity: toDecimal(body.equity),
      balance: toDecimal(body.balance),
      margin: toDecimal(body.margin),
      tradeMode: body.trade_mode as TradeMode | undefined,
      positionsHash: body.positions_hash,
      pendingCount: body.pending_orders.length,
      reportPayload: {
        pending_orders: body.pending_orders,
        open_positions: body.open_positions,
      },
    },
  });

  await prisma.equitySnapshot.create({
    data: {
      licenseId: ctx.license.id,
      userId: ctx.license.userId,
      equity: toDecimal(body.equity)!,
      balance: toDecimal(body.balance)!,
      margin: toDecimal(body.margin),
      tradeMode: body.trade_mode as TradeMode | undefined,
      snapshotAt,
    },
  });

  await prisma.positionSnapshot.deleteMany({
    where: { licenseId: ctx.license.id },
  });

  if (body.open_positions.length > 0) {
    await prisma.positionSnapshot.createMany({
      data: body.open_positions.map((pos) => ({
        licenseId: ctx.license.id,
        symbol: pos.symbol,
        quantity: Number(pos.quantity),
        avgPrice: Number(pos.avg_price),
        unrealizedPnl: pos.unrealized_pnl
          ? Number(pos.unrealized_pnl)
          : null,
        snapshotAt,
      })),
    });
  } else {
    await createAuditLog({
      actorType: AuditActorType.EA,
      actorId: ctx.license.userId,
      action: "ea.positions_closed",
      entityType: "license",
      entityId: ctx.license.id,
      requestId: ctx.requestId,
      metadata: { snapshotAt: snapshotAt.toISOString() },
    });
  }

  await createAuditLog({
    actorType: AuditActorType.EA,
    actorId: ctx.license.userId,
    action: "ea.heartbeat",
    entityType: "license",
    entityId: ctx.license.id,
    requestId: ctx.requestId,
    metadata: {
      eaStatus: body.ea_status,
      pendingCount: body.pending_orders.length,
      openPositions: body.open_positions.length,
      equity: body.equity,
    },
  });

  return {
    server_time: snapshotAt.toISOString(),
    pending_instructions: await prisma.instruction.count({
      where: {
        licenseId: ctx.license.id,
        currentStatus: { in: ["RECEIVED", "SENT"] },
        expiresAt: { gt: snapshotAt },
      },
    }),
    halt_new_entries: flags.haltNewEntries,
    halt_all_trading: flags.haltAllTrading,
    can_accept_new_entries: flags.canAcceptNewEntries,
    can_manage_open_positions: flags.canManageOpenPositions,
  };
}
