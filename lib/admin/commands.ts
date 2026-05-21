import {
  AuditActorType,
  LicenseStatus,
  OrderLogStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { syncLicenseFlags, syncLicensesForSubscription } from "@/lib/licensing/service";
import prisma from "@/lib/prisma";
import { recordAdminAction } from "./record-action";

export async function pauseLicenseNewEntries(input: {
  licenseId: string;
  actorId: string;
  pause: boolean;
  ipAddress?: string | null;
  reason?: string;
}) {
  const license = await prisma.license.update({
    where: { id: input.licenseId },
    data: {
      adminHaltNewEntries: input.pause,
      haltNewEntries: input.pause,
    },
  });

  if (!input.pause) {
    await syncLicenseFlags(input.licenseId, {
      actorId: input.actorId,
      actorType: AuditActorType.ADMIN,
      reason: input.reason ?? "admin_resume_entries",
    });
  }

  await recordAdminAction({
    actorId: input.actorId,
    action: input.pause ? "admin.pause_new_entries" : "admin.resume_new_entries",
    targetType: "license",
    targetId: input.licenseId,
    ipAddress: input.ipAddress,
    metadata: { pause: input.pause, reason: input.reason },
  });

  return license;
}

export async function blockClient(input: {
  userId: string;
  actorId: string;
  ipAddress?: string | null;
  reason?: string;
}) {
  await prisma.license.updateMany({
    where: { userId: input.userId },
    data: {
      status: LicenseStatus.SUSPENDED,
      suspendedAt: new Date(),
      haltNewEntries: true,
    },
  });

  const sub = await prisma.subscription.findFirst({
    where: { userId: input.userId, status: SubscriptionStatus.ACTIVE },
  });
  if (sub) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: SubscriptionStatus.PAST_DUE },
    });
    await syncLicensesForSubscription(sub.id, { reason: "admin_block_client" });
  }

  await recordAdminAction({
    actorId: input.actorId,
    action: "admin.block_client",
    targetType: "user",
    targetId: input.userId,
    ipAddress: input.ipAddress,
    metadata: { reason: input.reason },
  });
}

export async function emergencyCancelPendingOrders(input: {
  licenseId?: string;
  actorId: string;
  ipAddress?: string | null;
  reason?: string;
}) {
  const where = {
    currentStatus: { in: [OrderLogStatus.RECEIVED, OrderLogStatus.SENT] as OrderLogStatus[] },
    ...(input.licenseId ? { licenseId: input.licenseId } : {}),
  };

  const pending = await prisma.instruction.findMany({ where, take: 200 });

  for (const instr of pending) {
    await prisma.$transaction([
      prisma.instruction.update({
        where: { id: instr.id },
        data: { currentStatus: OrderLogStatus.CANCELLED },
      }),
      prisma.instructionStatusLog.create({
        data: {
          instructionId: instr.id,
          status: OrderLogStatus.CANCELLED,
          message: input.reason ?? "Cancelamento de emergência (admin)",
          metadata: { actorId: input.actorId },
        },
      }),
    ]);
  }

  await recordAdminAction({
    actorId: input.actorId,
    action: "admin.emergency_cancel_orders",
    targetType: input.licenseId ? "license" : "global",
    targetId: input.licenseId ?? null,
    ipAddress: input.ipAddress,
    metadata: {
      reason: input.reason,
      cancelledCount: pending.length,
    },
  });

  return { cancelledCount: pending.length };
}
