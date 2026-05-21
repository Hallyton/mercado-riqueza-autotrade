import {
  LicenseStatus,
  SubscriptionStatus,
  type Device,
  type Prisma,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { hashToken } from "./token";
import { isEaOffline } from "./status";

const eaLicenseInclude = {
  subscription: { include: { plan: true } },
  mt5Account: true,
  exposureProfile: true,
} satisfies Prisma.LicenseInclude;

export type EaLicensePayload = Prisma.LicenseGetPayload<{
  include: typeof eaLicenseInclude;
}>;

export type EaAuthContext = {
  device: Prisma.DeviceGetPayload<Record<string, never>>;
  license: EaLicensePayload;
  requestId: string | null;
  deviceIdHeader: string | null;
  eaVersion: string | null;
};

export class EaAuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "EaAuthError";
  }
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim();
}

export function readEaHeaders(request: Request) {
  return {
    requestId: request.headers.get("x-request-id"),
    deviceId: request.headers.get("x-device-id"),
    eaVersion: request.headers.get("x-ea-version"),
  };
}

export async function authenticateEaRequest(
  request: Request
): Promise<EaAuthContext> {
  const token = extractBearerToken(request);
  if (!token) {
    throw new EaAuthError("Token ausente", "MISSING_TOKEN", 401);
  }

  const tokenHash = hashToken(token);
  const headers = readEaHeaders(request);

  const device = await prisma.device.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
    },
    include: {
      license: { include: eaLicenseInclude },
    },
  });

  if (!device?.license) {
    throw new EaAuthError("Token inválido", "INVALID_TOKEN", 401);
  }

  if (headers.deviceId && headers.deviceId !== device.deviceId) {
    throw new EaAuthError(
      "Device ID não confere com o token",
      "DEVICE_MISMATCH",
      403
    );
  }

  return {
    device,
    license: device.license,
    requestId: headers.requestId,
    deviceIdHeader: headers.deviceId,
    eaVersion: headers.eaVersion,
  };
}

export function assertSubscriptionActive(
  ctx: EaAuthContext
): void {
  const sub = ctx.license.subscription;
  if (!sub || sub.status !== SubscriptionStatus.ACTIVE) {
    throw new EaAuthError(
      "Assinatura inativa ou inexistente",
      "SUBSCRIPTION_INACTIVE",
      403
    );
  }

  if (sub.currentPeriodEnd && sub.currentPeriodEnd < new Date()) {
    throw new EaAuthError(
      "Assinatura vencida",
      "SUBSCRIPTION_EXPIRED",
      403
    );
  }
}

export function assertLicenseUsable(ctx: EaAuthContext): void {
  if (ctx.license.status === LicenseStatus.REVOKED) {
    throw new EaAuthError("Licença revogada", "LICENSE_REVOKED", 403);
  }

  if (ctx.license.status === LicenseStatus.PENDING_ACTIVATION) {
    throw new EaAuthError(
      "Licença aguardando ativação completa",
      "LICENSE_PENDING",
      403
    );
  }
}

export function assertMt5AccountAuthorized(
  ctx: EaAuthContext,
  login: string,
  server: string
): void {
  const account = ctx.license.mt5Account;
  if (!account) {
    throw new EaAuthError(
      "Conta MT5 não vinculada à licença",
      "MT5_NOT_LINKED",
      403
    );
  }

  if (account.login !== login || account.server !== server) {
    throw new EaAuthError(
      "Conta MT5 não autorizada para esta licença",
      "MT5_UNAUTHORIZED",
      403
    );
  }
}

export function assertDemoAllowed(ctx: EaAuthContext, tradeMode?: string): void {
  if (tradeMode === "DEMO" && !ctx.license.subscription?.plan.allowDemo) {
    throw new EaAuthError(
      "Conta demo não permitida neste plano",
      "DEMO_NOT_ALLOWED",
      403
    );
  }
}

export function getEaOnlineState(device: Device): {
  online: boolean;
  lastSeenAt: string | null;
} {
  return {
    online: !isEaOffline(device.lastSeenAt),
    lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
  };
}
