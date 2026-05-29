-- CreateEnum
CREATE TYPE "RealTradingApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED', 'REVOKED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "AccountSnapshotType" AS ENUM ('PRE_MARKET', 'PRE_TRADE', 'POST_MARKET', 'MANUAL');

-- CreateEnum
CREATE TYPE "AccountSnapshotSource" AS ENUM ('EA', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "RealTradePreflightStatus" AS ENUM ('PASSED', 'FAILED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ProtectionMode" AS ENUM ('ATTACHED_SL_TP', 'PENDING_PROTECTION_ORDERS', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ProtectionStatus" AS ENUM ('PROTECTION_CONFIRMED', 'PROTECTION_FAILED', 'PROTECTION_PENDING', 'NOT_REQUIRED_FOR_DEBUG');

-- AlterTable
ALTER TABLE "executions" ADD COLUMN     "account_login" TEXT,
ADD COLUMN     "account_server" TEXT,
ADD COLUMN     "magic_number" INTEGER,
ADD COLUMN     "symbol" TEXT;

-- AlterTable
ALTER TABLE "instructions" ADD COLUMN     "account_login" TEXT,
ADD COLUMN     "account_server" TEXT,
ADD COLUMN     "magic_number" INTEGER,
ADD COLUMN     "protection_blocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requires_protection_confirmation" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "real_trading_approvals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "license_id" TEXT NOT NULL,
    "robot_instance_id" TEXT,
    "account_login" TEXT NOT NULL,
    "account_server" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "magic_number" INTEGER NOT NULL,
    "max_contracts" INTEGER NOT NULL DEFAULT 1,
    "min_free_margin" DECIMAL(18,2),
    "margin_buffer_percent" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "allow_real" BOOLEAN NOT NULL DEFAULT false,
    "status" "RealTradingApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by_admin_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "real_trading_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_snapshots" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "license_id" TEXT NOT NULL,
    "robot_instance_id" TEXT,
    "snapshot_type" "AccountSnapshotType" NOT NULL,
    "account_login" TEXT NOT NULL,
    "account_server" TEXT NOT NULL,
    "environment" "TradeMode" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "balance" DECIMAL(18,2) NOT NULL,
    "equity" DECIMAL(18,2) NOT NULL,
    "margin" DECIMAL(18,2),
    "free_margin" DECIMAL(18,2),
    "margin_level" DECIMAL(10,4),
    "open_positions_json" JSONB,
    "pending_orders_json" JSONB,
    "active_magic_numbers_json" JSONB,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "source" "AccountSnapshotSource" NOT NULL DEFAULT 'EA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "real_trade_preflights" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "license_id" TEXT NOT NULL,
    "instruction_id" TEXT,
    "master_signal_id" TEXT,
    "account_snapshot_id" TEXT,
    "account_login" TEXT NOT NULL,
    "account_server" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "magic_number" INTEGER NOT NULL,
    "requested_contracts" INTEGER NOT NULL DEFAULT 1,
    "required_margin" DECIMAL(18,2),
    "free_margin" DECIMAL(18,2),
    "margin_ok" BOOLEAN NOT NULL DEFAULT false,
    "ea_online" BOOLEAN NOT NULL DEFAULT false,
    "account_ok" BOOLEAN NOT NULL DEFAULT false,
    "symbol_ok" BOOLEAN NOT NULL DEFAULT false,
    "magic_number_ok" BOOLEAN NOT NULL DEFAULT false,
    "subscription_ok" BOOLEAN,
    "license_ok" BOOLEAN NOT NULL DEFAULT false,
    "real_approval_ok" BOOLEAN NOT NULL DEFAULT false,
    "snapshot_ok" BOOLEAN NOT NULL DEFAULT false,
    "existing_exposure_ok" BOOLEAN NOT NULL DEFAULT false,
    "protection_previous_ok" BOOLEAN NOT NULL DEFAULT false,
    "status" "RealTradePreflightStatus" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "real_trade_preflights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_protection_reports" (
    "id" TEXT NOT NULL,
    "instruction_id" TEXT NOT NULL,
    "execution_id" TEXT,
    "license_id" TEXT NOT NULL,
    "account_login" TEXT NOT NULL,
    "account_server" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "magic_number" INTEGER NOT NULL,
    "entry_order_ticket" TEXT,
    "entry_deal_ticket" TEXT,
    "stop_loss_present" BOOLEAN NOT NULL DEFAULT false,
    "take_profit_present" BOOLEAN NOT NULL DEFAULT false,
    "stop_loss_price" DECIMAL(18,6),
    "take_profit_price" DECIMAL(18,6),
    "stop_order_ticket" TEXT,
    "take_order_ticket" TEXT,
    "protection_mode" "ProtectionMode" NOT NULL DEFAULT 'UNKNOWN',
    "protection_status" "ProtectionStatus" NOT NULL,
    "error_code" TEXT,
    "error_message_redacted" TEXT,
    "reported_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_protection_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "real_trading_approvals_license_id_status_idx" ON "real_trading_approvals"("license_id", "status");

-- CreateIndex
CREATE INDEX "real_trading_approvals_user_id_status_idx" ON "real_trading_approvals"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "real_trading_approvals_license_id_account_login_account_ser_key" ON "real_trading_approvals"("license_id", "account_login", "account_server", "symbol", "magic_number");

-- CreateIndex
CREATE INDEX "account_snapshots_license_id_snapshot_type_captured_at_idx" ON "account_snapshots"("license_id", "snapshot_type", "captured_at");

-- CreateIndex
CREATE INDEX "account_snapshots_account_login_account_server_captured_at_idx" ON "account_snapshots"("account_login", "account_server", "captured_at");

-- CreateIndex
CREATE INDEX "real_trade_preflights_license_id_created_at_idx" ON "real_trade_preflights"("license_id", "created_at");

-- CreateIndex
CREATE INDEX "real_trade_preflights_instruction_id_idx" ON "real_trade_preflights"("instruction_id");

-- CreateIndex
CREATE INDEX "execution_protection_reports_license_id_magic_number_create_idx" ON "execution_protection_reports"("license_id", "magic_number", "created_at");

-- CreateIndex
CREATE INDEX "execution_protection_reports_instruction_id_idx" ON "execution_protection_reports"("instruction_id");

-- CreateIndex
CREATE INDEX "executions_license_id_magic_number_idx" ON "executions"("license_id", "magic_number");

-- CreateIndex
CREATE INDEX "instructions_license_id_magic_number_idx" ON "instructions"("license_id", "magic_number");

-- AddForeignKey
ALTER TABLE "real_trading_approvals" ADD CONSTRAINT "real_trading_approvals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "real_trading_approvals" ADD CONSTRAINT "real_trading_approvals_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_snapshots" ADD CONSTRAINT "account_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_snapshots" ADD CONSTRAINT "account_snapshots_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "real_trade_preflights" ADD CONSTRAINT "real_trade_preflights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "real_trade_preflights" ADD CONSTRAINT "real_trade_preflights_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "real_trade_preflights" ADD CONSTRAINT "real_trade_preflights_instruction_id_fkey" FOREIGN KEY ("instruction_id") REFERENCES "instructions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_protection_reports" ADD CONSTRAINT "execution_protection_reports_instruction_id_fkey" FOREIGN KEY ("instruction_id") REFERENCES "instructions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_protection_reports" ADD CONSTRAINT "execution_protection_reports_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_protection_reports" ADD CONSTRAINT "execution_protection_reports_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
