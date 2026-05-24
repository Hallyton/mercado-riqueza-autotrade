import type { MasterSignal } from "@prisma/client";
import type { MasterSignalNormalizedPayload } from "@/lib/master-signals/types";

function readStoredExpiresInSeconds(
  rawPayloadRedacted: MasterSignal["rawPayloadRedacted"]
): number | null {
  if (
    rawPayloadRedacted == null ||
    typeof rawPayloadRedacted !== "object" ||
    Array.isArray(rawPayloadRedacted)
  ) {
    return null;
  }
  const value = (rawPayloadRedacted as Record<string, unknown>).expires_in_seconds;
  if (value === undefined || value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

/** Comparação mínima segura para idempotência (Fase 2.5) — sem expiresAt derivado. */
export function masterSignalPayloadMatches(
  existing: Pick<
    MasterSignal,
    | "masterSignalId"
    | "idempotencyKey"
    | "source"
    | "symbol"
    | "side"
    | "orderType"
    | "purpose"
    | "profileSlug"
    | "rawPayloadRedacted"
  >,
  normalized: MasterSignalNormalizedPayload
): boolean {
  if (existing.masterSignalId !== normalized.masterSignalId) return false;
  if (existing.idempotencyKey !== normalized.idempotencyKey) return false;
  if (existing.source !== normalized.source) return false;
  if (existing.symbol !== normalized.symbol) return false;
  if (existing.side !== normalized.side) return false;
  if (existing.orderType !== normalized.orderType) return false;
  if (existing.purpose !== normalized.purpose) return false;
  if ((existing.profileSlug ?? null) !== normalized.profileSlug) return false;

  const storedExpires = readStoredExpiresInSeconds(existing.rawPayloadRedacted);
  return storedExpires === normalized.expiresInSeconds;
}
