import type { EaAuthContext } from "./auth";
import { getEaOnlineState } from "./auth";
import { getLicenseOperationalFlags } from "@/lib/licensing/service";

const MIN_EA_VERSION = process.env.MIN_EA_VERSION ?? "1.0.0";
const HEARTBEAT_INTERVAL_SEC = Number(
  process.env.EA_HEARTBEAT_INTERVAL_SEC ?? "30"
);

export async function buildEaConfigResponse(ctx: EaAuthContext) {
  const flags = await getLicenseOperationalFlags(ctx.license.id);
  const online = getEaOnlineState(ctx.device);

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
  };
}
