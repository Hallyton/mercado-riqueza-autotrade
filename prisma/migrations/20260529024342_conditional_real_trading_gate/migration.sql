-- AlterTable
ALTER TABLE "real_trade_preflights" ADD COLUMN     "allowlist_ok" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "auto_dispatch_ok" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "device_ok" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "env_enabled_ok" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "max_contracts_ok" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payment_ok" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "plan_robot_ok" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reason_code" TEXT,
ADD COLUMN     "terms_ok" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "terms_acceptances" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "license_id" TEXT,
    "document_type" TEXT NOT NULL,
    "document_version" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'web',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "terms_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "terms_acceptances_user_id_document_type_idx" ON "terms_acceptances"("user_id", "document_type");

-- CreateIndex
CREATE INDEX "terms_acceptances_subscription_id_idx" ON "terms_acceptances"("subscription_id");

-- AddForeignKey
ALTER TABLE "terms_acceptances" ADD CONSTRAINT "terms_acceptances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
