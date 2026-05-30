-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'REVOKED', 'BLOCKED');

-- AlterTable
ALTER TABLE "devices" ADD COLUMN "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "devices" ADD COLUMN "revoked_by_user_id" TEXT;
ALTER TABLE "devices" ADD COLUMN "blocked_at" TIMESTAMP(3);
ALTER TABLE "devices" ADD COLUMN "blocked_by_user_id" TEXT;

-- Backfill revoked devices
UPDATE "devices" SET "status" = 'REVOKED' WHERE "revoked_at" IS NOT NULL;

-- Index
CREATE INDEX "devices_license_id_status_idx" ON "devices"("license_id", "status");
