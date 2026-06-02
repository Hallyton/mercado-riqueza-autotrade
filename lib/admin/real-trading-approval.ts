import {
  RealTradingApprovalStatus,
  type Prisma,
} from "@prisma/client";
import { z } from "zod";
import { recordAdminAction } from "@/lib/admin/record-action";
import prisma from "@/lib/prisma";
import { magicNumberRange } from "@/lib/risk/real-trading-config";
import { maskAccountLogin, maskLicenseId } from "@/lib/risk/real-trading-guard-status";

export const REAL_TRADING_APPROVAL_CONFIRM_PHRASE = "AUTORIZO REAL CONTROLADO";

export const REAL_TRADING_APPROVAL_ACTION_PHRASES = {
  suspend: "SUSPENDER REAL",
  revoke: "REVOGAR REAL",
  block: "BLOQUEAR REAL",
} as const;

export type RealTradingApprovalAction = keyof typeof REAL_TRADING_APPROVAL_ACTION_PHRASES;

export const createRealTradingApprovalSchema = z.object({
  user_id: z.string().min(1),
  license_id: z.string().min(1),
  account_login: z.string().min(1).max(64),
  account_server: z.string().min(1).max(128),
  symbol: z.string().min(1).max(32),
  magic_number: z.number().int().positive(),
  max_contracts: z.number().int().min(1).max(100).default(1),
  min_free_margin: z.number().positive(),
  margin_buffer_percent: z.number().min(0).max(100).default(15),
  notes: z.string().max(2000).optional(),
  admin_confirmation: z.literal(REAL_TRADING_APPROVAL_CONFIRM_PHRASE),
});

export type CreateRealTradingApprovalInput = z.infer<
  typeof createRealTradingApprovalSchema
>;

export const updateRealTradingApprovalActionSchema = z.object({
  action: z.enum(["suspend", "revoke", "block"]),
  admin_confirmation: z.string().min(1),
});

export class RealTradingApprovalError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "RealTradingApprovalError";
  }
}

export async function createRealTradingApproval(
  input: CreateRealTradingApprovalInput & {
    actorId: string;
    ipAddress?: string | null;
  }
) {
  const range = magicNumberRange();
  if (
    input.magic_number < range.min ||
    input.magic_number > range.max
  ) {
    throw new RealTradingApprovalError(
      `MagicNumber fora da faixa permitida (${range.min}-${range.max})`,
      "MAGIC_NUMBER_OUT_OF_RANGE",
      400
    );
  }

  const license = await prisma.license.findUnique({
    where: { id: input.license_id },
    select: { id: true, userId: true },
  });
  if (!license || license.userId !== input.user_id) {
    throw new RealTradingApprovalError(
      "Licença não encontrada para o usuário",
      "LICENSE_NOT_FOUND",
      404
    );
  }

  const symbol = input.symbol.trim().toUpperCase();
  const login = input.account_login.trim();
  const server = input.account_server.trim();

  const approval = await prisma.realTradingApproval.create({
    data: {
      userId: input.user_id,
      licenseId: input.license_id,
      accountLogin: login,
      accountServer: server,
      symbol,
      magicNumber: input.magic_number,
      maxContracts: input.max_contracts,
      minFreeMargin: input.min_free_margin,
      marginBufferPercent: input.margin_buffer_percent,
      allowReal: true,
      status: RealTradingApprovalStatus.APPROVED,
      approvedByAdminId: input.actorId,
      approvedAt: new Date(),
      notes: input.notes,
    },
  });

  await recordAdminAction({
    actorId: input.actorId,
    action: "real_trading.approval_created",
    targetType: "real_trading_approval",
    targetId: approval.id,
    ipAddress: input.ipAddress,
    metadata: {
      licenseIdMasked: maskLicenseId(input.license_id),
      accountLoginMasked: maskAccountLogin(login),
      status: RealTradingApprovalStatus.APPROVED,
      magicNumber: input.magic_number,
      maxContracts: input.max_contracts,
    },
  });

  return approval;
}

