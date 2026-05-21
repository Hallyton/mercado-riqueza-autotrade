import {
  AuditActorType,
  type Prisma,
} from "@prisma/client";
import prisma from "@/lib/prisma";

export type AuditLogInput = {
  actorType: AuditActorType;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  requestId?: string | null;
};

export async function createAuditLog(input: AuditLogInput) {
  return prisma.auditLog.create({
    data: {
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? undefined,
      ipAddress: input.ipAddress ?? null,
      requestId: input.requestId ?? null,
    },
  });
}
