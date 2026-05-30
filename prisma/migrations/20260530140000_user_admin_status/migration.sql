-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "users" ADD COLUMN "blocked_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "blocked_by_user_id" TEXT;
ALTER TABLE "users" ADD COLUMN "inactive_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "inactive_by_user_id" TEXT;
ALTER TABLE "users" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "last_login_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");
