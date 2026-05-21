-- CreateEnum
CREATE TYPE "InstructionSource" AS ENUM ('TEST', 'HOMOLOGATION');

-- AlterTable
ALTER TABLE "instructions" ADD COLUMN "source" "InstructionSource";

-- CreateIndex
CREATE INDEX "instructions_source_created_at_idx" ON "instructions"("source", "created_at");
