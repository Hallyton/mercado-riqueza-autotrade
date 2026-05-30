import { randomBytes } from "crypto";
import { hash } from "bcryptjs";
import {
  SubscriptionStatus,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { z } from "zod";
import { recordAdminAction } from "@/lib/admin/record-action";
import { blockClient } from "@/lib/admin/commands";
import { activateSubscription } from "@/lib/licensing/service";
import prisma from "@/lib/prisma";
import { maskLicenseId } from "@/lib/risk/real-trading-guard-status";

const BCRYPT_COST = 12;

export const USER_BLOCK_CONFIRM_PHRASE = "BLOQUEAR USUARIO";
export const USER_DEACTIVATE_CONFIRM_PHRASE = "INATIVAR USUARIO";
export const USER_REACTIVATE_CONFIRM_PHRASE = "REATIVAR USUARIO";
export const USER_RESET_PASSWORD_CONFIRM_PHRASE = "RESETAR SENHA";

export const adminUserConfirmationSchema = z.object({
  admin_confirmation: z.string().min(1),
});

export class UserAdminError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "UserAdminError";
  }
}

function assertConfirmation(actual: string, expected: string) {
  if (actual.trim() !== expected) {
    throw new UserAdminError(
      `Confirmação inválida. Digite exatamente: ${expected}`,
      "CONFIRMATION_MISMATCH",
      400
    );
  }
}

function assertNotSelf(actorId: string, targetUserId: string, action: string) {
  if (actorId === targetUserId) {
    throw new UserAdminError(
      `Não é permitido ${action} o próprio usuário autenticado.`,
      "SELF_ACTION_FORBIDDEN",
      403
    );
  }
}

export function generateTemporaryPassword(length = 16): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = randomBytes(length);
  let pwd = "";
  for (let i = 0; i < length; i++) {
    pwd += chars[bytes[i]! % chars.length]!;
  }
  return pwd;
}

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  role: z.nativeEnum(UserRole),
  temporaryPassword: z.string().min(12).max(128).optional(),
  generatePassword: z.boolean().optional(),
  mustChangePassword: z.boolean().optional(),
  planSlug: z.string().min(1).optional(),
  createSubscription: z.boolean().optional(),
  createLicense: z.boolean().optional(),
});

export type CreateAdminUserInput = z.infer<typeof createUserSchema> & {
  actorId: string;
  ipAddress?: string | null;
};

export async function listAdminUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subscriptions: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        include: { plan: true },
      },
      licenses: { select: { id: true, status: true }, take: 5 },
      _count: { select: { licenses: true } },
    },
  });

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
    subscription: u.subscriptions[0]
      ? {
          id: u.subscriptions[0].id,
          status: u.subscriptions[0].status,
          planName: u.subscriptions[0].plan.name,
        }
      : null,
    licenseCount: u._count.licenses,
  }));
}

export async function getAdminUserDetail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscriptions: {
        orderBy: { updatedAt: "desc" },
        include: {
          plan: true,
          licenses: {
            include: { mt5Account: true },
            orderBy: { updatedAt: "desc" },
          },
        },
      },
      licenses: {
        include: {
          mt5Account: true,
          devices: { orderBy: { createdAt: "desc" }, take: 20 },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!user) return null;

  const activationCodes = await prisma.activationCode.findMany({
    where: { licenseId: { in: user.licenses.map((l) => l.id) } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      licenseId: true,
      expiresAt: true,
      usedAt: true,
      createdAt: true,
    },
  });

  const adminActions = await prisma.adminAction.findMany({
    where: { targetType: "user", targetId: userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      action: true,
      createdAt: true,
      actorId: true,
      metadata: true,
    },
  });

  const heartbeats = await prisma.eaHeartbeat.findMany({
    where: { licenseId: { in: user.licenses.map((l) => l.id) } },
    orderBy: { receivedAt: "desc" },
    take: 10,
    select: {
      id: true,
      licenseId: true,
      deviceId: true,
      tradeMode: true,
      receivedAt: true,
      eaStatus: true,
    },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      blockedAt: user.blockedAt,
      inactiveAt: user.inactiveAt,
    },
    subscriptions: user.subscriptions.map((s) => ({
      id: s.id,
      status: s.status,
      planName: s.plan.name,
      planSlug: s.plan.slug,
      currentPeriodEnd: s.currentPeriodEnd,
      licenses: s.licenses.map((l) => ({
        id: l.id,
        licenseIdMasked: maskLicenseId(l.id),
        status: l.status,
        mt5: l.mt5Account
          ? `${l.mt5Account.login}@${l.mt5Account.server}`
          : null,
      })),
    })),
    licenses: user.licenses.map((l) => ({
      id: l.id,
      licenseIdMasked: maskLicenseId(l.id),
      status: l.status,
      mt5: l.mt5Account
        ? `${l.mt5Account.login}@${l.mt5Account.server}`
        : null,
      deviceCount: l.devices.length,
      devices: l.devices.map((d) => ({
        id: d.id,
        deviceId: d.deviceId,
        status: d.status,
        lastSeenAt: d.lastSeenAt,
      })),
    })),
    activationCodes: activationCodes.map((c) => ({
      id: c.id,
      licenseIdMasked: maskLicenseId(c.licenseId),
      expiresAt: c.expiresAt,
      usedAt: c.usedAt,
      createdAt: c.createdAt,
    })),
    recentHeartbeats: heartbeats,
    adminActions,
  };
}

