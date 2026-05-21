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

export const executionBodySchema = z.object({
  instruction_id: z.string().min(1),
  status: z.enum(["FILLED", "PARTIAL", "REJECTED", "EXPIRED"]),
  broker_ticket: z.string().optional(),
  fill_price: decimalString.optional(),
  fill_quantity: decimalString.optional(),
  slippage: decimalString.optional(),
  error_code: z.string().optional(),
  error_message: z.string().optional(),
  executed_at: z.string().datetime().optional(),
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
