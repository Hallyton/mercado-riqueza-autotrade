-- AlterTable
ALTER TABLE "ea_heartbeats" ADD COLUMN "ea_status" TEXT,
ADD COLUMN "report_payload" JSONB;

-- CreateTable
CREATE TABLE "ea_error_reports" (
    "id" TEXT NOT NULL,
    "license_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "error_code" TEXT,
    "error_message" TEXT NOT NULL,
    "context" JSONB,
    "request_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ea_error_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ea_error_reports_license_id_created_at_idx" ON "ea_error_reports"("license_id", "created_at");

-- AddForeignKey
ALTER TABLE "ea_error_reports" ADD CONSTRAINT "ea_error_reports_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
