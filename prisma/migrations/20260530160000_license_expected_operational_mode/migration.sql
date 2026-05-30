-- AlterTable
ALTER TABLE "licenses" ADD COLUMN "expected_trade_mode" "TradeMode" NOT NULL DEFAULT 'DEMO';
ALTER TABLE "licenses" ADD COLUMN "expected_account_login" TEXT;
ALTER TABLE "licenses" ADD COLUMN "expected_account_server" TEXT;
ALTER TABLE "licenses" ADD COLUMN "expected_symbol" TEXT;
ALTER TABLE "licenses" ADD COLUMN "expected_magic_number" INTEGER;
