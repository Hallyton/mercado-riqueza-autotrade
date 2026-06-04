-- AlterEnum
ALTER TYPE "InstructionSource" ADD VALUE 'AUTONOMOUS_STRATEGY';
ALTER TYPE "InstructionOperationalMode" ADD VALUE 'AUTONOMOUS_STRATEGY';

-- CreateEnum
CREATE TYPE "DailyFinancialRiskStatus" AS ENUM ('OK', 'WARNING', 'BLOCKED');
CREATE TYPE "AutonomousStrategyDecisionResult" AS ENUM ('ALLOWED', 'BLOCKED');

-- AlterTable robot_products
ALTER TABLE "robot_products" ADD COLUMN "strategy_code" TEXT;
ALTER TABLE "robot_products" ADD COLUMN "strategy_version" TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE "robot_products" ADD COLUMN "market" TEXT;
ALTER TABLE "robot_products" ADD COLUMN "default_symbol" TEXT;
ALTER TABLE "robot_products" ADD COLUMN "requires_daily_financial_stop" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "robot_products" ADD COLUMN "requires_real_trading_approval" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "robot_products" ADD COLUMN "requires_pre_market" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "robot_products" ADD COLUMN "requires_protection" BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX "robot_products_strategy_code_key" ON "robot_products"("strategy_code");

-- AlterTable robot_instances
ALTER TABLE "robot_instances" ADD COLUMN "autonomous_strategy_code" TEXT;
ALTER TABLE "robot_instances" ADD COLUMN "autonomous_strategy_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable instrument_point_values
CREATE TABLE "instrument_point_values" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "cents_per_point_per_contract" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "instrument_point_values_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "instrument_point_values_symbol_key" ON "instrument_point_values"("symbol");

INSERT INTO "instrument_point_values" ("id", "symbol", "cents_per_point_per_contract", "currency", "updated_at")
VALUES ('ipv_wdo_default', 'WDO', 1000, 'BRL', CURRENT_TIMESTAMP)
ON CONFLICT ("symbol") DO NOTHING;

INSERT INTO "instrument_point_values" ("id", "symbol", "cents_per_point_per_contract", "currency", "updated_at")
VALUES ('ipv_wdon26_default', 'WDON26', 1000, 'BRL', CURRENT_TIMESTAMP)
ON CONFLICT ("symbol") DO NOTHING;

-- CreateTable daily_financial_risk_limits
CREATE TABLE "daily_financial_risk_limits" (
    "id" TEXT NOT NULL,
    "license_id" TEXT NOT NULL,
    "account_login" TEXT NOT NULL,
    "account_server" TEXT NOT NULL,
    "strategy_code" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "daily_loss_limit_cents" INTEGER NOT NULL,
    "include_open_pnl" BOOLEAN NOT NULL DEFAULT true,
    "reset_timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "reset_at_time" TEXT NOT NULL DEFAULT '00:00',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "daily_financial_risk_limits_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "daily_financial_risk_limits_license_id_account_login_account_server_strategy_code_symbol_key" ON "daily_financial_risk_limits"("license_id", "account_login", "account_server", "strategy_code", "symbol");
CREATE INDEX "daily_financial_risk_limits_license_id_idx" ON "daily_financial_risk_limits"("license_id");
ALTER TABLE "daily_financial_risk_limits" ADD CONSTRAINT "daily_financial_risk_limits_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable daily_financial_risk_states
CREATE TABLE "daily_financial_risk_states" (
    "id" TEXT NOT NULL,
    "license_id" TEXT NOT NULL,
    "account_login" TEXT NOT NULL,
    "account_server" TEXT NOT NULL,
    "strategy_code" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "trade_date" TEXT NOT NULL,
    "realized_pnl_cents" INTEGER NOT NULL DEFAULT 0,
    "open_pnl_cents" INTEGER NOT NULL DEFAULT 0,
    "total_pnl_cents" INTEGER NOT NULL DEFAULT 0,
    "limit_cents" INTEGER NOT NULL DEFAULT 0,
    "remaining_loss_cents" INTEGER NOT NULL DEFAULT 0,
    "status" "DailyFinancialRiskStatus" NOT NULL DEFAULT 'OK',
    "last_updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "daily_financial_risk_states_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "daily_financial_risk_states_license_id_account_login_account_server_strategy_code_symbol_trade_date_key" ON "daily_financial_risk_states"("license_id", "account_login", "account_server", "strategy_code", "symbol", "trade_date");
CREATE INDEX "daily_financial_risk_states_license_id_trade_date_idx" ON "daily_financial_risk_states"("license_id", "trade_date");
ALTER TABLE "daily_financial_risk_states" ADD CONSTRAINT "daily_financial_risk_states_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable autonomous_strategy_decisions
CREATE TABLE "autonomous_strategy_decisions" (
    "id" TEXT NOT NULL,
    "license_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "strategy_code" TEXT NOT NULL,
    "strategy_version" TEXT NOT NULL,
    "account_login" TEXT NOT NULL,
    "account_server" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "magic_number" INTEGER NOT NULL,
    "side" "InstructionSide" NOT NULL,
    "order_type" "InstructionOrderType" NOT NULL,
    "order_price" DECIMAL(18,6),
    "requested_contracts" INTEGER NOT NULL,
    "planned_management_plan" JSONB NOT NULL,
    "approved_management_plan" JSONB,
    "decision" "AutonomousStrategyDecisionResult" NOT NULL,
    "reason_code" TEXT,
    "detail" TEXT,
    "signal_reason" TEXT,
    "daily_risk_snapshot" JSONB,
    "instruction_id" TEXT,
    "risk_session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "autonomous_strategy_decisions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "autonomous_strategy_decisions_instruction_id_key" ON "autonomous_strategy_decisions"("instruction_id");
CREATE INDEX "autonomous_strategy_decisions_license_id_created_at_idx" ON "autonomous_strategy_decisions"("license_id", "created_at");
CREATE INDEX "autonomous_strategy_decisions_strategy_code_created_at_idx" ON "autonomous_strategy_decisions"("strategy_code", "created_at");
CREATE INDEX "autonomous_strategy_decisions_decision_created_at_idx" ON "autonomous_strategy_decisions"("decision", "created_at");
ALTER TABLE "autonomous_strategy_decisions" ADD CONSTRAINT "autonomous_strategy_decisions_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "autonomous_strategy_decisions" ADD CONSTRAINT "autonomous_strategy_decisions_instruction_id_fkey" FOREIGN KEY ("instruction_id") REFERENCES "instructions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
