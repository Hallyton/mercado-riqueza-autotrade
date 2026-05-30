import {
  DeviceStatus,
  LicenseStatus,
  RealTradingApprovalStatus,
  RobotInstanceStatus,
  SubscriptionStatus,
  type RobotInstance,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { eaOnlineThresholdMs } from "@/lib/risk/real-trading-config";
import { allocateMagicNumber, MagicNumberError } from "./magic-number";
import {
  AUTOTRADE_ROBOT_PRODUCT_SLUG,
  MAX_ROBOTS_CURRENT_PHASE,
} from "./constants";
import { createAuditLog } from "@/lib/audit/log";
import { AuditActorType } from "@prisma/client";

export { MagicNumberError };

export async function countActiveRobotInstancesForUser(
  userId: string
): Promise<number> {
  return prisma.robotInstance.count({
    where: {
      userId,
      status: {
        notIn: [RobotInstanceStatus.BLOCKED],
      },
    },
  });
}

export async function createRobotInstanceForSubscription(
  subscriptionId: string,
  actorId?: string | null
) {
  const subscription = await prisma.subscription.findUniqueOrThrow({
    where: { id: subscriptionId },
    include: { plan: true, robotInstances: true },
  });

  const activeCount = subscription.robotInstances.filter(
    (r) => r.status !== RobotInstanceStatus.BLOCKED
  ).length;

  const maxRobots = Math.min(
    subscription.plan.maxRobots,
    MAX_ROBOTS_CURRENT_PHASE
  );

  if (activeCount >= maxRobots) {
    return subscription.robotInstances[0] ?? null;
  }

  const product = await prisma.robotProduct.findUnique({
    where: { slug: AUTOTRADE_ROBOT_PRODUCT_SLUG },
  });

  if (!product) {
    throw new Error("Produto robô comercial não configurado.");
  }

  const magicNumber = await allocateMagicNumber();

  const instance = await prisma.robotInstance.create({
    data: {
      userId: subscription.userId,
      subscriptionId: subscription.id,
      robotProductId: product.id,
      magicNumber,
      status: RobotInstanceStatus.AWAITING_APPROVAL,
    },
  });

  await createAuditLog({
    actorType: actorId ? AuditActorType.ADMIN : AuditActorType.SYSTEM,
    actorId: actorId ?? null,
    action: "robot_instance.created",
    entityType: "robot_instance",
    entityId: instance.id,
    metadata: {
      subscriptionId,
      magicNumber,
      productSlug: product.slug,
    },
  });

  return instance;
}

export async function linkRobotInstanceToLicense(
  robotInstanceId: string,
  licenseId: string,
  actorId?: string | null
) {
  const [instance, license] = await Promise.all([
    prisma.robotInstance.findUniqueOrThrow({ where: { id: robotInstanceId } }),
    prisma.license.findUniqueOrThrow({ where: { id: licenseId } }),
  ]);

  if (instance.userId !== license.userId) {
    throw new Error("Robô e licença pertencem a usuários diferentes.");
  }

  if (!instance.magicNumber) {
    throw new Error("Robô sem magicNumber alocado.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const robot = await tx.robotInstance.update({
      where: { id: robotInstanceId },
      data: { licenseId },
    });

    await tx.license.update({
      where: { id: licenseId },
      data: { expectedMagicNumber: instance.magicNumber },
    });

    return robot;
  });

  await createAuditLog({
    actorType: actorId ? AuditActorType.ADMIN : AuditActorType.SYSTEM,
    actorId: actorId ?? null,
    action: "robot_instance.linked_license",
    entityType: "robot_instance",
    entityId: robotInstanceId,
    metadata: { licenseId, magicNumber: instance.magicNumber },
  });

  return updated;
}

