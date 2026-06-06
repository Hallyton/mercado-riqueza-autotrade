import type { EaAuthContext } from "./auth";
import { getEaOnlineState } from "./auth";
import { isAutonomousStrategyServerEnabled } from "@/lib/ea/autonomous-strategy-preflight";
import { getPublishedStrategyConfigForEa } from "@/lib/admin/strategy-runtime-config";
import { buildOperationControlConfig } from "@/lib/operations/license-operation-control-service";
import { getLicenseOperationalFlags } from "@/lib/licensing/service";
import { MR_FIBO_D1_GUARD_CODE } from "@/lib/risk/autonomous-strategy-reasons";
import prisma from "@/lib/prisma";

const MIN_EA_VERSION = process.env.MIN_EA_VERSION ?? "1.0.0";
const HEARTBEAT_INTERVAL_SEC = Number(
  process.env.EA_HEARTBEAT_INTERVAL_SEC ?? "30"
);

async function resolveAutonomousStrategyForLicense(licenseId: string) {
  const instance = await prisma.robotInstance.findFirst({
    where: {
      licenseId,
      autonomousStrategyEnabled: true,
      autonomousStrategyCode: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: {
      autonomousStrategyCode: true,
      robotProduct: { select: { strategyCode: true } },
    },
  });
  const code =
    instance?.autonomousStrategyCode ??
    instance?.robotProduct?.strategyCode ??
    null;
  return code;
}

export async function buildEaConfigResponse(ctx: EaAuthContext) {
  const flags = await getLicenseOperationalFlags(ctx.license.id);
  const online = getEaOnlineState(ctx.device);
  const strategyCode = await resolveAutonomousStrategyForLicense(ctx.license.id);
  const serverAutonomous = isAutonomousStrategyServerEnabled();
  const licenseAutonomous = Boolean(strategyCode);
  const autonomousEnabled =
    serverAutonomous && licenseAutonomous && strategyCode === MR_FIBO_D1_GUARD_CODE;

  const publishedStrategy =
    autonomousEnabled
      ? await getPublishedStrategyConfigForEa(ctx.license.id)
      : null;

  const operationControl = autonomousEnabled
    ? await buildOperationControlConfig(ctx.license.id, strategyCode)
    : { paused: false, reason: null, strategy_code: strategyCode };

  return {
    min_ea_version: MIN_EA_VERSION,
    heartbeat_interval_sec: HEARTBEAT_INTERVAL_SEC,
    license_id: ctx.license.id,
    license_status: ctx.license.status,
    halt_new_entries: flags.haltNewEntries,
    halt_all_trading: flags.haltAllTrading,
    can_accept_new_entries: flags.canAcceptNewEntries,
    can_manage_open_positions: flags.canManageOpenPositions,
    exposure_profile: ctx.license.exposureProfile
      ? { slug: ctx.license.exposureProfile.slug, name: ctx.license.exposureProfile.name }
      : null,
    mt5_account: ctx.license.mt5Account
      ? {
          login: ctx.license.mt5Account.login,
          server: ctx.license.mt5Account.server,
        }
      : null,
    ea_online: online.online,
    last_seen_at: online.lastSeenAt,
    autonomous_strategy_enabled: autonomousEnabled,
    autonomous_strategy_code: autonomousEnabled ? strategyCode : null,
    autonomous_strategy_capabilities: autonomousEnabled
      ? [MR_FIBO_D1_GUARD_CODE]
      : [],
    strategy_config_version: publishedStrategy?.version ?? null,
    strategy_config_hash: publishedStrategy?.configHash ?? null,
    strategy_config: publishedStrategy?.strategyConfig ?? null,
    operation_control: operationControl,
  };
}
