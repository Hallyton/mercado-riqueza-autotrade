import {
  AuditActorType,
  ExecutionStatus,
  InstructionPurpose,
  OrderLogStatus,
  type Prisma,
} from "@prisma/client";
import { createAuditLog } from "@/lib/audit/log";
import { assertInstructionAllowed, LicensePolicyError } from "@/lib/licensing/instruction-policy";
import { getLicenseOperationalFlags } from "@/lib/licensing/service";
import prisma from "@/lib/prisma";
import type { EaAuthContext } from "./auth";

export type EaInstructionPayload = {
  instruction_id: string;
  purpose: InstructionPurpose;
  symbol: string;
  side: string;
  order_type: string;
  quantity: number;
  stop_loss: number | null;
  take_profit: number | null;
  expires_at: string;
  idempotency_key: string;
};

function toNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (value == null) return null;
  return Number(value);
}

export function mapInstructionToEaPayload(
  instruction: {
    id: string;
    purpose: InstructionPurpose;
    symbol: string;
    side: string;
    orderType: string;
    quantity: Prisma.Decimal;
    stopLoss: Prisma.Decimal | null;
    takeProfit: Prisma.Decimal | null;
    expiresAt: Date;
    idempotencyKey: string;
  }
): EaInstructionPayload {
  return {
    instruction_id: instruction.id,
    purpose: instruction.purpose,
    symbol: instruction.symbol,
    side: instruction.side,
    order_type: instruction.orderType,
    quantity: Number(instruction.quantity),
    stop_loss: toNumber(instruction.stopLoss),
    take_profit: toNumber(instruction.takeProfit),
    expires_at: instruction.expiresAt.toISOString(),
    idempotency_key: instruction.idempotencyKey,
  };
}

async function appendStatus(
  instructionId: string,
  status: OrderLogStatus,
  message?: string,
  metadata?: Prisma.InputJsonValue
) {
  await prisma.$transaction([
    prisma.instruction.update({
      where: { id: instructionId },
      data: { currentStatus: status },
    }),
    prisma.instructionStatusLog.create({
      data: {
        instructionId,
        status,
        message,
        metadata,
      },
    }),
  ]);
}

export async function pullInstructionsForEa(ctx: EaAuthContext) {
  const now = new Date();
  const pending = await prisma.instruction.findMany({
    where: {
      licenseId: ctx.license.id,
      currentStatus: { in: [OrderLogStatus.RECEIVED, OrderLogStatus.SENT] },
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  const deliverable: EaInstructionPayload[] = [];

  for (const instruction of pending) {
    try {
      await assertInstructionAllowed(ctx.license.id, instruction.purpose);
    } catch (e) {
      if (e instanceof LicensePolicyError) {
        await appendStatus(
          instruction.id,
          OrderLogStatus.IGNORED,
          e.message,
          { code: e.code }
        );
        await createAuditLog({
          actorType: AuditActorType.EA,
          actorId: ctx.license.userId,
          action: "instruction.ignored",
          entityType: "instruction",
          entityId: instruction.id,
          requestId: ctx.requestId,
          metadata: { code: e.code, licenseId: ctx.license.id },
        });
        continue;
      }
      throw e;
    }

    if (instruction.currentStatus === OrderLogStatus.RECEIVED) {
      await appendStatus(instruction.id, OrderLogStatus.SENT, "Despachada ao EA");
    }

    deliverable.push(mapInstructionToEaPayload(instruction));
  }

  if (deliverable.length > 0) {
    await createAuditLog({
      actorType: AuditActorType.EA,
      actorId: ctx.license.userId,
      action: "ea.instructions_pulled",
      entityType: "license",
      entityId: ctx.license.id,
      requestId: ctx.requestId,
      metadata: { count: deliverable.length },
    });
  }

  return deliverable;
}

export async function reportExecution(
  ctx: EaAuthContext,
  body: {
    instruction_id: string;
    status: "FILLED" | "PARTIAL" | "REJECTED" | "EXPIRED";
    broker_ticket?: string;
    fill_price?: number;
    fill_quantity?: number;
    slippage?: number;
    error_code?: string;
    error_message?: string;
    executed_at?: string;
  }
) {
  const instruction = await prisma.instruction.findFirst({
    where: {
      id: body.instruction_id,
      licenseId: ctx.license.id,
    },
  });

  if (!instruction) {
    return { ok: false as const, code: "INSTRUCTION_NOT_FOUND" };
  }

  if (body.status === "FILLED" || body.status === "PARTIAL") {
    if (instruction.purpose === InstructionPurpose.ENTRY) {
      await assertInstructionAllowed(ctx.license.id, InstructionPurpose.ENTRY);
    } else {
      await assertInstructionAllowed(ctx.license.id, instruction.purpose);
    }
  }

  const orderStatus =
    body.status === "FILLED" || body.status === "PARTIAL"
      ? OrderLogStatus.EXECUTED
      : OrderLogStatus.REJECTED;

  await prisma.execution.create({
    data: {
      instructionId: instruction.id,
      licenseId: ctx.license.id,
      status: body.status as ExecutionStatus,
      brokerTicket: body.broker_ticket,
      fillPrice: body.fill_price,
      fillQuantity: body.fill_quantity,
      slippage: body.slippage,
      errorCode: body.error_code,
      errorMessage: body.error_message,
      executedAt: body.executed_at ? new Date(body.executed_at) : new Date(),
    },
  });

  await appendStatus(
    instruction.id,
    orderStatus,
    body.error_message ?? `Execução ${body.status}`
  );

  await createAuditLog({
    actorType: AuditActorType.EA,
    actorId: ctx.license.userId,
    action: "ea.execution_reported",
    entityType: "instruction",
    entityId: instruction.id,
    requestId: ctx.requestId,
    metadata: {
      status: body.status,
      brokerTicket: body.broker_ticket,
    },
  });

  return { ok: true as const, orderStatus };
}

export async function reportIgnored(
  ctx: EaAuthContext,
  instructionId: string,
  reason?: string
) {
  const instruction = await prisma.instruction.findFirst({
    where: { id: instructionId, licenseId: ctx.license.id },
  });
  if (!instruction) return { ok: false as const, code: "INSTRUCTION_NOT_FOUND" };

  await appendStatus(instruction.id, OrderLogStatus.IGNORED, reason);

  await createAuditLog({
    actorType: AuditActorType.EA,
    actorId: ctx.license.userId,
    action: "ea.instruction_ignored",
    entityType: "instruction",
    entityId: instruction.id,
    requestId: ctx.requestId,
    metadata: { reason },
  });

  return { ok: true as const };
}

export async function seedInstructionForLicense(
  licenseId: string,
  data: Partial<{
    purpose: InstructionPurpose;
    symbol: string;
    side: "BUY" | "SELL";
    quantity: number;
    status: OrderLogStatus;
  }>
) {
  const instruction = await prisma.instruction.create({
    data: {
      licenseId,
      purpose: data.purpose ?? InstructionPurpose.ENTRY,
      symbol: data.symbol ?? "PETR4",
      side: data.side ?? "BUY",
      orderType: "MARKET",
      quantity: data.quantity ?? 100,
      idempotencyKey: `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      expiresAt: new Date(Date.now() + 3600_000),
      currentStatus: data.status ?? OrderLogStatus.RECEIVED,
    },
  });

  await prisma.instructionStatusLog.create({
    data: {
      instructionId: instruction.id,
      status: instruction.currentStatus,
    },
  });

  return instruction;
}

export { getLicenseOperationalFlags };