export async function resolveRobotInstanceDisplayStatus(
  instance: Pick<
    RobotInstance,
    "status" | "licenseId" | "magicNumber" | "subscriptionId"
  >
): Promise<RobotInstanceStatus> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: instance.subscriptionId },
    select: { status: true, adminPaymentStatus: true },
  });

  if (
    subscription?.adminPaymentStatus === "PENDING" ||
    subscription?.status === SubscriptionStatus.INCOMPLETE
  ) {
    return RobotInstanceStatus.AWAITING_PAYMENT;
  }

  if (
    subscription?.adminPaymentStatus === "OVERDUE" ||
    subscription?.status === SubscriptionStatus.PAST_DUE
  ) {
    return RobotInstanceStatus.SUSPENDED;
  }

  if (
    subscription?.status === SubscriptionStatus.CANCELLED ||
    subscription?.status === SubscriptionStatus.PAUSED
  ) {
    return RobotInstanceStatus.SUSPENDED;
  }

  if (instance.status === RobotInstanceStatus.BLOCKED) {
    return RobotInstanceStatus.BLOCKED;
  }

  if (!instance.licenseId) {
    return RobotInstanceStatus.AWAITING_APPROVAL;
  }

  const license = await prisma.license.findUnique({
    where: { id: instance.licenseId },
    select: {
      status: true,
      expectedTradeMode: true,
    },
  });

  if (!license || license.status === LicenseStatus.PENDING_ACTIVATION) {
    return RobotInstanceStatus.AWAITING_EA_ACTIVATION;
  }

  if (license.status === LicenseStatus.SUSPENDED) {
    return RobotInstanceStatus.SUSPENDED;
  }

  if (license.status === LicenseStatus.REVOKED) {
    return RobotInstanceStatus.BLOCKED;
  }

  const threshold = new Date(Date.now() - eaOnlineThresholdMs());
  const activeDevice = await prisma.device.findFirst({
    where: {
      licenseId: instance.licenseId,
      status: DeviceStatus.ACTIVE,
      revokedAt: null,
      lastSeenAt: { gte: threshold },
    },
  });

  if (!activeDevice) {
    return RobotInstanceStatus.AWAITING_EA_ACTIVATION;
  }

  const realApproval = instance.magicNumber
    ? await prisma.realTradingApproval.findFirst({
        where: {
          licenseId: instance.licenseId,
          magicNumber: instance.magicNumber,
          status: RealTradingApprovalStatus.APPROVED,
          allowReal: true,
        },
      })
    : null;

  if (license.expectedTradeMode === "REAL" && !realApproval) {
    return RobotInstanceStatus.REAL_PENDING_VALIDATION;
  }

  if (realApproval) {
    return RobotInstanceStatus.OPERATIONAL_CONTROLLED;
  }

  return RobotInstanceStatus.EA_ONLINE;
}

export async function assignMagicNumberToRobotInstance(
  robotInstanceId: string,
  actorId: string,
  preferred?: number
) {
  const instance = await prisma.robotInstance.findUniqueOrThrow({
    where: { id: robotInstanceId },
  });

  if (instance.magicNumber) {
    throw new MagicNumberError(
      "Robô já possui magicNumber atribuído.",
      "MAGIC_NUMBER_ALREADY_SET"
    );
  }

  const magicNumber =
    preferred != null ? preferred : await allocateMagicNumber();

  if (preferred != null) {
    const { assertMagicNumberAvailable } = await import("./magic-number");
    await assertMagicNumberAvailable(preferred);
  }

  const updated = await prisma.robotInstance.update({
    where: { id: robotInstanceId },
    data: { magicNumber },
  });

  if (instance.licenseId) {
    await prisma.license.update({
      where: { id: instance.licenseId },
      data: { expectedMagicNumber: magicNumber },
    });
  }

  await createAuditLog({
    actorType: AuditActorType.ADMIN,
    actorId,
    action: "robot_instance.magic_number_assigned",
    entityType: "robot_instance",
    entityId: robotInstanceId,
    metadata: { magicNumber },
  });

  return updated;
}
