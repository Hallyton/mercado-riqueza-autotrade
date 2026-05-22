import { z } from "zod";

const decimalString = z.union([z.string(), z.number()]);

export const activateBodySchema = z.object({
  activation_code: z.string().min(8),
  device_id: z.string().min(1).max(128),
  fingerprint: z.string().max(256).optional(),
  ea_version: z.string().max(32).optional(),
});

export const mt5AccountSchema = z.object({
  login: z.string().min(1),
  server: z.string().min(1),
});

export const pendingOrderSchema = z.object({
  ticket: z.string().optional(),
  symbol: z.string(),
  side: z.enum(["BUY", "SELL"]),
  volume: decimalString,
  price: decimalString.optional(),
});

export const openPositionSchema = z.object({
  symbol: z.string(),
  quantity: decimalString,
  avg_price: decimalString,
  unrealized_pnl: decimalString.optional(),
});

export const heartbeatBodySchema = z.object({
  login: z.string().min(1),
  server: z.string().min(1),
  trade_mode: z.enum(["DEMO", "REAL"]).optional(),
  ea_status: z.enum(["ONLINE", "OFFLINE"]).default("ONLINE"),
  ea_version: z.string().max(32).optional(),
  equity: decimalString,
  balance: decimalString,
  margin: decimalString.optional(),
  positions_hash: z.string().max(128).optional(),
  pending_orders: z.array(pendingOrderSchema).default([]),
  open_positions: z.array(openPositionSchema).default([]),
});

/** Aceita ISO 8601 e formato legado MT5 (2026.05.20 15:30:00). */
export function normalizeEaExecutedAt(value: unknown): unknown {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return value;
  const s = value.trim();
  if (!s) return undefined;
  const mt5 = /^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/;
  const m = s.match(mt5);
  if (m) {
    return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
  }
  return s;
}

const executedAtSchema = z.preprocess(
  normalizeEaExecutedAt,
  z.string().datetime().optional()
);

export const executionBodySchema = z.object({
  instruction_id: z.string().min(1),
  status: z.enum(["FILLED", "PARTIAL", "REJECTED", "EXPIRED"]),
  broker_ticket: z.string().optional(),
  fill_price: decimalString.optional(),
  fill_quantity: decimalString.optional(),
  slippage: decimalString.optional(),
  error_code: z.string().optional(),
  error_message: z.string().optional(),
  executed_at: executedAtSchema,
});

export const errorBodySchema = z.object({
  error_code: z.string().max(64).optional(),
  error_message: z.string().min(1).max(4000),
  context: z.record(z.unknown()).optional(),
});

export const ignoredBodySchema = z.object({
  instruction_id: z.string().min(1),
  reason: z.string().max(500).optional(),
});