export async function createAdminUser(input: CreateAdminUserInput) {
  const parsed = createUserSchema.parse({
    email: input.email,
    name: input.name,
    role: input.role,
    temporaryPassword: input.temporaryPassword,
    generatePassword: input.generatePassword,
    mustChangePassword: input.mustChangePassword,
    planSlug: input.planSlug,
    createSubscription: input.createSubscription,
    createLicense: input.createLicense,
  });

  const email = parsed.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new UserAdminError("E-mail já cadastrado.", "EMAIL_ALREADY_EXISTS", 409);
  }

  let plainPassword: string | undefined;
  if (parsed.generatePassword) {
    plainPassword = generateTemporaryPassword();
  } else if (parsed.temporaryPassword) {
    plainPassword = parsed.temporaryPassword;
  }

  const passwordHash = plainPassword
    ? await hash(plainPassword, BCRYPT_COST)
    : undefined;

  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.name.trim(),
      role: parsed.role,
      status: UserStatus.ACTIVE,
      passwordHash,
      emailVerified: new Date(),
      mustChangePassword:
        parsed.mustChangePassword ?? Boolean(plainPassword),
    },
  });

  let subscriptionId: string | undefined;
  if (parsed.createSubscription && parsed.planSlug) {
    const plan = await prisma.plan.findUnique({
      where: { slug: parsed.planSlug.toLowerCase() },
    });
    if (!plan) {
      throw new UserAdminError("Plano não encontrado.", "PLAN_NOT_FOUND", 404);
    }

    const sub = await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        status: SubscriptionStatus.INCOMPLETE,
        gateway: "admin_manual",
      },
    });
    subscriptionId = sub.id;

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await activateSubscription(sub.id, { start: now, end: periodEnd }, {
      gateway: "admin_manual",
      gatewaySubscriptionId: `admin-${sub.id}`,
      actorId: input.actorId,
    });
  }

  await recordAdminAction({
    actorId: input.actorId,
    action: "admin.user_created",
    targetType: "user",
    targetId: user.id,
    ipAddress: input.ipAddress,
    metadata: {
      email,
      role: parsed.role,
      hasSubscription: Boolean(subscriptionId),
      passwordIssued: Boolean(plainPassword),
    },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
    },
    temporaryPassword: plainPassword,
    subscriptionId,
  };
}

const updateUserSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  role: z.nativeEnum(UserRole).optional(),
  email: z.string().email().optional(),
});

export async function updateAdminUser(input: {
  userId: string;
  actorId: string;
  data: z.infer<typeof updateUserSchema>;
  ipAddress?: string | null;
}) {
  const parsed = updateUserSchema.parse(input.data);
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) {
    throw new UserAdminError("Usuário não encontrado.", "USER_NOT_FOUND", 404);
  }

  if (parsed.email) {
    const email = parsed.email.trim().toLowerCase();
    const dup = await prisma.user.findFirst({
      where: { email, NOT: { id: input.userId } },
    });
    if (dup) {
      throw new UserAdminError("E-mail já em uso.", "EMAIL_ALREADY_EXISTS", 409);
    }
  }

  const updated = await prisma.user.update({
    where: { id: input.userId },
    data: {
      ...(parsed.name !== undefined ? { name: parsed.name.trim() } : {}),
      ...(parsed.role !== undefined ? { role: parsed.role } : {}),
      ...(parsed.email !== undefined
        ? { email: parsed.email.trim().toLowerCase() }
        : {}),
    },
  });

  await recordAdminAction({
    actorId: input.actorId,
    action: "admin.user_updated",
    targetType: "user",
    targetId: user.id,
    ipAddress: input.ipAddress,
    metadata: {
      fields: Object.keys(parsed),
    },
  });

  return {
    id: updated.id,
    email: updated.email,
    name: updated.name,
    role: updated.role,
    status: updated.status,
  };
}

