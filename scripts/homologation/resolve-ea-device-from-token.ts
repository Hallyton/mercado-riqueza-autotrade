/**
 * Resolve Device por tokenHash (mesma lógica do backend).
 * Não imprime token completo nem DATABASE_URL.
 */
import { hashToken } from "@/lib/ea/token";
import prisma from "@/lib/prisma";

export function maskOpaqueToken(token: string): string {
  const t = token.trim();
  if (t.length <= 10) return "***";
  return `${t.slice(0, 6)}...${t.slice(-4)}`;
}

export type ResolvedEaDevice = {
  deviceId: string;
  deviceRecordId: string;
  licenseId: string;
  userId: string;
  accountLogin: string | null;
  accountServer: string | null;
  licenseStatus: string;
  deviceRevokedAt: string | null;
  lastSeenAt: string | null;
  lastHeartbeatAt: string | null;
  tokenMasked: string;
};

export async function resolveEaDeviceFromBearerToken(
  bearerToken: string
): Promise<ResolvedEaDevice | null> {
  const tokenHash = hashToken(bearerToken.trim());

  const device = await prisma.device.findFirst({
    where: { tokenHash, revokedAt: null },
    include: {
      license: {
        include: {
          mt5Account: true,
          user: { select: { id: true } },
        },
      },
    },
  });

  if (!device?.license) return null;

  const lastHb = await prisma.eaHeartbeat.findFirst({
    where: { licenseId: device.licenseId },
    orderBy: { receivedAt: "desc" },
    select: { receivedAt: true },
  });

  return {
    deviceId: device.deviceId,
    deviceRecordId: device.id,
    licenseId: device.licenseId,
    userId: device.license.userId,
    accountLogin: device.license.mt5Account?.login ?? null,
    accountServer: device.license.mt5Account?.server ?? null,
    licenseStatus: device.license.status,
    deviceRevokedAt: device.revokedAt?.toISOString() ?? null,
    lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
    lastHeartbeatAt: lastHb?.receivedAt?.toISOString() ?? null,
    tokenMasked: maskOpaqueToken(bearerToken),
  };
}
