import { masterSignalInputSchema, type MasterSignalInput } from "@/lib/master-signals/schemas";
import type { MasterSignalNormalizedPayload } from "@/lib/master-signals/types";

const SENSITIVE_KEY_FRAGMENTS = [
  "secret",
  "token",
  "password",
  "authorization",
  "bearer",
  "database_url",
  "activation_code",
  "strategy",
  "internal_filter",
  "indicator",
];

function isSensitiveKey(key: string): boolean {
  const lowered = key.toLowerCase();
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) => lowered.includes(fragment));
}

function isSensitiveString(value: string): boolean {
  const lowered = value.toLowerCase();
  return (
    lowered.includes("bearer ") ||
    lowered.includes("master_ea_api_secret") ||
    lowered.includes("auth_secret") ||
    lowered.includes("database_url") ||
    lowered.includes("postgres://")
  );
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    for (const [key, nested] of Object.entries(input)) {
      if (isSensitiveKey(key)) continue;
      output[key] = redactValue(nested);
    }
    return output;
  }

  if (typeof value === "string" && isSensitiveString(value)) {
    return "[REDACTED]";
  }

  return value;
}

export function redactMasterSignalPayload(input: unknown): Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  return redactValue(input) as Record<string, unknown>;
}

function normalizeProfileSlug(profile?: string): string | null {
  if (!profile) return null;
  return profile.trim().toLowerCase();
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function computeExpiresAt(expiresInSeconds?: number): string | null {
  if (expiresInSeconds == null) return null;
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

export function validateMasterSignalPayload(input: unknown): MasterSignalNormalizedPayload {
  const parsed: MasterSignalInput = masterSignalInputSchema.parse(input);

  return {
    masterSignalId: parsed.master_signal_id,
    source: parsed.source,
    symbol: normalizeSymbol(parsed.symbol),
    side: parsed.side,
    orderType: parsed.order_type,
    purpose: parsed.purpose,
    profileSlug: normalizeProfileSlug(parsed.profile),
    expiresInSeconds: parsed.expires_in_seconds ?? null,
    expiresAt: computeExpiresAt(parsed.expires_in_seconds),
    idempotencyKey: parsed.idempotency_key,
    rawPayloadRedacted: redactMasterSignalPayload(input),
  };
}
