-- CreateEnum
CREATE TYPE "RealManualBulkDispatchBatchStatus" AS ENUM ('PREVIEW_READY', 'EXECUTING', 'EXECUTED', 'EXPIRED', 'CANCELLED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "RealManualBulkDispatchItemStatus" AS ENUM ('ELIGIBLE', 'BLOCKED', 'SELECTED', 'DISPATCHED', 'FAILED', 'SKIPPED', 'BLOCKED_AT_EXECUTE');

-- AlterEnum
ALTER TYPE "RealTradePreflightSource" ADD VALUE 'BULK_DISPATCH';

-- AlterTable
ALTER TABLE "instructions" ADD COLUMN "bulk_batch_id" TEXT;

-- CreateTable
CREATE TABLE "real_manual_bulk_dispatch_batches" (
    "id" TEXT NOT NULL,
    "created_by_admin_id" TEXT NOT NULL,
    "status" "RealManualBulkDispatchBatchStatus" NOT NULL DEFAULT 'PREVIEW_READY',
    "symbol" TEXT NOT NULL,
    "side" "InstructionSide" NOT NULL,
    "order_type" "InstructionOrderType" NOT NULL,
    "order_price" DECIMAL(18,6),
    "requested_contracts" INTEGER NOT NULL,
    "management_plan" JSONB NOT NULL,
    "management_plan_hash" TEXT NOT NULL,
    "eligible_count" INTEGER NOT NULL DEFAULT 0,
    "blocked_count" INTEGER NOT NULL DEFAULT 0,
    "total_candidates" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "real_manual_bulk_dispatch_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "real_manual_bulk_dispatch_items" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "license_id" TEXT NOT NULL,
    "account_login" TEXT,
    "account_server" TEXT,
    "symbol" TEXT NOT NULL,
    "magic_number" INTEGER,
    "requested_contracts" INTEGER NOT NULL,
    "status" "RealManualBulkDispatchItemStatus" NOT NULL,
    "reason_code" TEXT,
    "reason_detail" TEXT,
    "action_hint" TEXT,
    "preflight_id" TEXT,
    "instruction_id" TEXT,
    "approval_id" TEXT,
    "account_snapshot_id" TEXT,
    "free_margin" DECIMAL(18,2),
    "max_contracts" INTEGER,
    "ea_online" BOOLEAN,
    "device_active_real" BOOLEAN,
    "heartbeat_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "real_manual_bulk_dispatch_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "instructions_bulk_batch_id_idx" ON "instructions"("bulk_batch_id");

-- CreateIndex
CREATE INDEX "real_manual_bulk_dispatch_batches_status_created_at_idx" ON "real_manual_bulk_dispatch_batches"("status", "created_at");

-- CreateIndex
CREATE INDEX "real_manual_bulk_dispatch_batches_created_by_admin_id_created_at_idx" ON "real_manual_bulk_dispatch_batches"("created_by_admin_id", "created_at");

-- CreateIndex
CREATE INDEX "real_manual_bulk_dispatch_items_batch_id_status_idx" ON "real_manual_bulk_dispatch_items"("batch_id", "status");

-- CreateIndex
CREATE INDEX "real_manual_bulk_dispatch_items_license_id_idx" ON "real_manual_bulk_dispatch_items"("license_id");

-- CreateIndex
CREATE UNIQUE INDEX "real_manual_bulk_dispatch_items_batch_id_license_id_key" ON "real_manual_bulk_dispatch_items"("batch_id", "license_id");

-- AddForeignKey
ALTER TABLE "instructions" ADD CONSTRAINT "instructions_bulk_batch_id_fkey" FOREIGN KEY ("bulk_batch_id") REFERENCES "real_manual_bulk_dispatch_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "real_manual_bulk_dispatch_batches" ADD CONSTRAINT "real_manual_bulk_dispatch_batches_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "real_manual_bulk_dispatch_items" ADD CONSTRAINT "real_manual_bulk_dispatch_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "real_manual_bulk_dispatch_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "real_manual_bulk_dispatch_items" ADD CONSTRAINT "real_manual_bulk_dispatch_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
