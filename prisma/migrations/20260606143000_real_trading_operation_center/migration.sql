-- Real Trading Operation Center — snapshots, commands, pause control

CREATE TYPE "EAOperationalCommandType" AS ENUM (
  'PAUSE_NEW_ENTRIES',
  'RESUME_TRADING',
  'CANCEL_PENDING_ORDERS',
  'CLOSE_OPEN_POSITION',
  'CLOSE_ALL_POSITIONS',
  'FLATTEN_AND_PAUSE',
  'REFRESH_STATUS'
);

CREATE TYPE "EAOperationalCommandStatus" AS ENUM (
  'PENDING',
  'ACKED',
  'EXECUTED',
  'FAILED',
  'EXPIRED',
  'CANCELLED'
);

CREATE TABLE "license_operation_controls" (
  "id" TEXT NOT NULL,
  "license_id" TEXT NOT NULL,
  "strategy_code" TEXT NOT NULL,
  "paused" BOOLEAN NOT NULL DEFAULT false,
  "paused_reason" TEXT,
  "paused_by_admin_id" TEXT,
  "paused_at" TIMESTAMP(3),
  "resumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "license_operation_controls_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ea_operational_snapshots" (
  "id" TEXT NOT NULL,
  "license_id" TEXT NOT NULL,
  "device_id" TEXT,
  "account_login" TEXT NOT NULL,
  "account_server" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "strategy_code" TEXT NOT NULL,
  "magic_number" INTEGER,
  "trade_mode" TEXT,
  "ea_version" TEXT,
  "is_online" BOOLEAN NOT NULL DEFAULT false,
  "terminal_connected" BOOLEAN NOT NULL DEFAULT false,
  "auto_trading_allowed" BOOLEAN NOT NULL DEFAULT false,
  "real_orders_enabled" BOOLEAN NOT NULL DEFAULT false,
  "autonomous_strategy_enabled" BOOLEAN NOT NULL DEFAULT false,
  "paused_by_admin" BOOLEAN NOT NULL DEFAULT false,
  "pause_reason" TEXT,
  "has_open_position" BOOLEAN NOT NULL DEFAULT false,
  "position_side" TEXT,
  "position_volume" DECIMAL(18,6),
  "position_average_price" DECIMAL(18,6),
  "position_current_price" DECIMAL(18,6),
  "position_open_pnl_cents" INTEGER NOT NULL DEFAULT 0,
  "has_pending_orders" BOOLEAN NOT NULL DEFAULT false,
  "pending_orders_count" INTEGER NOT NULL DEFAULT 0,
  "pending_orders_json" JSONB,
  "realized_pnl_day_cents" INTEGER NOT NULL DEFAULT 0,
  "open_pnl_cents" INTEGER NOT NULL DEFAULT 0,
  "total_pnl_day_cents" INTEGER NOT NULL DEFAULT 0,
  "realized_pnl_month_cents" INTEGER NOT NULL DEFAULT 0,
  "total_pnl_month_cents" INTEGER NOT NULL DEFAULT 0,
  "daily_limit_cents" INTEGER NOT NULL DEFAULT 0,
  "daily_used_cents" INTEGER NOT NULL DEFAULT 0,
  "daily_remaining_cents" INTEGER NOT NULL DEFAULT 0,
  "last_tick_at" TIMESTAMP(3),
  "last_heartbeat_at" TIMESTAMP(3),
  "last_command_id" TEXT,
  "last_command_status" TEXT,
  "last_execution_error" TEXT,
  "pnl_status" TEXT,
  "raw_snapshot_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ea_operational_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ea_operational_commands" (
  "id" TEXT NOT NULL,
  "license_id" TEXT NOT NULL,
  "device_id" TEXT,
  "account_login" TEXT NOT NULL,
  "account_server" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "strategy_code" TEXT NOT NULL,
  "magic_number" INTEGER,
  "command_type" "EAOperationalCommandType" NOT NULL,
  "status" "EAOperationalCommandStatus" NOT NULL DEFAULT 'PENDING',
  "requested_by_admin_id" TEXT NOT NULL,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "acked_at" TIMESTAMP(3),
  "executed_at" TIMESTAMP(3),
  "failed_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "confirmation_text" TEXT,
  "admin_note" TEXT,
  "result_code" TEXT,
  "result_message" TEXT,
  "ea_response_json" JSONB,
  "request_payload_json" JSONB,
  "audit_metadata_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ea_operational_commands_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "license_operation_controls_license_id_strategy_code_key"
  ON "license_operation_controls"("license_id", "strategy_code");
CREATE INDEX "license_operation_controls_license_id_idx"
  ON "license_operation_controls"("license_id");

CREATE UNIQUE INDEX "ea_operational_snapshots_license_id_account_login_account_server_symbol_strategy_code_key"
  ON "ea_operational_snapshots"("license_id", "account_login", "account_server", "symbol", "strategy_code");
CREATE INDEX "ea_operational_snapshots_license_id_updated_at_idx"
  ON "ea_operational_snapshots"("license_id", "updated_at");

CREATE INDEX "ea_operational_commands_license_id_status_requested_at_idx"
  ON "ea_operational_commands"("license_id", "status", "requested_at");
CREATE INDEX "ea_operational_commands_device_id_status_idx"
  ON "ea_operational_commands"("device_id", "status");
CREATE INDEX "ea_operational_commands_license_id_command_type_status_idx"
  ON "ea_operational_commands"("license_id", "command_type", "status");

ALTER TABLE "license_operation_controls"
  ADD CONSTRAINT "license_operation_controls_license_id_fkey"
  FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "license_operation_controls"
  ADD CONSTRAINT "license_operation_controls_paused_by_admin_id_fkey"
  FOREIGN KEY ("paused_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ea_operational_snapshots"
  ADD CONSTRAINT "ea_operational_snapshots_license_id_fkey"
  FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ea_operational_commands"
  ADD CONSTRAINT "ea_operational_commands_license_id_fkey"
  FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ea_operational_commands"
  ADD CONSTRAINT "ea_operational_commands_requested_by_admin_id_fkey"
  FOREIGN KEY ("requested_by_admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
