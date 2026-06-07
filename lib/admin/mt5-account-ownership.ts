import {
  DeviceStatus,
  EAOperationalCommandStatus,
  LicenseStatus,
  RealTradingApprovalStatus,
  RobotInstanceStatus,
  SubscriptionStatus,
  TradeMode,
} from "@prisma/client";
import { z } from "zod";
import { LicenseDeviceAdminError } from "@/lib/admin/license-devices";
import { canManageMt5AccountOwnership } from "@/lib/admin/permissions";
import { recordAdminAction } from "@/lib/admin/record-action";
import { EA_LIVENESS_DEGRADED_THRESHOLD_SEC } from "@/lib/ea/liveness";
import { ACTIVE_DEVICE_WHERE } from "@/lib/licensing/device-lifecycle";
import prisma from "@/lib/prisma";
import {
  maskAccountLogin,
  maskLicenseId,
} from "@/lib/risk/real-trading-guard-status";

export const MT5_OWNERSHIP_RELEASE_CONFIRM_PHRASE = "LIBERAR CONTA MT5 ORFA";
export const MT5_OWNERSHIP_TRANSFER_CONFIRM_PHRASE =
  "TRANSFERIR CONTA MT5 PARA ESTA LICENCA";

export const MT5_OWNERSHIP_REASON_CODES = [
  "MT5_ACCOUNT_AVAILABLE",
  "MT5_ACCOUNT_OWNED_BY_ACTIVE_USER",
  "MT5_ACCOUNT_OWNED_BY_ACTIVE_LICENSE",
  "MT5_ACCOUNT_HELD_BY_CANCELLED_LICENSE",
  "MT5_ACCOUNT_HELD_BY_DELETED_USER",
  "MT5_ACCOUNT_HAS_RECENT_EA_ACTIVITY",
  "MT5_ACCOUNT_HAS_OPEN_POSITION_SNAPSHOT",
  "MT5_ACCOUNT_HAS_PENDING_ORDERS",
  "MT5_ACCOUNT_HAS_PENDING_COMMANDS",
  "MT5_ACCOUNT_HAS_ACTIVE_REAL_APPROVAL",
  "MT5_ACCOUNT_SERVER_MISMATCH",
  "MT5_ACCOUNT_UNKNOWN_CONFLICT",
] as const;

export type Mt5OwnershipReasonCode = (typeof MT5_OWNERSHIP_REASON_CODES)[number];

export type Mt5OwnershipRisk = {
  hasRecentEaActivity: boolean;
  hasOpenPositionSnapshot: boolean;
  hasPendingOrdersSnapshot: boolean;
  hasPendingOperationalCommand: boolean;
  hasActiveRealApproval: boolean;
};

export type Mt5OwnershipTraceView = {
  accountLogin: string;
  accountServer: string;
  currentOwner: {
    userId: string;
    email: string;
    userStatus: string;
    licenseId: string | null;
    licenseStatus: string | null;
    subscriptionStatus: string | null;
    robotInstanceId: string | null;
    deviceId: string | null;
    deviceStatus: string | null;
    lastHeartbeatAt: string | null;
    lastActivityAt: string | null;
  } | null;
  risk: Mt5OwnershipRisk;
  canRelease: boolean;
  canTransfer: boolean;
  recommendedAction: string | null;
  reasonCode: Mt5OwnershipReasonCode;
  blockReasons: string[];
};

export const mt5OwnershipReleaseSchema = z.object({
  accountLogin: z.string().min(1).max(32),
  accountServer: z.string().min(1).max(128),
  adminConfirmation: z.string().min(1),
  adminNote: z.string().min(3).max(500),
});

export const mt5OwnershipTransferSchema = z.object({
  fromLicenseId: z.string().min(1),
  toLicenseId: z.string().min(1),
  accountLogin: z.string().min(1).max(32),
  accountServer: z.string().min(1).max(128),
  symbol: z.string().min(1).max(32),
  magicNumber: z.coerce.number().int().positive(),
  environment: z.enum(["DEMO", "REAL"]),
  adminConfirmation: z.string().min(1),
  adminNote: z.string().min(3).max(500),
});

