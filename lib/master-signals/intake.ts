import { MasterSignalStatus, type MasterSignal, type Prisma } from "@prisma/client";
import { masterSignalPayloadMatches } from "@/lib/master-signals/compare";
import type { MasterSignalNormalizedPayload } from "@/lib/master-signals/types";
import prisma from "@/lib/prisma";

export type MasterSignalIntakeResult =
  | {
      ok: true;
      created: boolean;
      masterSignalId: string;
      status: MasterSignalStatus;
    }
  | { ok: false; code: "MASTER_SIGNAL_CONFLICT"; status: 409 };

function toCreateData(
  normalized: MasterSignalNormalizedPayload
): Prisma.MasterSignalCreateInput {
  const now = new Date();
  return {
    masterSignalId: normalized.masterSignalId,
    source: normalized.source,
    symbol: normalized.symbol,
    side: normalized.side,
    orderType: normalized.orderType,
    purpose: normalized.purpose,
    profileSlug: normalized.profileSlug,
    status: MasterSignalStatus.VALIDATED,
    idempotencyKey: normalized.idempotencyKey,
    expiresAt: normalized.expiresAt ? new Date(normalized.expiresAt) : null,
    receivedAt: now,
    validatedAt: now,
    rawPayloadRedacted: normalized.rawPayloadRedacted as Prisma.InputJsonValue,
  };
}

function conflict(): MasterSignalIntakeResult {
  return { ok: false, code: "MASTER_SIGNAL_CONFLICT", status: 409 };
}

function success(
  row: Pick<MasterSignal, "masterSignalId" | "status">,
  created: boolean
): MasterSignalIntakeResult {
  return {
    ok: true,
    created,
    masterSignalId: row.masterSignalId,
    status: row.status,
  };
}

async function findExisting(normalized: MasterSignalNormalizedPayload) {
  const [byBusinessId, byIdempotencyKey] = await Promise.all([
    prisma.masterSignal.findUnique({
      where: { masterSignalId: normalized.masterSignalId },
    }),
    prisma.masterSignal.findUnique({
      where: { idempotencyKey: normalized.idempotencyKey },
    }),
  ]);
  return { byBusinessId, byIdempotencyKey };
}

function reconcileExisting(
  byBusinessId: MasterSignal | null,
  byIdempotencyKey: MasterSignal | null,
  normalized: MasterSignalNormalizedPayload
): MasterSignalIntakeResult | null {
  if (byBusinessId && byIdempotencyKey && byBusinessId.id !== byIdempotencyKey.id) {
    return conflict();
  }

  const existing = byBusinessId ?? byIdempotencyKey;
  if (!existing) return null;

  if (existing.masterSignalId !== normalized.masterSignalId) {
    return conflict();
  }
  if (existing.idempotencyKey !== normalized.idempotencyKey) {
    return conflict();
  }
  if (!masterSignalPayloadMatches(existing, normalized)) {
    return conflict();
  }

  return success(existing, false);
}

export async function intakeMasterSignal(
  normalized: MasterSignalNormalizedPayload
): Promise<MasterSignalIntakeResult> {
  const { byBusinessId, byIdempotencyKey } = await findExisting(normalized);
  const existingResult = reconcileExisting(byBusinessId, byIdempotencyKey, normalized);
  if (existingResult) return existingResult;

  try {
    const created = await prisma.masterSignal.create({
      data: toCreateData(normalized),
    });
    return success(created, true);
  } catch (e) {
    const prismaCode =
      e && typeof e === "object" && "code" in e
        ? (e as { code: string }).code
        : undefined;
    if (prismaCode === "P2002") {
      const retry = await findExisting(normalized);
      const reconciled = reconcileExisting(
        retry.byBusinessId,
        retry.byIdempotencyKey,
        normalized
      );
      if (reconciled) return reconciled;
      return conflict();
    }
    throw e;
  }
}
