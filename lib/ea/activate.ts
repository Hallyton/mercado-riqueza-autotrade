import {
  AuditActorType,
  LicenseStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { createAuditLog } from "@/lib/audit/log";
import { syncLicenseFlags } from "@/lib/licensing/service";
import prisma from "@/lib/prisma";
import {
  generateActivationCodePlain,
  generateOpaqueToken,
  hashToken,
} from "./token";

export async function createActivationCodeForLicense(licenseId: string) {
  const plain = generateActivationCodePlain();
  const codeHash = hashToken(plain);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.activationCode.create({
    data: {
      licenseId,
      codeHash,
      expiresAt,
    },
  });

  return { code: plain, expiresAt };
}

export async function activateEaDevice(input: {
  activationCode: string;
  deviceId: string;
  fingerprint?: string;
  eaVersion?: string;
  requestId?: string | null;
  ipAddress?: string | null;
}) {
  const codeHash = hashToken(input.activationCode.trim().toUpperCase());

  const activation = await prisma.activationCode.findFirst({
    where: {
      codeHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      license: {
        include: {
          subscription: { include: { plan: true } },
          mt5Account: true,
        },
      },
    },
  });

  if (!activation?.license) {
    return { ok: false as const, code: "INVALID_ACTIVATION_CODE" };
  }

  const license = activation.license;

  if (!license.mt5Account) {
    return { ok: false as const, code: "MT5_NOT_LINKED" };
  }

  const sub = license.subscription;
  if (!sub || sub.status !== SubscriptionStatus.ACTIVE) {
    return { ok: false as const, code: "SUBSCRIPTION_INACTIVE" };
  }
  if (sub.currentPeriodEnd && sub.currentPeriodEnd < new Date()) {
    return { ok: false as const, code: "SUBSCRIPTION_EXPIRED" };
  }

  if (license.status === LicenseStatus.REVOKED) {
    return { ok: false as const, code: "LICENSE_REVOKED" };
  }
  if (license.status === LicenseStatus.SUSPENDED) {
    return { ok: false as const, code: "LICENSE_SUSPENDED" };
  }

  const maxDevices = sub.plan.maxDevices;

  const existingDevice = await prisma.device.findUnique({
    where: {
      licenseId_deviceId: {
        licenseId: license.id,
        deviceId: input.deviceId,
      },
    },
  });

  if (!existingDevice) {
    const activeDeviceCount = await prisma.device.count({
      where: { licenseId: license.id, revokedAt: null },
    });
    if (activeDeviceCount >= maxDevices) {
      await createAuditLog({
        actorType: AuditActorType.EA,
        actorId: license.userId,
        action: "ea.activation_rejected",
        entityType: "license",
        entityId: license.id,
        requestId: input.requestId,
        ipAddress: input.ipAddress,
        metadata: {
          code: "DEVICE_LIMIT_EXCEEDED",
          deviceId: input.deviceId,
          maxDevices,
        },
      });
      return { ok: false as const, code: "DEVICE_LIMIT_EXCEEDED" };
    }
  }

  const deviceToken = generateOpaqueToken();
  const tokenHash = hashToken(deviceToken);

  const device = await prisma.$transaction(async (tx) => {
    await tx.activationCode.update({
      where: { id: activation.id },
      data: { usedAt: new Date() },
    });

    if (existingDevice?.revokedAt) {
      return tx.device.update({
        where: { id: existingDevice.id },
        data: {
          tokenHash,
          fingerprint: input.fingerprint,
          eaVersion: input.eaVersion,
          lastSeenAt: new Date(),
          revokedAt: null,
        },
      });
    }

    if (existingDevice) {
      return tx.device.update({
        where: { id: existingDevice.id },
        data: {
          tokenHash,
          fingerprint: input.fingerprint,
          eaVersion: input.eaVersion,
          lastSeenAt: new Date(),
        },
      });
    }

    return tx.device.create({
      data: {
        licenseId: license.id,
        deviceId: input.deviceId,
        fingerprint: input.fingerprint,
        eaVersion: input.eaVersion,
        tokenHash,
        lastSeenAt: new Date(),
      },
    });
  });

  let licenseStatus = license.status;
  if (license.status === LicenseStatus.PENDING_ACTIVATION) {
    await prisma.license.update({
      where: { id: license.id },
      data: {
        status: LicenseStatus.ACTIVE,
        activatedAt: new Date(),
      },
    });
    licenseStatus = LicenseStatus.ACTIVE;
  }

  await syncLicenseFlags(license.id, { reason: "ea_activated" });

  await createAuditLog({
    actorType: AuditActorType.EA,
    actorId: license.userId,
    action: "ea.device_activated",
    entityType: "license",
    entityId: license.id,
    requestId: input.requestId,
    ipAddress: input.ipAddress,
    metadata: {
      deviceId: input.deviceId,
      deviceRecordId: device.id,
    },
  });

  return {
    ok: true as const,
    device_token: deviceToken,
    license_id: license.id,
    device_id: input.deviceId,
    license_status: licenseStatus,
  };
}
