const ENABLED_VALUES = new Set(["true", "1"]);

type EnvSource = Record<string, string | undefined>;

/** IDs em REAL_TRADING_ALLOWED_LICENSE_IDS (vazio = allowlist env desligada). */
export function parseEnvLicenseAllowlist(
  env: EnvSource = process.env
): string[] {
  const raw = env.REAL_TRADING_ALLOWED_LICENSE_IDS?.trim();
  if (!raw) return [];
  return raw.split(/[,\s;]+/).map((value) => value.trim()).filter(Boolean);
}

export function isEnvLicenseAllowlistConfigured(
  env: EnvSource = process.env
): boolean {
  return parseEnvLicenseAllowlist(env).length > 0;
}

export function isLicenseInEnvAllowlist(
  licenseId: string,
  env: EnvSource = process.env
): boolean {
  return parseEnvLicenseAllowlist(env).includes(licenseId);
}

export function isAutoDispatchEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const raw = env.ENABLE_AUTO_DISPATCH?.trim().toLowerCase();
  return raw ? ENABLED_VALUES.has(raw) : false;
}

export function eaOnlineThresholdMs(
  env: Record<string, string | undefined> = process.env
): number {
  const raw = env.EA_ONLINE_THRESHOLD_SEC?.trim();
  const sec = raw ? Number.parseInt(raw, 10) : 300;
  return Number.isFinite(sec) && sec > 0 ? sec * 1000 : 300_000;
}

export function protectionPendingWindowMs(
  env: Record<string, string | undefined> = process.env
): number {
  const raw = env.REAL_PROTECTION_PENDING_WINDOW_SEC?.trim();
  const sec = raw ? Number.parseInt(raw, 10) : 600;
  return Number.isFinite(sec) && sec > 0 ? sec * 1000 : 600_000;
}

export function magicNumberRange(env: Record<string, string | undefined> = process.env): {
  min: number;
  max: number;
} {
  const min = Number.parseInt(env.REAL_MAGIC_NUMBER_MIN ?? "910001", 10);
  const max = Number.parseInt(env.REAL_MAGIC_NUMBER_MAX ?? "910999", 10);
  return {
    min: Number.isFinite(min) ? min : 910001,
    max: Number.isFinite(max) ? max : 910999,
  };
}