export class Mt5AccountOwnershipError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly detail?: Record<string, unknown>
  ) {
    super(message);
    this.name = "Mt5AccountOwnershipError";
  }
}

export function normalizeMt5OwnershipCredentials(login: string, server: string) {
  const accountLogin = login.trim();
  const accountServer = server.trim();
  if (!accountLogin || !accountServer) {
    throw new Mt5AccountOwnershipError(
      "Login e servidor MT5 são obrigatórios.",
      "VALIDATION_ERROR",
      400
    );
  }
  if (!/^\d+$/.test(accountLogin)) {
    throw new Mt5AccountOwnershipError(
      "Login MT5 deve conter apenas números.",
      "INVALID_MT5_LOGIN",
      400
    );
  }
  return { accountLogin, accountServer };
}

function buildTraceLink(accountLogin: string, accountServer: string) {
  const params = new URLSearchParams({
    accountLogin,
    accountServer,
  });
  return `/api/admin/mt5-accounts/ownership/trace?${params.toString()}`;
}

export function buildMt5OwnershipConflictDetail(input: {
  accountLogin: string;
  accountServer: string;
  trace: Mt5OwnershipTraceView;
}) {
  return {
    accountLogin: input.accountLogin,
    accountServer: input.accountServer,
    ownerSummary: input.trace.currentOwner,
    risk: input.trace.risk,
    reasonCode: input.trace.reasonCode,
    canRelease: input.trace.canRelease,
    canTransfer: input.trace.canTransfer,
    recommendedAction: input.trace.recommendedAction,
    blockReasons: input.trace.blockReasons,
    traceLink: buildTraceLink(input.accountLogin, input.accountServer),
    actionHint:
      input.trace.canRelease || input.trace.canTransfer
        ? "Use 'Liberar conta órfã' ou 'Transferir para esta licença' antes de salvar."
        : "Resolva os bloqueios de risco ou aguarde inatividade do EA antes de liberar.",
  };
}

async function assessMt5OwnershipRisk(input: {
  licenseIds: string[];
  accountLogin: string;
  accountServer: string;
}): Promise<Mt5OwnershipRisk> {
  if (input.licenseIds.length === 0) {
    return {
      hasRecentEaActivity: false,
      hasOpenPositionSnapshot: false,
      hasPendingOrdersSnapshot: false,
      hasPendingOperationalCommand: false,
      hasActiveRealApproval: false,
    };
  }

  const now = Date.now();
  const activityThresholdMs = EA_LIVENESS_DEGRADED_THRESHOLD_SEC * 1000;

  const [devices, snapshots, commands, approvals] = await Promise.all([
    prisma.device.findMany({
      where: {
        licenseId: { in: input.licenseIds },
        ...ACTIVE_DEVICE_WHERE,
      },
      select: {
        lastSeenAt: true,
        lastActivityAt: true,
      },
    }),
    prisma.eAOperationalSnapshot.findMany({
      where: {
        licenseId: { in: input.licenseIds },
        accountLogin: input.accountLogin,
        accountServer: input.accountServer,
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        hasOpenPosition: true,
        hasPendingOrders: true,
        pendingOrdersCount: true,
        updatedAt: true,
      },
    }),
    prisma.eAOperationalCommand.findFirst({
      where: {
        licenseId: { in: input.licenseIds },
        accountLogin: input.accountLogin,
        accountServer: input.accountServer,
        status: {
          in: [
            EAOperationalCommandStatus.PENDING,
            EAOperationalCommandStatus.ACKED,
          ],
        },
        expiresAt: { gt: new Date() },
      },
    }),
    prisma.realTradingApproval.findFirst({
      where: {
        licenseId: { in: input.licenseIds },
        accountLogin: input.accountLogin,
        accountServer: input.accountServer,
        status: RealTradingApprovalStatus.APPROVED,
      },
    }),
  ]);

  const hasRecentEaActivity = devices.some((device) => {
    const last = device.lastActivityAt ?? device.lastSeenAt;
    return last != null && now - last.getTime() <= activityThresholdMs;
  });

  const latestSnapshot = snapshots[0];
  const hasOpenPositionSnapshot = snapshots.some((row) => row.hasOpenPosition);
  const hasPendingOrdersSnapshot = snapshots.some(
    (row) => row.hasPendingOrders || row.pendingOrdersCount > 0
  );

  return {
    hasRecentEaActivity,
    hasOpenPositionSnapshot,
    hasPendingOrdersSnapshot,
    hasPendingOperationalCommand: Boolean(commands),
    hasActiveRealApproval: Boolean(approvals),
  };
}

