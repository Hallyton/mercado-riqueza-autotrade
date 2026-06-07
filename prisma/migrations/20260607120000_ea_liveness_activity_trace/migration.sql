-- AlterTable
ALTER TABLE "devices" ADD COLUMN "last_activity_at" TIMESTAMP(3),
ADD COLUMN "last_activity_source" TEXT,
ADD COLUMN "last_activity_request_id" TEXT;

-- AlterEnum
ALTER TYPE "EAOperationalCommandType" ADD VALUE 'HEALTH_CHECK';