export async function applyRealTradingApprovalAction(
  approvalId: string,
  input: {
    action: RealTradingApprovalAction;
    adminConfirmation: string;
    actorId: string;
    ipAddress?: string | null;
  }
) {
  const expected = REAL_TRADING_APPROVAL_ACTION_PHRASES[input.action];
  if (input.adminConfirmation.trim() !== expected) {
    throw new RealTradingApprovalError(
      `Confirmação inválida. Digite exatamente: ${expected}`,
      "CONFIRMATION_MISMATCH",
      400
    );
  }

  const existing = await prisma.realTradingApproval.findUnique({
    where: { id: approvalId },
  });
  if (!existing) {
    throw new RealTradingApprovalError(
      "Aprovação não encontrada",
      "NOT_FOUND",
      404
    );
  }

  const statusByAction: Record<RealTradingApprovalAction, RealTradingApprovalStatus> = {
    suspend: RealTradingApprovalStatus.SUSPENDED,
    revoke: RealTradingApprovalStatus.REVOKED,
    block: RealTradingApprovalStatus.BLOCKED,
  };

  const status = statusByAction[input.action];

  const approval = await prisma.realTradingApproval.update({
    where: { id: approvalId },
    data: {
      status,
      allowReal: false,
      revokedAt:
        input.action === "revoke" || input.action === "block"
          ? new Date()
          : existing.revokedAt,
    },
  });

  await recordAdminAction({
    actorId: input.actorId,
    action: `real_trading.approval_${input.action}`,
    targetType: "real_trading_approval",
    targetId: approval.id,
    ipAddress: input.ipAddress,
    metadata: {
      previousStatus: existing.status,
      newStatus: status,
      licenseIdMasked: maskLicenseId(existing.licenseId),
    },
  });

  return approval;
}

export async function getRealTradingApprovalById(approvalId: string) {
  return prisma.realTradingApproval.findUnique({
    where: { id: approvalId },
    include: {
      user: { select: { email: true, id: true } },
      license: {
        select: {
          id: true,
          status: true,
          mt5Account: { select: { login: true, server: true } },
        },
      },
    },
  });
}

export async function listRealTradingApprovals(
  take = 50
): Promise<
  Prisma.RealTradingApprovalGetPayload<{
    include: {
      user: { select: { email: true } };
      license: { select: { id: true } };
    };
  }>[]
> {
  return prisma.realTradingApproval.findMany({
    take,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { email: true } },
      license: { select: { id: true } },
    },
  });
}

export async function listRelatedSnapshotsForApproval(
  approval: {
    licenseId: string;
    accountLogin: string;
    accountServer: string;
    magicNumber: number;
  },
  take = 10
) {
  return prisma.accountSnapshot.findMany({
    where: {
      licenseId: approval.licenseId,
      accountLogin: approval.accountLogin,
      accountServer: approval.accountServer,
    },
    orderBy: { capturedAt: "desc" },
    take,
  });
}

export async function listRelatedPreflightsForApproval(
  approval: {
    licenseId: string;
    accountLogin: string;
    accountServer: string;
    magicNumber: number;
  },
  take = 10
) {
  return prisma.realTradePreflight.findMany({
    where: {
      licenseId: approval.licenseId,
      accountLogin: approval.accountLogin,
      accountServer: approval.accountServer,
      magicNumber: approval.magicNumber,
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function listRelatedProtectionReportsForApproval(
  approval: { licenseId: string; magicNumber: number },
  take = 10
) {
  return prisma.executionProtectionReport.findMany({
    where: {
      licenseId: approval.licenseId,
      magicNumber: approval.magicNumber,
    },
    orderBy: { reportedAt: "desc" },
    take,
  });
}

export async function listAccountSnapshotsAdmin(take = 50) {
  return prisma.accountSnapshot.findMany({
    take,
    orderBy: { capturedAt: "desc" },
    include: {
      user: { select: { email: true } },
      license: { select: { id: true } },
    },
  });
}

export async function listRealTradePreflightsAdmin(take = 50) {
  return prisma.realTradePreflight.findMany({
    take,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { email: true } },
    },
  });
}

export async function listExecutionProtectionReportsAdmin(take = 50) {
  return prisma.executionProtectionReport.findMany({
    take,
    orderBy: { reportedAt: "desc" },
    include: {
      license: {
        select: {
          id: true,
          user: { select: { email: true } },
        },
      },
      instruction: {
        select: {
          id: true,
          symbol: true,
          source: true,
          orderType: true,
          stopLoss: true,
          takeProfit: true,
          accountLogin: true,
          accountServer: true,
        },
      },
    },
  });
}