function resolveReasonAndFlags(input: {
  userStatus: string;
  licenseStatus: string | null;
  subscriptionStatus: string | null;
  risk: Mt5OwnershipRisk;
}): {
  reasonCode: Mt5OwnershipReasonCode;
  blockReasons: string[];
  recommendedAction: string | null;
} {
  const blockReasons: string[] = [];

  if (input.risk.hasRecentEaActivity) {
    blockReasons.push("EA com atividade autenticada recente.");
  }
  if (input.risk.hasOpenPositionSnapshot) {
    blockReasons.push("Snapshot operacional indica posição aberta.");
  }
  if (input.risk.hasPendingOrdersSnapshot) {
    blockReasons.push("Snapshot operacional indica ordens pendentes.");
  }
  if (input.risk.hasPendingOperationalCommand) {
    blockReasons.push("Existe comando operacional pendente.");
  }
  if (input.risk.hasActiveRealApproval) {
    blockReasons.push("Existe aprovação REAL ativa vinculada à conta.");
  }

  if (input.userStatus === "ACTIVE" && input.subscriptionStatus === "ACTIVE") {
    if (
      input.licenseStatus === LicenseStatus.ACTIVE ||
      input.licenseStatus === LicenseStatus.PENDING_ACTIVATION
    ) {
      return {
        reasonCode: "MT5_ACCOUNT_OWNED_BY_ACTIVE_LICENSE",
        blockReasons,
        recommendedAction: "Conta em uso por licença ativa — não liberar.",
      };
    }
    return {
      reasonCode: "MT5_ACCOUNT_OWNED_BY_ACTIVE_USER",
      blockReasons,
      recommendedAction: "Usuário ainda ativo com assinatura — revisar cancelamento.",
    };
  }

  if (input.userStatus === "INACTIVE" || input.userStatus === "BLOCKED") {
    return {
      reasonCode: "MT5_ACCOUNT_HELD_BY_DELETED_USER",
      blockReasons,
      recommendedAction:
        blockReasons.length === 0 ? "RELEASE_OR_TRANSFER" : "RESOLVE_RISK_THEN_RELEASE",
    };
  }

  if (
    input.subscriptionStatus === SubscriptionStatus.CANCELLED ||
    input.licenseStatus === LicenseStatus.REVOKED ||
    input.licenseStatus === LicenseStatus.SUSPENDED
  ) {
    return {
      reasonCode: "MT5_ACCOUNT_HELD_BY_CANCELLED_LICENSE",
      blockReasons,
      recommendedAction:
        blockReasons.length === 0 ? "RELEASE_OR_TRANSFER" : "RESOLVE_RISK_THEN_RELEASE",
    };
  }

  return {
    reasonCode: "MT5_ACCOUNT_UNKNOWN_CONFLICT",
    blockReasons,
    recommendedAction: blockReasons.length === 0 ? "RELEASE_OR_TRANSFER" : null,
  };
}

