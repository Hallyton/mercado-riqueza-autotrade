-- DailyFinancialRiskState — rastreio seguro do último report EA
ALTER TABLE "daily_financial_risk_states"
ADD COLUMN IF NOT EXISTS "last_report_request_id" TEXT,
ADD COLUMN IF NOT EXISTS "last_report_source" TEXT,
ADD COLUMN IF NOT EXISTS "last_report_received_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "received_trade_date" TEXT;
