-- CreateEnum
CREATE TYPE "InstructionOperationalMode" AS ENUM ('LIVE_MARKET');

-- AlterTable
ALTER TABLE "instructions" ADD COLUMN "operational_mode" "InstructionOperationalMode";

-- AlterTable
ALTER TABLE "real_manual_bulk_dispatch_batches" ADD COLUMN "operational_mode" "InstructionOperationalMode" NOT NULL DEFAULT 'LIVE_MARKET';
