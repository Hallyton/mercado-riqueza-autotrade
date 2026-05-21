-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CLIENT', 'SUPPORT', 'OPS', 'FINANCE', 'STRATEGY_OPS', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('INCOMPLETE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'PAUSED');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "InstructionSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "InstructionOrderType" AS ENUM ('MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT');

-- CreateEnum
CREATE TYPE "InstructionPurpose" AS ENUM ('ENTRY', 'EXIT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "OrderLogStatus" AS ENUM ('RECEIVED', 'SENT', 'EXECUTED', 'REJECTED', 'IGNORED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('FILLED', 'PARTIAL', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RiskEventType" AS ENUM ('DRAWDOWN_DAILY', 'DRAWDOWN_MONTHLY', 'LICENSE_SUSPENDED', 'SLIPPAGE_EXCEEDED', 'HEARTBEAT_TIMEOUT', 'KILL_SWITCH', 'INADIMPLENCIA', 'VOLUME_CAP', 'MARKET_HOURS', 'OTHER');

-- CreateEnum
CREATE TYPE "KillSwitchScope" AS ENUM ('GLOBAL', 'LICENSE', 'USER');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'ADMIN', 'SYSTEM', 'EA');

-- CreateEnum
CREATE TYPE "TradeMode" AS ENUM ('DEMO', 'REAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CLIENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "max_mt5_accounts" INTEGER NOT NULL DEFAULT 1,
    "max_devices" INTEGER NOT NULL DEFAULT 1,
    "allow_demo" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_prices" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "amount_cents" INTEGER NOT NULL,
    "interval" TEXT NOT NULL,
    "interval_count" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_features" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "gateway" TEXT,
    "gateway_customer_id" TEXT,
    "gateway_subscription_id" TEXT,
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "gateway_invoice_id" TEXT,
    "due_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "gateway_payment_id" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exposure_profiles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exposure_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_exposure_profiles" (
    "plan_id" TEXT NOT NULL,
    "exposure_profile_id" TEXT NOT NULL,

    CONSTRAINT "plan_exposure_profiles_pkey" PRIMARY KEY ("plan_id","exposure_profile_id")
);

-- CreateTable
CREATE TABLE "mt5_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "server" TEXT NOT NULL,
    "broker_name" TEXT,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mt5_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licenses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "mt5_account_id" TEXT,
    "exposure_profile_id" TEXT,
    "status" "LicenseStatus" NOT NULL DEFAULT 'PENDING_ACTIVATION',
    "halt_new_entries" BOOLEAN NOT NULL DEFAULT false,
    "halt_all_trading" BOOLEAN NOT NULL DEFAULT false,
    "activated_at" TIMESTAMP(3),
    "suspended_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_exposure_profiles" (
    "id" TEXT NOT NULL,
    "license_id" TEXT NOT NULL,
    "exposure_profile_id" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by_user_id" TEXT,

    CONSTRAINT "license_exposure_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "license_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "fingerprint" TEXT,
    "ea_version" TEXT,
    "token_hash" TEXT NOT NULL,
    "last_seen_at" TIMESTAMP(3),
    "rotate_after" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activation_codes" (
    "id" TEXT NOT NULL,
    "license_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activation_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructions" (
    "id" TEXT NOT NULL,
    "license_id" TEXT NOT NULL,
    "purpose" "InstructionPurpose" NOT NULL DEFAULT 'ENTRY',
    "symbol" TEXT NOT NULL,
    "side" "InstructionSide" NOT NULL,
    "order_type" "InstructionOrderType" NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "stop_loss" DECIMAL(18,6),
    "take_profit" DECIMAL(18,6),
    "idempotency_key" TEXT NOT NULL,
    "request_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "current_status" "OrderLogStatus" NOT NULL DEFAULT 'RECEIVED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instructions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instruction_status_logs" (
    "id" TEXT NOT NULL,
    "instruction_id" TEXT NOT NULL,
    "status" "OrderLogStatus" NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instruction_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executions" (
    "id" TEXT NOT NULL,
    "instruction_id" TEXT NOT NULL,
    "license_id" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL,
    "broker_ticket" TEXT,
    "fill_price" DECIMAL(18,6),
    "fill_quantity" DECIMAL(18,6),
    "slippage" DECIMAL(18,6),
    "error_code" TEXT,
    "error_message" TEXT,
    "executed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position_snapshots" (
    "id" TEXT NOT NULL,
    "license_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "avg_price" DECIMAL(18,6) NOT NULL,
    "unrealized_pnl" DECIMAL(18,2),
    "snapshot_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "position_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_pnls" (
    "id" TEXT NOT NULL,
    "license_id" TEXT NOT NULL,
    "trade_date" DATE NOT NULL,
    "realized_pnl" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "unrealized_pnl" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "equity_close" DECIMAL(18,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_pnls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_events" (
    "id" TEXT NOT NULL,
    "license_id" TEXT,
    "user_id" TEXT,
    "type" "RiskEventType" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kill_switch_logs" (
    "id" TEXT NOT NULL,
    "scope" "KillSwitchScope" NOT NULL,
    "license_id" TEXT,
    "user_id" TEXT,
    "enabled" BOOLEAN NOT NULL,
    "reason" TEXT,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kill_switch_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equity_snapshots" (
    "id" TEXT NOT NULL,
    "license_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "equity" DECIMAL(18,2) NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL,
    "margin" DECIMAL(18,2),
    "trade_mode" "TradeMode",
    "snapshot_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equity_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmark_ibov_daily" (
    "id" TEXT NOT NULL,
    "trade_date" DATE NOT NULL,
    "close_value" DECIMAL(18,4) NOT NULL,
    "daily_return" DECIMAL(10,6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benchmark_ibov_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_metrics" (
    "id" TEXT NOT NULL,
    "license_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "return_pct" DECIMAL(10,4),
    "benchmark_pct" DECIMAL(10,4),
    "win_rate" DECIMAL(10,4),
    "trade_count" INTEGER,
    "calculated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ea_heartbeats" (
    "id" TEXT NOT NULL,
    "license_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "ea_version" TEXT,
    "equity" DECIMAL(18,2),
    "balance" DECIMAL(18,2),
    "margin" DECIMAL(18,2),
    "trade_mode" "TradeMode",
    "positions_hash" TEXT,
    "pending_count" INTEGER NOT NULL DEFAULT 0,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ea_heartbeats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_type" "AuditActorType" NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "request_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "plans_slug_key" ON "plans"("slug");

-- CreateIndex
CREATE INDEX "plan_prices_plan_id_is_active_idx" ON "plan_prices"("plan_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "plan_features_plan_id_key_key" ON "plan_features"("plan_id", "key");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_status_idx" ON "subscriptions"("user_id", "status");

-- CreateIndex
CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions"("plan_id");

-- CreateIndex
CREATE INDEX "invoices_subscription_id_status_idx" ON "invoices"("subscription_id", "status");

-- CreateIndex
CREATE INDEX "payments_invoice_id_idx" ON "payments"("invoice_id");

-- CreateIndex
CREATE INDEX "webhook_events_gateway_event_type_idx" ON "webhook_events"("gateway", "event_type");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_gateway_event_id_key" ON "webhook_events"("gateway", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "exposure_profiles_slug_key" ON "exposure_profiles"("slug");

-- CreateIndex
CREATE INDEX "mt5_accounts_user_id_idx" ON "mt5_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "mt5_accounts_login_server_key" ON "mt5_accounts"("login", "server");

-- CreateIndex
CREATE INDEX "licenses_user_id_status_idx" ON "licenses"("user_id", "status");

-- CreateIndex
CREATE INDEX "licenses_mt5_account_id_idx" ON "licenses"("mt5_account_id");

-- CreateIndex
CREATE INDEX "licenses_subscription_id_idx" ON "licenses"("subscription_id");

-- CreateIndex
CREATE INDEX "license_exposure_profiles_license_id_changed_at_idx" ON "license_exposure_profiles"("license_id", "changed_at");

-- CreateIndex
CREATE INDEX "devices_license_id_idx" ON "devices"("license_id");

-- CreateIndex
CREATE UNIQUE INDEX "devices_license_id_device_id_key" ON "devices"("license_id", "device_id");

-- CreateIndex
CREATE INDEX "activation_codes_license_id_expires_at_idx" ON "activation_codes"("license_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "instructions_idempotency_key_key" ON "instructions"("idempotency_key");

-- CreateIndex
CREATE INDEX "instructions_license_id_current_status_created_at_idx" ON "instructions"("license_id", "current_status", "created_at");

-- CreateIndex
CREATE INDEX "instruction_status_logs_instruction_id_created_at_idx" ON "instruction_status_logs"("instruction_id", "created_at");

-- CreateIndex
CREATE INDEX "executions_license_id_created_at_idx" ON "executions"("license_id", "created_at");

-- CreateIndex
CREATE INDEX "executions_instruction_id_idx" ON "executions"("instruction_id");

-- CreateIndex
CREATE INDEX "position_snapshots_license_id_snapshot_at_idx" ON "position_snapshots"("license_id", "snapshot_at");

-- CreateIndex
CREATE UNIQUE INDEX "daily_pnls_license_id_trade_date_key" ON "daily_pnls"("license_id", "trade_date");

-- CreateIndex
CREATE INDEX "risk_events_license_id_created_at_idx" ON "risk_events"("license_id", "created_at");

-- CreateIndex
CREATE INDEX "risk_events_type_created_at_idx" ON "risk_events"("type", "created_at");

-- CreateIndex
CREATE INDEX "kill_switch_logs_license_id_created_at_idx" ON "kill_switch_logs"("license_id", "created_at");

-- CreateIndex
CREATE INDEX "equity_snapshots_license_id_snapshot_at_idx" ON "equity_snapshots"("license_id", "snapshot_at");

-- CreateIndex
CREATE INDEX "equity_snapshots_user_id_snapshot_at_idx" ON "equity_snapshots"("user_id", "snapshot_at");

-- CreateIndex
CREATE UNIQUE INDEX "benchmark_ibov_daily_trade_date_key" ON "benchmark_ibov_daily"("trade_date");

-- CreateIndex
CREATE INDEX "portfolio_metrics_license_id_period_idx" ON "portfolio_metrics"("license_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_metrics_license_id_period_calculated_at_key" ON "portfolio_metrics"("license_id", "period", "calculated_at");

-- CreateIndex
CREATE INDEX "ea_heartbeats_license_id_received_at_idx" ON "ea_heartbeats"("license_id", "received_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_prices" ADD CONSTRAINT "plan_prices_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_features" ADD CONSTRAINT "plan_features_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_exposure_profiles" ADD CONSTRAINT "plan_exposure_profiles_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_exposure_profiles" ADD CONSTRAINT "plan_exposure_profiles_exposure_profile_id_fkey" FOREIGN KEY ("exposure_profile_id") REFERENCES "exposure_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mt5_accounts" ADD CONSTRAINT "mt5_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_mt5_account_id_fkey" FOREIGN KEY ("mt5_account_id") REFERENCES "mt5_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_exposure_profile_id_fkey" FOREIGN KEY ("exposure_profile_id") REFERENCES "exposure_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_exposure_profiles" ADD CONSTRAINT "license_exposure_profiles_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_exposure_profiles" ADD CONSTRAINT "license_exposure_profiles_exposure_profile_id_fkey" FOREIGN KEY ("exposure_profile_id") REFERENCES "exposure_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activation_codes" ADD CONSTRAINT "activation_codes_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructions" ADD CONSTRAINT "instructions_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instruction_status_logs" ADD CONSTRAINT "instruction_status_logs_instruction_id_fkey" FOREIGN KEY ("instruction_id") REFERENCES "instructions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_instruction_id_fkey" FOREIGN KEY ("instruction_id") REFERENCES "instructions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_snapshots" ADD CONSTRAINT "position_snapshots_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_pnls" ADD CONSTRAINT "daily_pnls_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_events" ADD CONSTRAINT "risk_events_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_events" ADD CONSTRAINT "risk_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kill_switch_logs" ADD CONSTRAINT "kill_switch_logs_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_snapshots" ADD CONSTRAINT "equity_snapshots_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_snapshots" ADD CONSTRAINT "equity_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_metrics" ADD CONSTRAINT "portfolio_metrics_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ea_heartbeats" ADD CONSTRAINT "ea_heartbeats_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

