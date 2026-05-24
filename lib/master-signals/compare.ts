import type { MasterSignal } from "@prisma/client";
import type { MasterSignalNormalizedPayload } from "@/lib/master-signals/types";

/** Comparação mínima segura para idempotência (Fase 2.5). */
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
    | "expiresAt"
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

  if (existing.expiresAt == null && normalized.expiresAt == null) return true;
  if (existing.expiresAt == null || normalized.expiresAt == null) return false;
  const existingSec = Math.floor(existing.expiresAt.getTime() / 1000);
  const normalizedSec = Math.floor(new Date(normalized.expiresAt).getTime() / 1000);
  return existingSec === normalizedSec;
}
