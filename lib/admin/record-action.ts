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

const SENSITIVE_METADATA_KEY_FRAGMENTS = [
  "secret",
  "token",
  "password",
  "authorization",
  "bearer",
  "database_url",
  "activation_code",
];

function redactAdminMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactAdminMetadata);
  }

  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      const lowered = key.toLowerCase();
      if (
        SENSITIVE_METADATA_KEY_FRAGMENTS.some((fragment) =>
          lowered.includes(fragment)
        )
      ) {
        out[key] = "[REDACTED]";
      } else {
        out[key] = redactAdminMetadata(nested);
      }
    }
    return out;
  }

  if (typeof value === "string") {
    const lowered = value.toLowerCase();
    if (
      lowered.includes("bearer ") ||
      lowered.includes("master_ea_api_secret") ||
      lowered.includes("auth_secret") ||
      lowered.includes("database_url") ||
      lowered.includes("postgres://")
    ) {
      return "[REDACTED]";
    }
  }

  return value;
}

/**
 * Persiste em admin_actions e espelha em audit_logs (requisito de compliance).
 */
export async function recordAdminAction(input: RecordAdminActionInput) {
  const metadata =
    input.metadata === undefined
      ? undefined
      : (redactAdminMetadata(input.metadata) as Prisma.InputJsonValue);

  const adminAction = await prisma.adminAction.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      metadata,
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
      ...(typeof metadata === "object" && metadata !== null
        ? (metadata as Record<string, unknown>)
        : {}),
    },
    ipAddress: input.ipAddress,
  });

  return adminAction;
}
