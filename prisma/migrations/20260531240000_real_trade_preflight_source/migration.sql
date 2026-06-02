-- CreateEnum
CREATE TYPE "RealTradePreflightSource" AS ENUM ('INSTRUCTION', 'DRY_RUN');

-- AlterTable
ALTER TABLE "real_trade_preflights" ADD COLUMN "source" "RealTradePreflightSource" NOT NULL DEFAULT 'INSTRUCTION';

-- CreateIndex
CREATE INDEX "real_trade_preflights_source_created_at_idx" ON "real_trade_preflights"("source", "created_at");
