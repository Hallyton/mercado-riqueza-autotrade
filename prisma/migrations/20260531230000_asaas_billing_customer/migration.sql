-- Asaas billing customer + subscription recurrence fields (Fase 13.3)

ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "provider_subscription_id" TEXT,
  ADD COLUMN IF NOT EXISTS "recurring_enabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "billing_customers" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "provider" "BillingProvider" NOT NULL,
  "provider_customer_id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "cpf_cnpj" TEXT,
  "phone" TEXT,
  "external_reference" TEXT,
  "raw_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "billing_customers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "billing_customers_provider_provider_customer_id_key"
  ON "billing_customers"("provider", "provider_customer_id");

CREATE UNIQUE INDEX IF NOT EXISTS "billing_customers_provider_user_id_key"
  ON "billing_customers"("provider", "user_id");

CREATE INDEX IF NOT EXISTS "billing_customers_user_id_idx" ON "billing_customers"("user_id");

ALTER TABLE "billing_customers"
  ADD CONSTRAINT "billing_customers_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
