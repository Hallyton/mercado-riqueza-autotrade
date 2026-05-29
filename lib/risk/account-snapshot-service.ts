import {
  AccountSnapshotSource,
  AccountSnapshotType,
  TradeMode,
  type Prisma,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import type { EaAuthContext } from "@/lib/ea/auth";

export type SaveAccountSnapshotInput = {
  snapshot_type: AccountSnapshotType;
  account_login: string;
  account_server: string;
  environment: TradeMode;
  currency?: string;
  balance: number;
  equity: number;
  margin?: number;
  free_margin?: number;
  margin_level?: number;
  open_positions?: unknown[];
  pending_orders?: unknown[];
  active_magic_numbers?: number[];
  captured_at?: string;
};

function sanitizeJsonArray(
  value: unknown[] | undefined
): Prisma.InputJsonValue | undefined {
  if (!value?.length) return undefined;
  const items = value.slice(0, 100).map((item) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
        const key = k.toLowerCase();
        if (
          key.includes("password") ||
          key.includes("token") ||
          key.includes("secret")
        ) {
          continue;
        }
        out[k] = v;
      }
      return out;
    }
    return item;
  });
  return items as Prisma.InputJsonValue;
}

export async function saveAccountSnapshotFromEa(
  ctx: EaAuthContext,
  body: SaveAccountSnapshotInput
) {
  const login = body.account_login.trim();
  const server = body.account_server.trim();

  const record = await prisma.accountSnapshot.create({
    data: {
      userId: ctx.license.userId,
      licenseId: ctx.license.id,
      snapshotType: body.snapshot_type,
      accountLogin: login,
      accountServer: server,
      environment: body.environment,
      currency: body.currency ?? "BRL",
      balance: body.balance,
      equity: body.equity,
      margin: body.margin,
      freeMargin: body.free_margin,
      marginLevel: body.margin_level,
      openPositionsJson: sanitizeJsonArray(body.open_positions),
      pendingOrdersJson: sanitizeJsonArray(body.pending_orders),
      activeMagicNumbersJson: body.active_magic_numbers?.length
        ? (body.active_magic_numbers as Prisma.InputJsonValue)
        : undefined,
      capturedAt: body.captured_at ? new Date(body.captured_at) : new Date(),
      source: AccountSnapshotSource.EA,
    },
  });

  return { ok: true as const, snapshotId: record.id };
}
