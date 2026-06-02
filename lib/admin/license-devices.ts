import {
  DeviceStatus,
  LicenseStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { z } from "zod";
import { recordAdminAction } from "@/lib/admin/record-action";
import { createActivationCodeForLicense } from "@/lib/ea/activate";
import { ACTIVE_DEVICE_WHERE } from "@/lib/licensing/device-lifecycle";
import prisma from "@/lib/prisma";
import {
  computeDeviceCompatibility,
  computeLicenseOperationalStatus,
  parseDeviceIdAccount,
  resolveExpectedAccount,
} from "@/lib/licensing/license-expected-mode";
import { getLicenseMt5BindingAudit } from "@/lib/admin/license-mt5-account";
import { maskLicenseId } from "@/lib/risk/real-trading-guard-status";

export const DEVICE_REVOKE_CONFIRM_PHRASE = "REVOGAR DEVICE";
export const DEVICE_BLOCK_CONFIRM_PHRASE = "BLOQUEAR DEVICE";
export const ADMIN_ACTIVATION_CODE_CONFIRM_PHRASE = "GERAR CODIGO DE ATIVACAO";

export const deviceActionConfirmationSchema = z.object({
  admin_confirmation: z.string().min(1),
});

export class LicenseDeviceAdminError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "LicenseDeviceAdminError";
  }
}

function assertLicenseEligibleForActivation(license: {
  status: LicenseStatus;
  subscription: { status: SubscriptionStatus; currentPeriodEnd: Date | null } | null;
}) {
  if (license.status === LicenseStatus.REVOKED) {
    throw new LicenseDeviceAdminError("Licença revogada.", "LICENSE_REVOKED", 403);
  }
  if (license.status === LicenseStatus.SUSPENDED) {
    throw new LicenseDeviceAdminError("Licença suspensa.", "LICENSE_SUSPENDED", 403);
  }
  const sub = license.subscription;
  if (!sub || sub.status !== SubscriptionStatus.ACTIVE) {
    throw new LicenseDeviceAdminError(
      "Assinatura inativa.",
      "SUBSCRIPTION_INACTIVE",
      403
    );
  }
  if (sub.currentPeriodEnd && sub.currentPeriodEnd < new Date()) {
    throw new LicenseDeviceAdminError(
      "Assinatura vencida.",
      "SUBSCRIPTION_EXPIRED",
      403
    );
  }
}

