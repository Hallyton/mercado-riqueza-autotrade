import { AuditActorType, type Prisma } from "@prisma/client";
import { createAuditLog } from "@/lib/audit/log";
import prisma from "@/lib/prisma";

export type RecordAdminActionInput = {
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  auditEntityType?: string;
};

/**
 * Persiste em admin_actions e espelha em audit_logs (requisito de compliance).
 */
export async function recordAdminAction(input: RecordAdminActionInput) {
  const adminAction = await prisma.adminAction.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? undefined,
      ipAddress: input.ipAddress ?? null,
    },
  });

  await createAuditLog({
    actorType: AuditActorType.ADMIN,
    actorId: input.actorId,
    action: input.action,
    entityType: input.auditEntityType ?? input.targetType,
    entityId: input.targetId ?? adminAction.id,
    metadata: {
      adminActionId: adminAction.id,
      ...(typeof input.metadata === "object" && input.metadata !== null
        ? (input.metadata as Record<string, unknown>)
        : {}),
    },
    ipAddress: input.ipAddress,
  });

  return adminAction;
}