export async function traceMt5AccountOwnership(input: {
  accountLogin: string;
  accountServer: string;
  actorId: string;
  ipAddress?: string | null;
  skipAudit?: boolean;
}): Promise<Mt5OwnershipTraceView> {
  const { accountLogin, accountServer } = normalizeMt5OwnershipCredentials(
    input.accountLogin,
    input.accountServer
  );

  const mt5 = await prisma.mt5Account.findUnique({
    where: { login_server: { login: accountLogin, server: accountServer } },
    include: {
      user: { select: { id: true, email: true, status: true } },
      licenses: {
        include: {
          subscription: { select: { status: true } },
          robotInstances: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: { id: true },
          },
          devices: {
            where: ACTIVE_DEVICE_WHERE,
            orderBy: { lastActivityAt: "desc" },
            take: 1,
            select: {
              deviceId: true,
              status: true,
              lastSeenAt: true,
              lastActivityAt: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!mt5) {
    const emptyRisk: Mt5OwnershipRisk = {
      hasRecentEaActivity: false,
      hasOpenPositionSnapshot: false,
      hasPendingOrdersSnapshot: false,
      hasPendingOperationalCommand: false,
      hasActiveRealApproval: false,
    };
    const trace: Mt5OwnershipTraceView = {
      accountLogin,
      accountServer,
      currentOwner: null,
      risk: emptyRisk,
      canRelease: false,
      canTransfer: false,
      recommendedAction: "BIND_DIRECTLY",
      reasonCode: "MT5_ACCOUNT_AVAILABLE",
      blockReasons: [],
    };

    if (!input.skipAudit) {
      await recordAdminAction({
        actorId: input.actorId,
        action: "mt5_account.ownership.trace",
        targetType: "mt5_account",
        metadata: {
          accountLogin: maskAccountLogin(accountLogin),
          accountServer,
          reasonCode: trace.reasonCode,
          canRelease: trace.canRelease,
          canTransfer: trace.canTransfer,
        },
        ipAddress: input.ipAddress,
      });
    }

    return trace;
  }

  const primaryLicense =
    mt5.licenses.find((l) => l.status === LicenseStatus.ACTIVE) ??
    mt5.licenses[0] ??
    null;

  const licenseIds = mt5.licenses.map((l) => l.id);
  const risk = await assessMt5OwnershipRisk({
    licenseIds,
    accountLogin,
    accountServer,
  });

  const latestHeartbeat = primaryLicense
    ? await prisma.eaHeartbeat.findFirst({
        where: { licenseId: primaryLicense.id },
        orderBy: { receivedAt: "desc" },
        select: { receivedAt: true },
      })
    : null;

  const activeDevice = primaryLicense?.devices[0] ?? null;
  const { reasonCode, blockReasons, recommendedAction } = resolveReasonAndFlags({
    userStatus: mt5.user.status,
    licenseStatus: primaryLicense?.status ?? null,
    subscriptionStatus: primaryLicense?.subscription?.status ?? null,
    risk,
  });

  const canRelease =
    blockReasons.length === 0 &&
    reasonCode !== "MT5_ACCOUNT_OWNED_BY_ACTIVE_LICENSE" &&
    reasonCode !== "MT5_ACCOUNT_OWNED_BY_ACTIVE_USER";

  const canTransfer = canRelease;

  const trace: Mt5OwnershipTraceView = {
    accountLogin,
    accountServer,
    currentOwner: {
      userId: mt5.user.id,
      email: mt5.user.email,
      userStatus: mt5.user.status,
      licenseId: primaryLicense?.id ?? null,
      licenseStatus: primaryLicense?.status ?? null,
      subscriptionStatus: primaryLicense?.subscription?.status ?? null,
      robotInstanceId: primaryLicense?.robotInstances[0]?.id ?? null,
      deviceId: activeDevice?.deviceId ?? null,
      deviceStatus: activeDevice?.status ?? null,
      lastHeartbeatAt: latestHeartbeat?.receivedAt.toISOString() ?? null,
      lastActivityAt:
        activeDevice?.lastActivityAt?.toISOString() ??
        activeDevice?.lastSeenAt?.toISOString() ??
        null,
    },
    risk,
    canRelease,
    canTransfer,
    recommendedAction,
    reasonCode,
    blockReasons,
  };

  if (!input.skipAudit) {
    await recordAdminAction({
      actorId: input.actorId,
      action: "mt5_account.ownership.trace",
      targetType: "mt5_account",
      targetId: mt5.id,
      metadata: {
        accountLogin: maskAccountLogin(accountLogin),
        accountServer,
        fromUserId: mt5.user.id,
        fromLicenseId: primaryLicense?.id ?? null,
        reasonCode,
        riskFlags: risk,
        canRelease,
        canTransfer,
      },
      ipAddress: input.ipAddress,
    });
  }

  return trace;
}

async function unlinkMt5FromLicenses(input: {
  mt5AccountId: string;
  accountLogin: string;
  accountServer: string;
}) {
  const licenses = await prisma.license.findMany({
    where: { mt5AccountId: input.mt5AccountId },
    include: {
      robotInstances: { select: { id: true, status: true } },
    },
  });

  const now = new Date();

  for (const license of licenses) {
    await prisma.license.update({
      where: { id: license.id },
      data: {
        mt5AccountId: null,
        ...(license.expectedAccountLogin === input.accountLogin &&
        license.expectedAccountServer === input.accountServer
          ? {
              expectedAccountLogin: null,
              expectedAccountServer: null,
            }
          : {}),
      },
    });

    await prisma.device.updateMany({
      where: { licenseId: license.id, ...ACTIVE_DEVICE_WHERE },
      data: {
        status: DeviceStatus.REVOKED,
        revokedAt: now,
      },
    });

    await prisma.activationCode.updateMany({
      where: { licenseId: license.id, usedAt: null },
      data: { usedAt: now },
    });

    for (const robot of license.robotInstances) {
      if (
        robot.status === RobotInstanceStatus.OPERATIONAL_CONTROLLED ||
        robot.status === RobotInstanceStatus.EA_ONLINE
      ) {
        await prisma.robotInstance.update({
          where: { id: robot.id },
          data: { status: RobotInstanceStatus.SUSPENDED },
        });
      }
    }
  }

  return licenses.map((l) => l.id);
}

export async function releaseMt5AccountOwnership(input: {
  accountLogin: string;
  accountServer: string;
  adminConfirmation: string;
  adminNote: string;
  actorId: string;
  ipAddress?: string | null;
}) {
  if (input.adminConfirmation.trim() !== MT5_OWNERSHIP_RELEASE_CONFIRM_PHRASE) {
    throw new Mt5AccountOwnershipError(
      `Confirmação inválida. Digite: ${MT5_OWNERSHIP_RELEASE_CONFIRM_PHRASE}`,
      "CONFIRMATION_MISMATCH",
      400
    );
  }

  const { accountLogin, accountServer } = normalizeMt5OwnershipCredentials(
    input.accountLogin,
    input.accountServer
  );

  const trace = await traceMt5AccountOwnership({
    accountLogin,
    accountServer,
    actorId: input.actorId,
    ipAddress: input.ipAddress,
  });

  if (trace.reasonCode === "MT5_ACCOUNT_AVAILABLE") {
    throw new Mt5AccountOwnershipError(
      "Conta MT5 não está vinculada a nenhum usuário.",
      "MT5_ACCOUNT_AVAILABLE",
      409
    );
  }

  if (!trace.canRelease) {
    await recordAdminAction({
      actorId: input.actorId,
      action: "mt5_account.ownership.release_failed",
      targetType: "mt5_account",
      metadata: {
        accountLogin: maskAccountLogin(accountLogin),
        accountServer,
        reasonCode: trace.reasonCode,
        blockReasons: trace.blockReasons,
        riskFlags: trace.risk,
        adminNote: input.adminNote.trim(),
      },
      ipAddress: input.ipAddress,
    });
    throw new Mt5AccountOwnershipError(
      "Liberação bloqueada pelas travas de segurança.",
      trace.reasonCode,
      409,
      {
        blockReasons: trace.blockReasons,
        risk: trace.risk,
      }
    );
  }

  const mt5 = await prisma.mt5Account.findUnique({
    where: { login_server: { login: accountLogin, server: accountServer } },
  });
  if (!mt5) {
    throw new Mt5AccountOwnershipError(
      "Conta MT5 não encontrada.",
      "MT5_ACCOUNT_NOT_FOUND",
      404
    );
  }

  const releasedLicenseIds = await unlinkMt5FromLicenses({
    mt5AccountId: mt5.id,
    accountLogin,
    accountServer,
  });

  await prisma.mt5Account.delete({ where: { id: mt5.id } });

  await recordAdminAction({
    actorId: input.actorId,
    action: "mt5_account.ownership.released",
    targetType: "mt5_account",
    targetId: mt5.id,
    metadata: {
      accountLogin: maskAccountLogin(accountLogin),
      accountServer,
      fromUserId: trace.currentOwner?.userId ?? null,
      fromLicenseIds: releasedLicenseIds,
      reasonCode: trace.reasonCode,
      riskFlags: trace.risk,
      adminNote: input.adminNote.trim(),
    },
    ipAddress: input.ipAddress,
  });

  return {
    released: true as const,
    accountLogin,
    accountServer,
    releasedLicenseIds,
    reasonCode: trace.reasonCode,
  };
}

export async function transferMt5AccountOwnership(input: {
  fromLicenseId: string;
  toLicenseId: string;
  accountLogin: string;
  accountServer: string;
  symbol: string;
  magicNumber: number;
  environment: "DEMO" | "REAL";
  adminConfirmation: string;
  adminNote: string;
  actorId: string;
  ipAddress?: string | null;
}) {
  if (input.adminConfirmation.trim() !== MT5_OWNERSHIP_TRANSFER_CONFIRM_PHRASE) {
    throw new Mt5AccountOwnershipError(
      `Confirmação inválida. Digite: ${MT5_OWNERSHIP_TRANSFER_CONFIRM_PHRASE}`,
      "CONFIRMATION_MISMATCH",
      400
    );
  }

  const { accountLogin, accountServer } = normalizeMt5OwnershipCredentials(
    input.accountLogin,
    input.accountServer
  );
  const symbol = input.symbol.trim().toUpperCase();

  const [fromLicense, toLicense, mt5] = await Promise.all([
    prisma.license.findUnique({
      where: { id: input.fromLicenseId },
      include: { mt5Account: true, user: { select: { id: true, email: true } } },
    }),
    prisma.license.findUnique({
      where: { id: input.toLicenseId },
      include: { mt5Account: true, user: { select: { id: true, email: true } } },
    }),
    prisma.mt5Account.findUnique({
      where: { login_server: { login: accountLogin, server: accountServer } },
    }),
  ]);

  if (!fromLicense) {
    throw new Mt5AccountOwnershipError(
      "Licença de origem não encontrada.",
      "FROM_LICENSE_NOT_FOUND",
      404
    );
  }
  if (!toLicense) {
    throw new Mt5AccountOwnershipError(
      "Licença de destino não encontrada.",
      "TO_LICENSE_NOT_FOUND",
      404
    );
  }
  if (toLicense.status === LicenseStatus.REVOKED) {
    throw new Mt5AccountOwnershipError(
      "Licença de destino revogada.",
      "TO_LICENSE_REVOKED",
      409
    );
  }
  if (!mt5) {
    throw new Mt5AccountOwnershipError(
      "Conta MT5 não encontrada para transferência.",
      "MT5_ACCOUNT_NOT_FOUND",
      404
    );
  }

  if (fromLicense.mt5AccountId !== mt5.id) {
    throw new Mt5AccountOwnershipError(
      "Licença de origem não possui vínculo com esta conta MT5.",
      "FROM_LICENSE_NOT_OWNER",
      409
    );
  }

  if (
    toLicense.mt5Account &&
    (toLicense.mt5Account.login !== accountLogin ||
      toLicense.mt5Account.server !== accountServer)
  ) {
    throw new Mt5AccountOwnershipError(
      "Licença de destino já possui outra conta MT5 vinculada.",
      "TO_LICENSE_MT5_CONFLICT",
      409
    );
  }

  const trace = await traceMt5AccountOwnership({
    accountLogin,
    accountServer,
    actorId: input.actorId,
    ipAddress: input.ipAddress,
  });

  if (!trace.canTransfer) {
    await recordAdminAction({
      actorId: input.actorId,
      action: "mt5_account.ownership.transfer_failed",
      targetType: "mt5_account",
      metadata: {
        accountLogin: maskAccountLogin(accountLogin),
        accountServer,
        fromLicenseId: input.fromLicenseId,
        toLicenseId: input.toLicenseId,
        reasonCode: trace.reasonCode,
        blockReasons: trace.blockReasons,
        riskFlags: trace.risk,
        adminNote: input.adminNote.trim(),
      },
      ipAddress: input.ipAddress,
    });
    throw new Mt5AccountOwnershipError(
      "Transferência bloqueada pelas travas de segurança.",
      trace.reasonCode,
      409,
      { blockReasons: trace.blockReasons, risk: trace.risk }
    );
  }

  const releasedLicenseIds = await unlinkMt5FromLicenses({
    mt5AccountId: mt5.id,
    accountLogin,
    accountServer,
  });

  await prisma.mt5Account.update({
    where: { id: mt5.id },
    data: { userId: toLicense.userId },
  });

  const updated = await prisma.license.update({
    where: { id: toLicense.id },
    data: {
      mt5AccountId: mt5.id,
      expectedTradeMode:
        input.environment === "REAL" ? TradeMode.REAL : TradeMode.DEMO,
      expectedAccountLogin: accountLogin,
      expectedAccountServer: accountServer,
      expectedSymbol: symbol,
      expectedMagicNumber: input.magicNumber,
    },
  });

  await prisma.robotInstance.updateMany({
    where: { licenseId: toLicense.id },
    data: {
      symbol,
      magicNumber: input.magicNumber,
    },
  });

  await recordAdminAction({
    actorId: input.actorId,
    action: "mt5_account.ownership.transfered",
    targetType: "mt5_account",
    targetId: mt5.id,
    metadata: {
      accountLogin: maskAccountLogin(accountLogin),
      accountServer,
      fromUserId: fromLicense.userId,
      fromLicenseId: input.fromLicenseId,
      toUserId: toLicense.userId,
      toLicenseId: input.toLicenseId,
      releasedLicenseIds,
      reasonCode: trace.reasonCode,
      riskFlags: trace.risk,
      expectedSymbol: symbol,
      expectedMagicNumber: input.magicNumber,
      expectedTradeMode: updated.expectedTradeMode,
      adminNote: input.adminNote.trim(),
    },
    ipAddress: input.ipAddress,
  });

  return {
    transferred: true as const,
    accountLogin,
    accountServer,
    fromLicenseId: input.fromLicenseId,
    toLicenseId: input.toLicenseId,
    releasedLicenseIds,
  };
}

export async function assertMt5AccountAvailableForLicense(input: {
  licenseId: string;
  userId: string;
  accountLogin: string;
  accountServer: string;
}) {
  const { accountLogin, accountServer } = normalizeMt5OwnershipCredentials(
    input.accountLogin,
    input.accountServer
  );

  const existingMt5 = await prisma.mt5Account.findUnique({
    where: { login_server: { login: accountLogin, server: accountServer } },
  });

  if (!existingMt5) return;

  if (existingMt5.userId === input.userId) return;

  const trace = await traceMt5AccountOwnership({
    accountLogin,
    accountServer,
    actorId: "system",
    skipAudit: true,
  });

  const detail = buildMt5OwnershipConflictDetail({
    accountLogin,
    accountServer,
    trace,
  });

  const message =
    trace.reasonCode === "MT5_ACCOUNT_HELD_BY_CANCELLED_LICENSE" ||
    trace.reasonCode === "MT5_ACCOUNT_HELD_BY_DELETED_USER"
      ? "Esta conta MT5 ainda está vinculada a uma licença cancelada ou usuário inativo."
      : "Esta conta MT5 já está vinculada a outro usuário.";

  throw new LicenseDeviceAdminError(message, trace.reasonCode, 403, detail);
}

export function maskOwnershipTraceForApi(trace: Mt5OwnershipTraceView) {
  return {
    ...trace,
    currentOwner: trace.currentOwner
      ? {
          ...trace.currentOwner,
          licenseIdMasked: trace.currentOwner.licenseId
            ? maskLicenseId(trace.currentOwner.licenseId)
            : null,
        }
      : null,
  };
}