export async function getLicenseAdminDetail(licenseId: string) {
  const license = await prisma.license.findUnique({
    where: { id: licenseId },
    include: {
      user: { select: { id: true, email: true, name: true } },
      subscription: { include: { plan: true } },
      mt5Account: true,
      devices: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!license) return null;

  const latestHeartbeat = await prisma.eaHeartbeat.findFirst({
    where: { licenseId },
    orderBy: { receivedAt: "desc" },
  });

  const heartbeatByDevice = new Map<string, typeof latestHeartbeat>();
  const heartbeats = await prisma.eaHeartbeat.findMany({
    where: { licenseId },
    orderBy: { receivedAt: "desc" },
    take: 100,
  });
  for (const hb of heartbeats) {
    if (!heartbeatByDevice.has(hb.deviceId)) {
      heartbeatByDevice.set(hb.deviceId, hb);
    }
  }

  const activeDeviceCount = await prisma.device.count({
    where: { licenseId, ...ACTIVE_DEVICE_WHERE },
  });

  const expectedAccount = resolveExpectedAccount(license);

  const devices = license.devices.map((device) => {
    const hb = heartbeatByDevice.get(device.deviceId);
    const parsed = parseDeviceIdAccount(device.deviceId);
    const accountLogin = license.mt5Account?.login ?? parsed.login;
    const accountServer = license.mt5Account?.server ?? parsed.server;
    const reportedTradeMode = hb?.tradeMode ?? null;
    const compatibility = computeDeviceCompatibility({
      deviceStatus: device.status,
      reportedTradeMode,
      accountLogin,
      accountServer,
      hasHeartbeat: Boolean(hb),
      expectedTradeMode: license.expectedTradeMode,
      expectedAccountLogin: license.expectedAccountLogin,
      expectedAccountServer: license.expectedAccountServer,
    });

    return {
      id: device.id,
      deviceId: device.deviceId,
      status: device.status,
      eaVersion: device.eaVersion,
      lastSeenAt: device.lastSeenAt,
      createdAt: device.createdAt,
      revokedAt: device.revokedAt,
      blockedAt: device.blockedAt,
      lastHeartbeatAt: hb?.receivedAt ?? null,
      reportedTradeMode,
      accountLogin,
      accountServer,
      compatibility,
    };
  });

  const mt5BindingAudit = await getLicenseMt5BindingAudit(licenseId);

  const operationalStatus = computeLicenseOperationalStatus({
    license,
    activeDevices: devices
      .filter((d) => d.status === DeviceStatus.ACTIVE)
      .map((d) => ({
        status: DeviceStatus.ACTIVE,
        tradeMode: d.reportedTradeMode,
        accountLogin: d.accountLogin,
        accountServer: d.accountServer,
      })),
    latestHeartbeat: latestHeartbeat
      ? {
          tradeMode: latestHeartbeat.tradeMode,
          deviceId: latestHeartbeat.deviceId,
          receivedAt: latestHeartbeat.receivedAt,
        }
      : null,
  });

  return {
    licenseId: license.id,
    licenseIdMasked: maskLicenseId(license.id),
    status: license.status,
    subscription: license.subscription,
    haltNewEntries: license.haltNewEntries,
    haltAllTrading: license.haltAllTrading,
    user: license.user,
    plan: license.subscription?.plan ?? null,
    maxDevices: license.subscription?.plan.maxDevices ?? 0,
    activeDeviceCount,
    mt5Account: license.mt5Account,
    mt5Linked: Boolean(license.mt5Account),
    mt5BindingAudit: mt5BindingAudit
      ? {
          changedAt: mt5BindingAudit.changedAt,
          changedBy: mt5BindingAudit.changedBy,
        }
      : null,
    expectedTradeMode: license.expectedTradeMode,
    expectedAccountLogin: license.expectedAccountLogin,
    expectedAccountServer: license.expectedAccountServer,
    expectedSymbol: license.expectedSymbol,
    expectedMagicNumber: license.expectedMagicNumber,
    expectedAccount,
    operationalStatus,
    devices,
    latestHeartbeat: latestHeartbeat
      ? {
          receivedAt: latestHeartbeat.receivedAt,
          tradeMode: latestHeartbeat.tradeMode,
          deviceId: latestHeartbeat.deviceId,
          eaStatus: latestHeartbeat.eaStatus,
        }
      : null,
  };
}

async function getDeviceForLicense(licenseId: string, deviceRecordId: string) {
  const device = await prisma.device.findFirst({
    where: { id: deviceRecordId, licenseId },
  });
  if (!device) {
    throw new LicenseDeviceAdminError(
      "Device não encontrado para esta licença.",
      "DEVICE_NOT_FOUND",
      404
    );
  }
  return device;
}

export async function revokeLicenseDevice(input: {
  licenseId: string;
  deviceRecordId: string;
  actorId: string;
  adminConfirmation: string;
  ipAddress?: string | null;
}) {
  if (input.adminConfirmation.trim() !== DEVICE_REVOKE_CONFIRM_PHRASE) {
    throw new LicenseDeviceAdminError(
      `Confirmação inválida. Digite: ${DEVICE_REVOKE_CONFIRM_PHRASE}`,
      "CONFIRMATION_MISMATCH",
      400
    );
  }

  const device = await getDeviceForLicense(input.licenseId, input.deviceRecordId);
  if (device.status === DeviceStatus.REVOKED && device.revokedAt) {
    return device;
  }

  const now = new Date();
  const updated = await prisma.device.update({
    where: { id: device.id },
    data: {
      status: DeviceStatus.REVOKED,
      revokedAt: now,
      revokedByUserId: input.actorId,
    },
  });

  await recordAdminAction({
    actorId: input.actorId,
    action: "license.device_revoked",
    targetType: "device",
    targetId: device.id,
    ipAddress: input.ipAddress,
    metadata: {
      licenseIdMasked: maskLicenseId(input.licenseId),
      deviceId: device.deviceId,
    },
  });

  return updated;
}

export async function blockLicenseDevice(input: {
  licenseId: string;
  deviceRecordId: string;
  actorId: string;
  adminConfirmation: string;
  ipAddress?: string | null;
}) {
  if (input.adminConfirmation.trim() !== DEVICE_BLOCK_CONFIRM_PHRASE) {
    throw new LicenseDeviceAdminError(
      `Confirmação inválida. Digite: ${DEVICE_BLOCK_CONFIRM_PHRASE}`,
      "CONFIRMATION_MISMATCH",
      400
    );
  }

  const device = await getDeviceForLicense(input.licenseId, input.deviceRecordId);
  if (device.status === DeviceStatus.BLOCKED && device.blockedAt) {
    return device;
  }

  const now = new Date();
  const updated = await prisma.device.update({
    where: { id: device.id },
    data: {
      status: DeviceStatus.BLOCKED,
      blockedAt: now,
      blockedByUserId: input.actorId,
      revokedAt: device.revokedAt ?? now,
      revokedByUserId: device.revokedByUserId ?? input.actorId,
    },
  });

  await recordAdminAction({
    actorId: input.actorId,
    action: "license.device_blocked",
    targetType: "device",
    targetId: device.id,
    ipAddress: input.ipAddress,
    metadata: {
      licenseIdMasked: maskLicenseId(input.licenseId),
      deviceId: device.deviceId,
    },
  });

  return updated;
}

export async function issueActivationCodeForAdmin(input: {
  licenseId: string;
  actorId: string;
  adminConfirmation: string;
  ipAddress?: string | null;
}) {
  if (input.adminConfirmation.trim() !== ADMIN_ACTIVATION_CODE_CONFIRM_PHRASE) {
    throw new LicenseDeviceAdminError(
      `Confirmação inválida. Digite: ${ADMIN_ACTIVATION_CODE_CONFIRM_PHRASE}`,
      "CONFIRMATION_MISMATCH",
      400
    );
  }

  const license = await prisma.license.findUnique({
    where: { id: input.licenseId },
    include: {
      subscription: true,
      mt5Account: true,
    },
  });

  if (!license) {
    throw new LicenseDeviceAdminError("Licença não encontrada.", "LICENSE_NOT_FOUND", 404);
  }

  assertLicenseEligibleForActivation(license);

  if (!license.mt5Account) {
    throw new LicenseDeviceAdminError(
      "Conta MT5 não vinculada à licença.",
      "MT5_NOT_LINKED",
      403
    );
  }

  if (
    license.status !== LicenseStatus.ACTIVE &&
    license.status !== LicenseStatus.PENDING_ACTIVATION
  ) {
    throw new LicenseDeviceAdminError(
      "Licença não elegível para código de ativação.",
      "LICENSE_NOT_ELIGIBLE",
      403
    );
  }

  const { code, expiresAt } = await createActivationCodeForLicense(license.id);

  await recordAdminAction({
    actorId: input.actorId,
    action: "license.activation_code_issued_admin",
    targetType: "license",
    targetId: license.id,
    ipAddress: input.ipAddress,
    metadata: {
      licenseIdMasked: maskLicenseId(license.id),
      expiresAt: expiresAt.toISOString(),
    },
  });

  return {
    code,
    expiresAt: expiresAt.toISOString(),
    expiresInMinutes: 15,
  };
}
