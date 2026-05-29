import {
  RealTradingApprovalStatus,
  type Prisma,
} from "@prisma/client";
import { z } from "zod";
import { recordAdminAction } from "@/lib/admin/record-action";
import prisma from "@/lib/prisma";
import { magicNumberRange } from "@/lib/risk/real-trading-config";

export const createRealTradingApprovalSchema = z.object({
  user_id: z.string().min(1),
  license_id: z.string().min(1),
  account_login: z.string().min(1).max(64),
  account_server: z.string().min(1).max(128),
  symbol: z.string().min(1).max(32),
  magic_number: z.number().int().positive(),
  max_contracts: z.number().int().min(1).max(100).default(1),
  min_free_margin: z.number().nonnegative().optional(),
  margin_buffer_percent: z.number().min(0).max(100).default(10),
  notes: z.string().max(2000).optional(),
  approve_immediately: z.boolean().default(false),
});

export type CreateRealTradingApprovalInput = z.infer<
  typeof createRealTradingApprovalSchema
>;

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

  const status = input.approve_immediately
    ? RealTradingApprovalStatus.APPROVED
    : RealTradingApprovalStatus.PENDING;

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
      allowReal: input.approve_immediately,
      status,
      approvedByAdminId: input.approve_immediately ? input.actorId : undefined,
      approvedAt: input.approve_immediately ? new Date() : undefined,
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
      licenseId: input.license_id,
      status,
      magicNumber: input.magic_number,
    },
  });

  return approval;
}

export async function listRealTradingApprovals(
  take = 50
): Promise<Prisma.RealTradingApprovalGetPayload<{ include: { user: { select: { email: true } } } }>[]> {
  return prisma.realTradingApproval.findMany({
    take,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { email: true } },
    },
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
      license: { select: { id: true } },
      instruction: { select: { id: true, symbol: true } },
    },
  });
}
