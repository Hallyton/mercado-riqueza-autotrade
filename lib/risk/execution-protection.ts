import {
  AuditActorType,
  OrderLogStatus,
  ProtectionStatus,
  TradeMode,
} from "@prisma/client";
import { createAuditLog } from "@/lib/audit/log";
import { recordAdminAction } from "@/lib/admin/record-action";
import prisma from "@/lib/prisma";
import { redactSensitiveMessage } from "@/lib/risk/redact-message";
import type { EaAuthContext } from "@/lib/ea/auth";

const INSTRUCTION_STATUSES_EXCLUDING_PROTECTION_BLOCK: OrderLogStatus[] = [
  OrderLogStatus.VOIDED_FALSE_EXECUTION,
  OrderLogStatus.ORDER_NOT_PLACED,
  OrderLogStatus.CANCELLED,
  OrderLogStatus.IGNORED,
];

export type ExecutionProtectionInput = {
  instruction_id: string;
  execution_id?: string;
  account_login: string;
  account_server: string;
  symbol: string;
  magic_number: number;
  entry_order_ticket?: string;
  entry_deal_ticket?: string;
  stop_loss_present: boolean;
  take_profit_present: boolean;
  stop_loss_price?: number;
  take_profit_price?: number;
  stop_order_ticket?: string;
  take_order_ticket?: string;
  protection_mode: "ATTACHED_SL_TP" | "PENDING_PROTECTION_ORDERS" | "UNKNOWN";
  protection_status:
    | "PROTECTION_CONFIRMED"
    | "PROTECTION_FAILED"
    | "PROTECTION_PENDING"
    | "NOT_REQUIRED_FOR_DEBUG";
  error_code?: string;
  error_message?: string;
  reported_at?: string;
};

const BLOCKING_STATUSES: ProtectionStatus[] = [
  ProtectionStatus.PROTECTION_FAILED,
  ProtectionStatus.PROTECTION_PENDING,
];

export async function hasPendingProtectionForMagic(
  licenseId: string,
  magicNumber: number
): Promise<boolean> {
  const pending = await prisma.executionProtectionReport.findFirst({
    where: {
      licenseId,
      magicNumber,
      protectionStatus: ProtectionStatus.PROTECTION_PENDING,
      instruction: {
        currentStatus: { notIn: INSTRUCTION_STATUSES_EXCLUDING_PROTECTION_BLOCK },
      },
    },
    orderBy: { reportedAt: "desc" },
  });
  return Boolean(pending);
}

export async function hasUnresolvedProtectionBlock(
  licenseId: string,
  magicNumber: number
): Promise<boolean> {
  const blockedInstruction = await prisma.instruction.findFirst({
    where: {
      licenseId,
      magicNumber,
      protectionBlocked: true,
      currentStatus: { notIn: INSTRUCTION_STATUSES_EXCLUDING_PROTECTION_BLOCK },
    },
  });
  if (blockedInstruction) return true;

  const recentFail = await prisma.executionProtectionReport.findFirst({
    where: {
      licenseId,
      magicNumber,
      protectionStatus: { in: BLOCKING_STATUSES },
      instruction: {
        currentStatus: { notIn: INSTRUCTION_STATUSES_EXCLUDING_PROTECTION_BLOCK },
      },
    },
    orderBy: { reportedAt: "desc" },
  });
  return Boolean(recentFail);
}

