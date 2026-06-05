-- CreateEnum
CREATE TYPE "StrategyRuntimeConfigStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "strategy_runtime_configs" (
    "id" TEXT NOT NULL,
    "license_id" TEXT NOT NULL,
    "robot_instance_id" TEXT,
    "strategy_code" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "StrategyRuntimeConfigStatus" NOT NULL DEFAULT 'DRAFT',
    "config" JSONB NOT NULL,
    "config_hash" TEXT NOT NULL,
    "created_by_admin_id" TEXT NOT NULL,
    "published_by_admin_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "strategy_runtime_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategy_runtime_config_history" (
    "id" TEXT NOT NULL,
    "strategy_runtime_config_id" TEXT NOT NULL,
    "license_id" TEXT NOT NULL,
    "robot_instance_id" TEXT,
    "strategy_code" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "StrategyRuntimeConfigStatus" NOT NULL,
    "config" JSONB NOT NULL,
    "config_hash" TEXT NOT NULL,
    "actor_admin_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "strategy_runtime_config_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "strategy_runtime_configs_license_id_strategy_code_status_idx" ON "strategy_runtime_configs"("license_id", "strategy_code", "status");

-- CreateIndex
CREATE INDEX "strategy_runtime_configs_robot_instance_id_idx" ON "strategy_runtime_configs"("robot_instance_id");

-- CreateIndex
CREATE UNIQUE INDEX "strategy_runtime_configs_license_id_strategy_code_version_key" ON "strategy_runtime_configs"("license_id", "strategy_code", "version");

-- CreateIndex
CREATE INDEX "strategy_runtime_config_history_license_id_strategy_code_crea_idx" ON "strategy_runtime_config_history"("license_id", "strategy_code", "created_at");

-- AddForeignKey
ALTER TABLE "strategy_runtime_configs" ADD CONSTRAINT "strategy_runtime_configs_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_runtime_configs" ADD CONSTRAINT "strategy_runtime_configs_robot_instance_id_fkey" FOREIGN KEY ("robot_instance_id") REFERENCES "robot_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_runtime_configs" ADD CONSTRAINT "strategy_runtime_configs_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_runtime_configs" ADD CONSTRAINT "strategy_runtime_configs_published_by_admin_id_fkey" FOREIGN KEY ("published_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_runtime_config_history" ADD CONSTRAINT "strategy_runtime_config_history_strategy_runtime_config_id_fkey" FOREIGN KEY ("strategy_runtime_config_id") REFERENCES "strategy_runtime_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_runtime_config_history" ADD CONSTRAINT "strategy_runtime_config_history_actor_admin_id_fkey" FOREIGN KEY ("actor_admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
