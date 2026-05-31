-- Billing automation foundation (Fase 13.2)

CREATE TYPE "BillingProvider" AS ENUM ('MANUAL', 'MOCK', 'ASAAS', 'MERCADO_PAGO', 'STRIPE');
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('CREATED', 'PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CARD', 'BOLETO', 'MANUAL', 'UNKNOWN');

ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'OVERDUE';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'FAILED';

ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "next_billing_at" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "last_invoice_id" TEXT;

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "user_id" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "plan_id" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "provider" "BillingProvider" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "provider_invoice_id" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "payment_url" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "pix_qr_code_url" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "pix_copy_paste" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "metadata_json" JSONB;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "period_start" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "period_end" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "invoices" i
SET
  "user_id" = s."user_id",
  "plan_id" = s."plan_id",
  "updated_at" = COALESCE(i."created_at", CURRENT_TIMESTAMP)
FROM "subscriptions" s
WHERE i."subscription_id" = s."id" AND i."user_id" IS NULL;

ALTER TABLE "invoices" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "invoices" ALTER COLUMN "plan_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "invoices_user_id_status_idx" ON "invoices"("user_id", "status");
CREATE INDEX IF NOT EXISTS "invoices_plan_id_idx" ON "invoices"("plan_id");

CREATE TABLE IF NOT EXISTS "payment_attempts" (
  "id" TEXT NOT NULL,
  "invoice_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "provider" "BillingProvider" NOT NULL DEFAULT 'MANUAL',
  "method" "PaymentMethod" NOT NULL DEFAULT 'MANUAL',
  "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'CREATED',
  "amount_cents" INTEGER NOT NULL,
  "provider_payment_id" TEXT,
  "checkout_url" TEXT,
  "failure_code" TEXT,
  "failure_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_attempts_provider_provider_payment_id_key"
  ON "payment_attempts"("provider", "provider_payment_id");
CREATE INDEX IF NOT EXISTS "payment_attempts_invoice_id_status_idx" ON "payment_attempts"("invoice_id", "status");
CREATE INDEX IF NOT EXISTS "payment_attempts_user_id_idx" ON "payment_attempts"("user_id");

CREATE TABLE IF NOT EXISTS "payment_provider_events" (
  "id" TEXT NOT NULL,
  "provider" "BillingProvider" NOT NULL,
  "event_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "invoice_id" TEXT,
  "payment_attempt_id" TEXT,
  "raw_json" JSONB NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "process_status" TEXT NOT NULL DEFAULT 'pending',
  "process_error" TEXT,
  "processed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_provider_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_provider_events_provider_event_id_key"
  ON "payment_provider_events"("provider", "event_id");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_provider_events_idempotency_key_key"
  ON "payment_provider_events"("idempotency_key");
CREATE INDEX IF NOT EXISTS "payment_provider_events_provider_event_type_idx"
  ON "payment_provider_events"("provider", "event_type");

ALTER TABLE "payment_attempts"
  ADD CONSTRAINT "payment_attempts_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_attempts"
  ADD CONSTRAINT "payment_attempts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_provider_events"
  ADD CONSTRAINT "payment_provider_events_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_provider_events"
  ADD CONSTRAINT "payment_provider_events_payment_attempt_id_fkey"
  FOREIGN KEY ("payment_attempt_id") REFERENCES "payment_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_last_invoice_id_key" ON "subscriptions"("last_invoice_id");

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_last_invoice_id_fkey"
  FOREIGN KEY ("last_invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