export async function reportExecutionProtection(
  ctx: EaAuthContext,
  body: ExecutionProtectionInput,
  options?: { tradeMode?: TradeMode | null }
) {
  const instruction = await prisma.instruction.findFirst({
    where: { id: body.instruction_id, licenseId: ctx.license.id },
  });
  if (!instruction) {
    return { ok: false as const, code: "INSTRUCTION_NOT_FOUND" };
  }

  const tradeMode =
    options?.tradeMode ??
    (
      await prisma.eaHeartbeat.findFirst({
        where: { licenseId: ctx.license.id },
        orderBy: { receivedAt: "desc" },
        select: { tradeMode: true },
      })
    )?.tradeMode ??
    null;

  const isReal = tradeMode === TradeMode.REAL;
  const protectionStatus = body.protection_status as ProtectionStatus;

  if (isReal) {
    if (!body.magic_number) {
      return { ok: false as const, code: "MAGIC_NUMBER_REQUIRED" };
    }
    const slMissing = !body.stop_loss_present;
    const tpMissing = !body.take_profit_present;
    if (slMissing || tpMissing) {
      if (protectionStatus !== ProtectionStatus.PROTECTION_FAILED) {
        return {
          ok: false as const,
          code: "PROTECTION_INCOMPLETE",
          message: "Conta real exige stop e take confirmados.",
        };
      }
    }
    if (
      protectionStatus === ProtectionStatus.PROTECTION_CONFIRMED &&
      body.protection_mode === "ATTACHED_SL_TP"
    ) {
      const slValid =
        body.stop_loss_present &&
        (body.stop_loss_price != null || Boolean(body.stop_order_ticket?.trim()));
      const tpValid =
        body.take_profit_present &&
        (body.take_profit_price != null || Boolean(body.take_order_ticket?.trim()));
      if (!slValid || !tpValid) {
        return {
          ok: false as const,
          code: "PROTECTION_INCOMPLETE",
          message: "Stop/take exigem preço ou ticket válido em conta real.",
        };
      }
    }
  }

  const report = await prisma.executionProtectionReport.create({
    data: {
      instructionId: instruction.id,
      executionId: body.execution_id,
      licenseId: ctx.license.id,
      accountLogin: body.account_login.trim(),
      accountServer: body.account_server.trim(),
      symbol: body.symbol.trim().toUpperCase(),
      magicNumber: body.magic_number,
      entryOrderTicket: body.entry_order_ticket,
      entryDealTicket: body.entry_deal_ticket,
      stopLossPresent: body.stop_loss_present,
      takeProfitPresent: body.take_profit_present,
      stopLossPrice: body.stop_loss_price,
      takeProfitPrice: body.take_profit_price,
      stopOrderTicket: body.stop_order_ticket,
      takeOrderTicket: body.take_order_ticket,
      protectionMode: body.protection_mode,
      protectionStatus,
      errorCode: body.error_code,
      errorMessageRedacted: redactSensitiveMessage(body.error_message),
      reportedAt: body.reported_at ? new Date(body.reported_at) : new Date(),
    },
  });

  const confirmed =
    protectionStatus === ProtectionStatus.PROTECTION_CONFIRMED ||
    protectionStatus === ProtectionStatus.NOT_REQUIRED_FOR_DEBUG;

  if (isReal && !confirmed) {
    await prisma.instruction.update({
      where: { id: instruction.id },
      data: { protectionBlocked: true, currentStatus: OrderLogStatus.REJECTED },
    });
    await prisma.instructionStatusLog.create({
      data: {
        instructionId: instruction.id,
        status: OrderLogStatus.REJECTED,
        message: "Proteção stop/take não confirmada em conta real.",
        metadata: { code: "REAL_TRADING_PROTECTION_NOT_CONFIRMED" },
      },
    });
    await createAuditLog({
      actorType: AuditActorType.EA,
      actorId: ctx.license.userId,
      action: "real_trading.protection_failed",
      entityType: "instruction",
      entityId: instruction.id,
      requestId: ctx.requestId,
      metadata: {
        magicNumber: body.magic_number,
        protectionStatus,
        licenseId: ctx.license.id,
      },
    });
  } else if (confirmed) {
    await prisma.instruction.update({
      where: { id: instruction.id },
      data: { protectionBlocked: false },
    });
  }

  return { ok: true as const, reportId: report.id, protectionStatus };
}

export async function markProtectionPendingForRealExecution(
  instructionId: string,
  licenseId: string,
  magicNumber: number | null | undefined
) {
  if (!magicNumber) return;
  const pending = await prisma.executionProtectionReport.findFirst({
    where: {
      instructionId,
      protectionStatus: ProtectionStatus.PROTECTION_CONFIRMED,
    },
  });
  if (pending) return;

  const instruction = await prisma.instruction.findUnique({
    where: { id: instructionId },
    select: {
      requiresProtectionConfirmation: true,
      symbol: true,
      accountLogin: true,
      accountServer: true,
    },
  });
  if (!instruction?.requiresProtectionConfirmation) return;

  const hb = await prisma.eaHeartbeat.findFirst({
    where: { licenseId },
    orderBy: { receivedAt: "desc" },
    select: { tradeMode: true },
  });
  if (hb?.tradeMode !== TradeMode.REAL) return;

  await prisma.executionProtectionReport.create({
    data: {
      instructionId,
      licenseId,
      accountLogin: instruction.accountLogin ?? "",
      accountServer: instruction.accountServer ?? "",
      symbol: instruction.symbol,
      magicNumber,
      protectionMode: "UNKNOWN",
      protectionStatus: ProtectionStatus.PROTECTION_PENDING,
      stopLossPresent: false,
      takeProfitPresent: false,
      reportedAt: new Date(),
    },
  });
}

export async function clearProtectionBlockAdmin(
  instructionId: string,
  actorId: string,
  ipAddress?: string | null
) {
  await prisma.instruction.update({
    where: { id: instructionId },
    data: { protectionBlocked: false },
  });
  await recordAdminAction({
    actorId,
    action: "real_trading.clear_protection_block",
    targetType: "instruction",
    targetId: instructionId,
    ipAddress,
  });
}
