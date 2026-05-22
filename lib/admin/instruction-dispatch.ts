import {
  InstructionOrderType,
  InstructionPurpose,
  InstructionSide,
  InstructionSource,
  OrderLogStatus,
  type Prisma,
} from "@prisma/client";
import { z } from "zod";
import { recordAdminAction } from "@/lib/admin/record-action";
import { assertInstructionAllowed, LicensePolicyError } from "@/lib/licensing/instruction-policy";
import prisma from "@/lib/prisma";
import { randomBytes } from "crypto";

/** Campos SL/TP opcionais: ausente/vazio → omitido; se informado, deve ser > 0. */
export function normalizeOptionalPositiveNumber(value: unknown): unknown {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

const optionalPositiveNumber = z.preprocess(
  normalizeOptionalPositiveNumber,
  z.number().positive().optional()
);

export const createAdminInstructionSchema = z.object({
  license_id: z.string().min(1),
  source: z.enum(["TEST", "HOMOLOGATION"]),
  purpose: z.enum(["ENTRY", "EXIT", "ADJUSTMENT"]).default("ENTRY"),
  symbol: z.string().min(1).max(32),
  side: z.enum(["BUY", "SELL"]),
  order_type: z
    .enum(["MARKET", "LIMIT", "STOP", "STOP_LIMIT"])
    .default("MARKET"),
  quantity: z.number().positive(),
  stop_loss: optionalPositiveNumber,
  take_profit: optionalPositiveNumber,
  expires_in_minutes: z.number().int().min(5).max(1440).default(60),
  note: z.string().max(500).optional(),
});

export type CreateAdminInstructionInput = z.infer<
  typeof createAdminInstructionSchema
>;

export class AdminInstructionDispatchError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "AdminInstructionDispatchError";
  }
}

function buildIdempotencyKey(source: InstructionSource): string {
  return `admin-${source.toLowerCase()}-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

export async function createAdminDispatchedInstruction(
  input: CreateAdminInstructionInput & {
    actorId: string;
    ipAddress?: string | null;
  }
) {
  const license = await prisma.license.findUnique({
    where: { id: input.license_id },
    include: {
      user: { select: { email: true } },
      subscription: { include: { plan: true } },
    },
  });

  if (!license) {
    throw new AdminInstructionDispatchError(
      "Licença não encontrada",
      "LICENSE_NOT_FOUND",
      404
    );
  }

  const purpose = input.purpose as InstructionPurpose;
  try {
    await assertInstructionAllowed(license.id, purpose);
  } catch (e) {
    if (e instanceof LicensePolicyError) {
      throw new AdminInstructionDispatchError(
        e.message,
        e.code,
        403
      );
    }
    throw e;
  }

  const source = input.source as InstructionSource;
  const expiresAt = new Date(
    Date.now() + input.expires_in_minutes * 60 * 1000
  );

  const instruction = await prisma.$transaction(async (tx) => {
    const created = await tx.instruction.create({
      data: {
        licenseId: license.id,
        purpose,
        symbol: input.symbol.trim().toUpperCase(),
        side: input.side as InstructionSide,
        orderType: input.order_type as InstructionOrderType,
        quantity: input.quantity,
        stopLoss: input.stop_loss,
        takeProfit: input.take_profit,
        idempotencyKey: buildIdempotencyKey(source),
        requestId: `admin-dispatch-${input.actorId.slice(0, 8)}`,
        expiresAt,
        source,
        currentStatus: OrderLogStatus.RECEIVED,
      },
    });

    await tx.instructionStatusLog.create({
      data: {
        instructionId: created.id,
        status: OrderLogStatus.RECEIVED,
        message: `Instrução ${source} despachada pelo painel admin`,
        metadata: {
          source,
          note: input.note ?? null,
          actorId: input.actorId,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return created;
  });

  await recordAdminAction({
    actorId: input.actorId,
    action: "admin.instruction.dispatch",
    targetType: "instruction",
    targetId: instruction.id,
    ipAddress: input.ipAddress,
    auditEntityType: "instruction",
    metadata: {
      source,
      licenseId: license.id,
      clientEmail: license.user.email,
      purpose: input.purpose,
      symbol: instruction.symbol,
      side: input.side,
      order_type: input.order_type,
      quantity: input.quantity,
      expiresAt: expiresAt.toISOString(),
      note: input.note,
    },
  });

  return {
    instructionId: instruction.id,
    licenseId: license.id,
    source,
    currentStatus: instruction.currentStatus,
    expiresAt: expiresAt.toISOString(),
    clientEmail: license.user.email,
  };
}

export async function listAdminDispatchedInstructions(limit = 30) {
  return prisma.instruction.findMany({
    where: {
      source: { in: [InstructionSource.TEST, InstructionSource.HOMOLOGATION] },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      license: {
        include: {
          user: { select: { email: true } },
        },
      },
    },
  });
}

export async function listLicensesForInstructionDispatch() {
  return prisma.license.findMany({
    where: {
      status: { in: ["ACTIVE", "PENDING_ACTIVATION", "SUSPENDED"] },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      user: { select: { email: true } },
      mt5Account: { select: { login: true, server: true } },
    },
  });
}
