-- CreateEnum
CREATE TYPE "AdminPaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "RobotProductStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RobotInstanceStatus" AS ENUM ('AWAITING_PAYMENT', 'AWAITING_APPROVAL', 'AWAITING_EA_ACTIVATION', 'EA_ONLINE', 'REAL_PENDING_VALIDATION', 'OPERATIONAL_CONTROLLED', 'SUSPENDED', 'BLOCKED');

-- DropIndex
DROP INDEX "devices_license_id_idx";

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "max_robots" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "admin_payment_status" "AdminPaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "robot_count" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "robot_products" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "RobotProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "monthly_price_cents" INTEGER NOT NULL,
    "max_instances_per_user" INTEGER NOT NULL DEFAULT 1,
    "is_black_box" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "robot_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "robot_instances" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "license_id" TEXT,
    "subscription_id" TEXT NOT NULL,
    "robot_product_id" TEXT NOT NULL,
    "magic_number" INTEGER,
    "symbol" TEXT,
    "status" "RobotInstanceStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activated_at" TIMESTAMP(3),
    "suspended_at" TIMESTAMP(3),
    "blocked_at" TIMESTAMP(3),

    CONSTRAINT "robot_instances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "robot_products_slug_key" ON "robot_products"("slug");

-- CreateIndex
CREATE INDEX "robot_instances_user_id_status_idx" ON "robot_instances"("user_id", "status");

-- CreateIndex
CREATE INDEX "robot_instances_subscription_id_idx" ON "robot_instances"("subscription_id");

-- CreateIndex
CREATE INDEX "robot_instances_license_id_idx" ON "robot_instances"("license_id");

-- CreateIndex
CREATE UNIQUE INDEX "robot_instances_magic_number_key" ON "robot_instances"("magic_number");

-- AddForeignKey
ALTER TABLE "robot_instances" ADD CONSTRAINT "robot_instances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "robot_instances" ADD CONSTRAINT "robot_instances_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "robot_instances" ADD CONSTRAINT "robot_instances_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "robot_instances" ADD CONSTRAINT "robot_instances_robot_product_id_fkey" FOREIGN KEY ("robot_product_id") REFERENCES "robot_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
