import { AuditActorType, type Prisma } from "@prisma/client";
import { createAuditLog } from "@/lib/audit/log";

export async function recordOperationalAudit(input: {
  action: string;
  entityType: string;
  entityId?: string | null;
  licenseId?: string;
  metadata?: Prisma.InputJsonValue;
  requestId?: string | null;
}) {
  return createAuditLog({
    actorType: AuditActorType.EA,
    actorId: null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    requestId: input.requestId ?? null,
    metadata: {
      ...(input.licenseId ? { licenseId: input.licenseId } : {}),
      ...(input.metadata && typeof input.metadata === "object"
        ? (input.metadata as Record<string, unknown>)
        : {}),
    },
  });
}