export async function blockAdminUser(input: {
  userId: string;
  actorId: string;
  adminConfirmation: string;
  ipAddress?: string | null;
  reason?: string;
}) {
  assertConfirmation(input.adminConfirmation, USER_BLOCK_CONFIRM_PHRASE);
  assertNotSelf(input.actorId, input.userId, "bloquear");

  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) {
    throw new UserAdminError("Usuário não encontrado.", "USER_NOT_FOUND", 404);
  }

  const now = new Date();
  await prisma.user.update({
    where: { id: input.userId },
    data: {
      status: UserStatus.BLOCKED,
      blockedAt: now,
      blockedByUserId: input.actorId,
      inactiveAt: null,
      inactiveByUserId: null,
    },
  });

  await blockClient({
    userId: input.userId,
    actorId: input.actorId,
    ipAddress: input.ipAddress,
    reason: input.reason ?? "admin_user_blocked",
  });

  await recordAdminAction({
    actorId: input.actorId,
    action: "admin.user_blocked",
    targetType: "user",
    targetId: input.userId,
    ipAddress: input.ipAddress,
    metadata: { reason: input.reason },
  });

  return { userId: input.userId, status: UserStatus.BLOCKED };
}

export async function deactivateAdminUser(input: {
  userId: string;
  actorId: string;
  adminConfirmation: string;
  ipAddress?: string | null;
  reason?: string;
}) {
  assertConfirmation(input.adminConfirmation, USER_DEACTIVATE_CONFIRM_PHRASE);
  assertNotSelf(input.actorId, input.userId, "inativar");

  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) {
    throw new UserAdminError("Usuário não encontrado.", "USER_NOT_FOUND", 404);
  }

  const now = new Date();
  await prisma.user.update({
    where: { id: input.userId },
    data: {
      status: UserStatus.INACTIVE,
      inactiveAt: now,
      inactiveByUserId: input.actorId,
    },
  });

  await prisma.license.updateMany({
    where: { userId: input.userId },
    data: { haltNewEntries: true },
  });

  await recordAdminAction({
    actorId: input.actorId,
    action: "admin.user_deactivated",
    targetType: "user",
    targetId: input.userId,
    ipAddress: input.ipAddress,
    metadata: { reason: input.reason },
  });

  return { userId: input.userId, status: UserStatus.INACTIVE };
}

export async function reactivateAdminUser(input: {
  userId: string;
  actorId: string;
  adminConfirmation: string;
  ipAddress?: string | null;
}) {
  assertConfirmation(input.adminConfirmation, USER_REACTIVATE_CONFIRM_PHRASE);

  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) {
    throw new UserAdminError("Usuário não encontrado.", "USER_NOT_FOUND", 404);
  }

  await prisma.user.update({
    where: { id: input.userId },
    data: {
      status: UserStatus.ACTIVE,
      blockedAt: null,
      blockedByUserId: null,
      inactiveAt: null,
      inactiveByUserId: null,
    },
  });

  await recordAdminAction({
    actorId: input.actorId,
    action: "admin.user_reactivated",
    targetType: "user",
    targetId: input.userId,
    ipAddress: input.ipAddress,
  });

  return { userId: input.userId, status: UserStatus.ACTIVE };
}

const resetPasswordSchema = z.object({
  temporaryPassword: z.string().min(12).max(128).optional(),
  generatePassword: z.boolean().optional(),
  mustChangePassword: z.boolean().optional(),
});

export async function resetAdminUserPassword(input: {
  userId: string;
  actorId: string;
  adminConfirmation: string;
  temporaryPassword?: string;
  generatePassword?: boolean;
  mustChangePassword?: boolean;
  ipAddress?: string | null;
}) {
  assertConfirmation(input.adminConfirmation, USER_RESET_PASSWORD_CONFIRM_PHRASE);

  const parsed = resetPasswordSchema.parse({
    temporaryPassword: input.temporaryPassword,
    generatePassword: input.generatePassword,
    mustChangePassword: input.mustChangePassword,
  });

  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) {
    throw new UserAdminError("Usuário não encontrado.", "USER_NOT_FOUND", 404);
  }

  let plainPassword: string;
  if (parsed.generatePassword) {
    plainPassword = generateTemporaryPassword();
  } else if (parsed.temporaryPassword) {
    plainPassword = parsed.temporaryPassword;
  } else {
    plainPassword = generateTemporaryPassword();
  }

  const passwordHash = await hash(plainPassword, BCRYPT_COST);

  await prisma.user.update({
    where: { id: input.userId },
    data: {
      passwordHash,
      mustChangePassword: parsed.mustChangePassword ?? true,
    },
  });

  await recordAdminAction({
    actorId: input.actorId,
    action: "admin.user_password_reset",
    targetType: "user",
    targetId: input.userId,
    ipAddress: input.ipAddress,
    metadata: { mustChangePassword: parsed.mustChangePassword ?? true },
  });

  return {
    userId: input.userId,
    temporaryPassword: plainPassword,
  };
}

export async function listPlansForAdminCreate() {
  return prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, slug: true, name: true },
  });
}

export function sanitizeUserResponse<T extends Record<string, unknown>>(
  data: T
): Omit<T, "passwordHash"> {
  const { passwordHash: _p, ...rest } = data as T & { passwordHash?: unknown };
  return rest;
}
