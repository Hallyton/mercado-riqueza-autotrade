import { z } from "zod";

const decimalString = z.union([z.string(), z.number()]);

export const activateBodySchema = z.object({
  activation_code: z.string().min(8),
  device_id: z.string().min(1).max(128),
  fingerprint: z.string().max(256).optional(),
  ea_version: z.string().max(32).optional(),
  account_login: z.string().min(1).max(32).optional(),
  account_server: z.string().min(1).max(128).optional(),
  trade_mode: z.enum(["DEMO", "REAL"]).optional(),
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
  magic_number: z.number().int().positive().optional(),
  account_login: z.string().min(1).max(64).optional(),
  account_server: z.string().min(1).max(128).optional(),
  symbol: z.string().min(1).max(32).optional(),
});

export const accountSnapshotBodySchema = z.object({
  snapshot_type: z.enum(["PRE_MARKET", "PRE_TRADE", "POST_MARKET", "MANUAL"]),
  account_login: z.string().min(1).max(64),
  account_server: z.string().min(1).max(128),
  environment: z.enum(["DEMO", "REAL"]),
  currency: z.string().max(8).optional(),
  balance: decimalString,
  equity: decimalString,
  margin: decimalString.optional(),
  free_margin: decimalString.optional(),
  margin_level: decimalString.optional(),
  open_positions: z.array(z.record(z.unknown())).max(100).optional(),
  pending_orders: z.array(z.record(z.unknown())).max(100).optional(),
  active_magic_numbers: z.array(z.number().int().positive()).max(20).optional(),
  captured_at: executedAtSchema,
});

export const executionProtectionBodySchema = z.object({
  instruction_id: z.string().min(1),
  execution_id: z.string().optional(),
  account_login: z.string().min(1).max(64),
  account_server: z.string().min(1).max(128),
  symbol: z.string().min(1).max(32),
  magic_number: z.number().int().positive(),
  entry_order_ticket: z.string().optional(),
  entry_deal_ticket: z.string().optional(),
  stop_loss_present: z.boolean(),
  take_profit_present: z.boolean(),
  stop_loss_price: decimalString.optional(),
  take_profit_price: decimalString.optional(),
  stop_order_ticket: z.string().optional(),
  take_order_ticket: z.string().optional(),
  protection_mode: z.enum([
    "ATTACHED_SL_TP",
    "PENDING_PROTECTION_ORDERS",
    "UNKNOWN",
  ]),
  protection_status: z.enum([
    "PROTECTION_CONFIRMED",
    "PROTECTION_FAILED",
    "PROTECTION_PENDING",
    "NOT_REQUIRED_FOR_DEBUG",
  ]),
  error_code: z.string().max(64).optional(),
  error_message: z.string().max(4000).optional(),
  reported_at: executedAtSchema,
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
