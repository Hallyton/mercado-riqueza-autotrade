-- AlterEnum
ALTER TYPE "InstructionSource" ADD VALUE IF NOT EXISTS 'REAL_MANUAL';

-- AlterTable
ALTER TABLE "instructions"
ADD COLUMN "order_price" DECIMAL(18,6);
