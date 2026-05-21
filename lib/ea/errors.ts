import { AuditActorType, type Prisma } from "@prisma/client";
import { createAuditLog } from "@/lib/audit/log";
import prisma from "@/lib/prisma";
import type { EaAuthContext } from "./auth";

export async function reportEaError(
  ctx: EaAuthContext,
  body: {
    error_code?: string;
    error_message: string;
    context?: Record<string, unknown>;
  }
) {
  const report = await prisma.eaErrorReport.create({
    data: {
      licenseId: ctx.license.id,
      deviceId: ctx.device.deviceId,
      errorCode: body.error_code,
      errorMessage: body.error_message,
      context: (body.context ?? undefined) as Prisma.InputJsonValue | undefined,
      requestId: ctx.requestId,
    },
  });

  await createAuditLog({
    actorType: AuditActorType.EA,
    actorId: ctx.license.userId,
    action: "ea.error_reported",
    entityType: "ea_error_report",
    entityId: report.id,
    requestId: ctx.requestId,
    metadata: {
      errorCode: body.error_code,
      message: body.error_message.slice(0, 200),
    },
  });

  return { id: report.id };
}
