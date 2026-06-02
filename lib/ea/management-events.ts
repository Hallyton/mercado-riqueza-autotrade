import { AuditActorType } from "@prisma/client";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit/log";
import { MANAGEMENT_EVENT_CODES } from "@/lib/admin/real-manual-management-plan";
import prisma from "@/lib/prisma";
import { redactSensitiveMessage } from "@/lib/risk/redact-message";
import type { EaAuthContext } from "@/lib/ea/auth";

const managementEventSchema = z.object({
  instruction_id: z.string().min(1),
  event: z.enum(MANAGEMENT_EVENT_CODES),
  detail: z.string().max(500).optional(),
});

export async function reportManagementEvent(
  ctx: EaAuthContext,
  body: z.infer<typeof managementEventSchema>
) {
  const instruction = await prisma.instruction.findFirst({
    where: { id: body.instruction_id, licenseId: ctx.license.id },
  });
  if (!instruction) {
    return { ok: false as const, code: "INSTRUCTION_NOT_FOUND" };
  }

  const detail = body.detail ? redactSensitiveMessage(body.detail) : null;

  await prisma.instructionStatusLog.create({
    data: {
      instructionId: instruction.id,
      status: instruction.currentStatus,
      message: `Evento de gestão: ${body.event}`,
      metadata: {
        event: body.event,
        managementEvent: body.event,
        detail,
      },
    },
  });

  await createAuditLog({
    actorType: AuditActorType.EA,
    actorId: ctx.license.userId,
    action: "ea.management_event",
    entityType: "instruction",
    entityId: instruction.id,
    requestId: ctx.requestId,
    metadata: { event: body.event, detail },
  });

  return { ok: true as const };
}

export { managementEventSchema };
