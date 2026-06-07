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
  autonomous_strategy: z
    .object({
      strategy_code: z.string().max(64).optional(),
      autonomous_strategy_enabled: z.boolean().optional(),
      strategy_config_hash: z.string().max(128).optional(),
      terminal_connected: z.boolean().optional(),
      auto_trading_allowed: z.boolean().optional(),
      real_orders_enabled: z.boolean().optional(),
      last_tick_time: z.string().max(64).optional(),
      has_open_position: z.boolean().optional(),
      has_pending_orders: z.boolean().optional(),
      last_execution_error: z.string().max(256).optional(),
      last_strategy_decision_reason: z.string().max(128).optional(),
    })
    .optional(),
});

export const autonomousStrategyCanTradeBodySchema = z.object({
  strategy_code: z.literal("MR_FIBO_D1_GUARD"),
  license_id: z.string().min(1),
  device_id: z.string().min(1),
  account_login: z.string().min(1),
  account_server: z.string().min(1),
  symbol: z.string().min(1),
  trade_mode: z.enum(["DEMO", "REAL"]),
  magic_number: z.number().int().positive(),
  side: z.enum(["BUY", "SELL"]),
  action: z.enum(["ENTRY", "REVERSAL"]),
  requested_contracts: z.number().int().positive(),
  estimated_stop_points: z.number().positive(),
  strategy_config_hash: z.string().max(128).optional().nullable(),
  client_timestamp: z.string().max(64).optional().nullable(),
  ea_ready: z.record(z.unknown()).optional().nullable(),
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

const managementTakeSchema = z.object({
  label: z.string().max(8).optional(),
  enabled: z.boolean().optional(),
  price: z.union([z.number(), z.null()]).optional(),
  quantity: z.number().int().nonnegative().optional(),
});

export const eaPlannedManagementPlanSchema = z.object({
  version: z.number().int().positive().optional(),
  initial_stop_loss: z.number(),
  takes: z.array(managementTakeSchema).max(4).optional(),
  break_even: z
    .object({
      enabled: z.boolean().optional(),
      trigger: z.string().max(64).optional(),
      trigger_price: z.union([z.number(), z.null()]).optional(),
      offset: z.number().optional(),
    })
    .optional(),
  trailing_stop: z
    .object({
      enabled: z.boolean().optional(),
      trigger_price: z.union([z.number(), z.null()]).optional(),
      distance: z.union([z.number(), z.null()]).optional(),
      step: z.union([z.number(), z.null()]).optional(),
    })
    .optional(),
});

export const autonomousStrategyPreflightBodySchema = z.object({
  strategy_code: z.string().min(3).max(64),
  strategy_version: z.string().max(32).default("1.0.0"),
  license_id: z.string().min(1),
  device_id: z.string().min(1).max(128),
  account_login: z.string().min(1).max(64),
  account_server: z.string().min(1).max(128),
  symbol: z.string().min(1).max(32),
  trade_mode: z.enum(["DEMO", "REAL"]),
  magic_number: z.number().int().positive(),
  side: z.enum(["BUY", "SELL"]),
  order_type: z.enum(["MARKET", "LIMIT", "STOP"]),
  order_price: z.union([z.number(), z.null()]).optional(),
  requested_contracts: z.number().int().positive().max(100),
  planned_management_plan: eaPlannedManagementPlanSchema,
  signal_reason: z.string().max(128).optional(),
  client_timestamp: z.string().max(64).optional(),
});

export const dailyRiskReportBodySchema = z.object({
  license_id: z.string().min(1),
  device_id: z.string().min(1).max(128),
  account_login: z.string().min(1).max(64),
  account_server: z.string().min(1).max(128),
  symbol: z.string().min(1).max(32),
  strategy_code: z.string().min(3).max(64).optional(),
  trade_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  realized_pnl: z.number(),
  open_pnl: z.number().default(0),
  balance: z.number().optional(),
  equity: z.number().optional(),
  currency: z.string().max(8).optional(),
});

export const operationSnapshotPendingOrderSchema = z.object({
  ticket: z.union([z.number(), z.string()]).optional(),
  type: z.string().max(32).optional(),
  purpose: z.string().max(64).optional(),
  volume: z.number().optional(),
  price: z.number().optional(),
  side: z.string().max(8).optional(),
  symbol: z.string().max(32).optional(),
});

export const operationSnapshotBodySchema = z.object({
  license_id: z.string().min(1),
  device_id: z.string().min(1).max(128),
  account_login: z.string().min(1).max(64),
  account_server: z.string().min(1).max(128),
  symbol: z.string().min(1).max(32),
  strategy_code: z.string().min(3).max(64).optional(),
  magic_number: z.number().int().optional(),
  trade_mode: z.string().max(16).optional(),
  ea_version: z.string().max(32).optional(),
  terminal_connected: z.boolean().optional(),
  auto_trading_allowed: z.boolean().optional(),
  real_orders_enabled: z.boolean().optional(),
  autonomous_strategy_enabled: z.boolean().optional(),
  paused_by_admin: z.boolean().optional(),
  has_open_position: z.boolean().optional(),
  position_side: z.string().max(8).optional(),
  position_volume: z.number().optional(),
  position_average_price: z.number().optional(),
  position_current_price: z.number().optional(),
  position_open_pnl: z.number().optional(),
  pending_orders: z.array(operationSnapshotPendingOrderSchema).optional(),
  realized_pnl_day: z.number().optional(),
  realized_pnl_month: z.number().optional(),
  open_pnl: z.number().optional(),
  total_pnl_day: z.number().optional(),
  total_pnl_month: z.number().optional(),
  pnl_status: z.enum(["OK", "PARTIAL"]).optional(),
  last_tick_time: z.string().max(64).optional(),
  last_execution_error: z.string().max(500).optional(),
  last_daily_risk_sent_at: z.string().max(64).optional(),
  last_daily_risk_status: z.string().max(32).optional(),
  last_daily_risk_state_id: z.string().max(64).optional(),
  last_daily_risk_error_code: z.string().max(64).optional(),
  last_daily_risk_error_message: z.string().max(500).optional(),
});

export const eaCommandAckBodySchema = z.object({
  status: z.literal("ACKED"),
  ea_time: z.string().max(64).optional(),
  message: z.string().max(500).optional(),
});

export const eaCommandResultBodySchema = z.object({
  status: z.enum(["EXECUTED", "FAILED"]),
  result_code: z.string().min(1).max(64),
  result_message: z.string().min(1).max(500),
  details: z.record(z.unknown()).optional(),
});
