-- CreateEnum
CREATE TYPE "MasterSignalStatus" AS ENUM ('RECEIVED', 'VALIDATED', 'REJECTED', 'DISPATCHING', 'DISPATCHED', 'PARTIALLY_DISPATCHED', 'FAILED');

-- CreateEnum
CREATE TYPE "MasterSignalDispatchStatus" AS ENUM ('SKIPPED', 'INSTRUCTION_CREATED', 'FAILED');

-- CreateEnum
CREATE TYPE "MasterSignalSource" AS ENUM ('MASTER_EA', 'ADMIN_TEST', 'SIMULATOR');

-- DropIndex
DROP INDEX "instructions_source_created_at_idx";

-- CreateTable
CREATE TABLE "master_signals" (
    "id" TEXT NOT NULL,
    "master_signal_id" TEXT NOT NULL,
    "source" "MasterSignalSource" NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" "InstructionSide" NOT NULL,
    "order_type" "InstructionOrderType" NOT NULL,
    "purpose" "InstructionPurpose" NOT NULL,
    "profile_slug" TEXT,
    "status" "MasterSignalStatus" NOT NULL DEFAULT 'RECEIVED',
    "idempotency_key" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validated_at" TIMESTAMP(3),
    "dispatched_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "rejected_reason" TEXT,
    "raw_payload_redacted" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_signal_dispatches" (
    "id" TEXT NOT NULL,
    "master_signal_id" TEXT NOT NULL,
    "license_id" TEXT NOT NULL,
    "instruction_id" TEXT,
    "status" "MasterSignalDispatchStatus" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_signal_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "master_signals_master_signal_id_key" ON "master_signals"("master_signal_id");

-- CreateIndex
CREATE UNIQUE INDEX "master_signals_idempotency_key_key" ON "master_signals"("idempotency_key");

-- CreateIndex
CREATE INDEX "master_signals_status_idx" ON "master_signals"("status");

-- CreateIndex
CREATE INDEX "master_signals_source_idx" ON "master_signals"("source");

-- CreateIndex
CREATE INDEX "master_signals_created_at_idx" ON "master_signals"("created_at");

-- CreateIndex
CREATE INDEX "master_signals_dispatched_at_idx" ON "master_signals"("dispatched_at");

-- CreateIndex
CREATE INDEX "master_signals_profile_slug_idx" ON "master_signals"("profile_slug");

-- CreateIndex
CREATE UNIQUE INDEX "master_signal_dispatches_instruction_id_key" ON "master_signal_dispatches"("instruction_id");

-- CreateIndex
CREATE INDEX "master_signal_dispatches_license_id_idx" ON "master_signal_dispatches"("license_id");

-- CreateIndex
CREATE INDEX "master_signal_dispatches_instruction_id_idx" ON "master_signal_dispatches"("instruction_id");

-- CreateIndex
CREATE INDEX "master_signal_dispatches_status_idx" ON "master_signal_dispatches"("status");

-- CreateIndex
CREATE INDEX "master_signal_dispatches_created_at_idx" ON "master_signal_dispatches"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "master_signal_dispatches_master_signal_id_license_id_key" ON "master_signal_dispatches"("master_signal_id", "license_id");

-- AddForeignKey
ALTER TABLE "master_signal_dispatches" ADD CONSTRAINT "master_signal_dispatches_master_signal_id_fkey" FOREIGN KEY ("master_signal_id") REFERENCES "master_signals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_signal_dispatches" ADD CONSTRAINT "master_signal_dispatches_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_signal_dispatches" ADD CONSTRAINT "master_signal_dispatches_instruction_id_fkey" FOREIGN KEY ("instruction_id") REFERENCES "instructions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
