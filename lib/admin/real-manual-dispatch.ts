import {
  InstructionOrderType,
  InstructionPurpose,
  InstructionSide,
  InstructionSource,
  OrderLogStatus,
  RealTradePreflightSource,
  RealTradePreflightStatus,
  TradeMode,
} from "@prisma/client";
import { randomBytes } from "crypto";
import { z } from "zod";
import { recordAdminAction } from "@/lib/admin/record-action";
import { ACTIVE_DEVICE_WHERE } from "@/lib/licensing/device-lifecycle";
import prisma from "@/lib/prisma";
import { hasUnresolvedProtectionBlock } from "@/lib/risk/execution-protection";
import {
  findActiveRealTradingApproval,
  hasPreMarketSnapshotToday,
  isEaExecutorOnline,
} from "@/lib/risk/real-trade-preflight";
import { isAutoDispatchEnabled } from "@/lib/risk/real-trading-config";

export const FIRST_REAL_DISPATCH_CONFIRM_PHRASE =
  "AUTORIZO PRIMEIRA ORDEM REAL";
const PREFLIGHT_MAX_AGE_MS = 15 * 60 * 1000;

export const createRealManualDispatchSchema = z.object({
  preflightId: z.string().min(1),
  licenseId: z.string().min(1),
  accountLogin: z.string().min(1).max(64),
  accountServer: z.string().min(1).max(128),
  symbol: z.string().min(1).max(32),
  side: z.enum(["BUY", "SELL"]),
  orderType: z.enum(["MARKET", "LIMIT", "STOP"]),
  orderPrice: z.number().positive().optional(),
  requestedContracts: z.number().int().positive(),
  magicNumber: z.number().int().positive(),
  adminConfirmation: z.string().min(1),
});

export class RealManualDispatchError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "RealManualDispatchError";
  }
}

function buildIdempotencyKey() {
  return `real-manual-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

export async function createFirstRealManualInstruction(input: {
  actorId: string;
  preflightId: string;
  licenseId: string;
  accountLogin: string;
  accountServer: string;
  symbol: string;
  side: "BUY" | "SELL";
  orderType: "MARKET" | "LIMIT" | "STOP";
  orderPrice?: number;
  requestedContracts: number;
  magicNumber: number;
  adminConfirmation: string;
  ipAddress?: string | null;
}) {
  if (input.adminConfirmation.trim() !== FIRST_REAL_DISPATCH_CONFIRM_PHRASE) {
    throw new RealManualDispatchError(
      `Confirmação inválida. Digite: ${FIRST_REAL_DISPATCH_CONFIRM_PHRASE}`,
      "CONFIRMATION_MISMATCH",
      400
    );
  }

  if (input.requestedContracts > 1) {
    throw new RealManualDispatchError(
      "Nesta fase, requestedContracts máximo é 1.",
      "CONTRACT_LIMIT_EXCEEDED",
      400
    );
  }

  if (input.orderType === "MARKET" && input.orderPrice != null) {
    throw new RealManualDispatchError(
      "Ordem a mercado não deve conter preço de apregoamento.",
      "ORDER_PRICE_NOT_ALLOWED_FOR_MARKET",
      400
    );
  }
  if ((input.orderType === "LIMIT" || input.orderType === "STOP") && input.orderPrice == null) {
    throw new RealManualDispatchError(
      "Informe o preço de apregoamento para ordens LIMIT ou STOP.",
      "ORDER_PRICE_REQUIRED_FOR_PENDING_ORDER",
      400
    );
  }
  if (input.orderPrice != null && (!Number.isFinite(input.orderPrice) || input.orderPrice <= 0)) {
    throw new RealManualDispatchError(
      "Preço de apregoamento inválido.",
      "ORDER_PRICE_INVALID",
      400
    );
  }

  if (isAutoDispatchEnabled()) {
    throw new RealManualDispatchError(
      "Dispatch automático deve permanecer desativado para conta real.",
      "AUTO_DISPATCH_DISABLED",
      409
    );
  }

  const now = new Date();
  const preflight = await prisma.realTradePreflight.findUnique({
    where: { id: input.preflightId },
    include: {
      license: { select: { id: true, userId: true, status: true, mt5Account: true } },
    },
  });

  if (!preflight) {
    throw new RealManualDispatchError("Preflight não encontrado.", "PREFLIGHT_NOT_FOUND", 404);
  }
  if (preflight.source !== RealTradePreflightSource.DRY_RUN) {
    throw new RealManualDispatchError(
      "Preflight deve ser de origem DRY_RUN.",
      "PREFLIGHT_SOURCE_INVALID",
      400
    );
  }
  if (preflight.status !== RealTradePreflightStatus.PASSED) {
    throw new RealManualDispatchError(
      "Preflight precisa estar PASSED.",
      "PREFLIGHT_NOT_PASSED",
      400
    );
  }
  if (now.getTime() - preflight.createdAt.getTime() > PREFLIGHT_MAX_AGE_MS) {
    throw new RealManualDispatchError(
      "Preflight expirado. Execute novo dry-run.",
      "PREFLIGHT_EXPIRED",
      400
    );
  }

  const symbol = input.symbol.trim().toUpperCase();
  const accountLogin = input.accountLogin.trim();
  const accountServer = input.accountServer.trim();

  if (
    preflight.licenseId !== input.licenseId ||
    preflight.accountLogin !== accountLogin ||
    preflight.accountServer !== accountServer ||
    preflight.symbol !== symbol ||
    preflight.magicNumber !== input.magicNumber ||
    preflight.requestedContracts !== input.requestedContracts
  ) {
    throw new RealManualDispatchError(
      "Payload diverge do preflight PASSED.",
      "PREFLIGHT_PAYLOAD_MISMATCH",
      400
    );
  }

  const license = preflight.license;
  if (!license || license.id !== input.licenseId) {
    throw new RealManualDispatchError("Licença inválida.", "LICENSE_NOT_FOUND", 404);
  }

  const approval = await findActiveRealTradingApproval(
    input.licenseId,
    license.userId,
    accountLogin,
    accountServer,
    symbol,
    input.magicNumber
  );
  if (!approval) {
    throw new RealManualDispatchError(
      "RealTradingApproval APPROVED obrigatório.",
      "APPROVAL_REQUIRED",
      403
    );
  }

  const preMarket = await hasPreMarketSnapshotToday(
    input.licenseId,
    accountLogin,
    accountServer
  );
  if (!preMarket.ok) {
    throw new RealManualDispatchError(
      "Snapshot PRE_MARKET REAL do dia é obrigatório.",
      "SNAPSHOT_REQUIRED",
      403
    );
  }

  const eaOnline = await isEaExecutorOnline(input.licenseId);
  if (!eaOnline) {
    throw new RealManualDispatchError(
      "EA offline. Não é possível criar a primeira ordem real.",
      "EXECUTOR_OFFLINE",
      403
    );
  }

  const latestHb = await prisma.eaHeartbeat.findFirst({
    where: { licenseId: input.licenseId },
    orderBy: { receivedAt: "desc" },
    select: { tradeMode: true, deviceId: true },
  });
  if (latestHb?.tradeMode !== TradeMode.REAL) {
    throw new RealManualDispatchError(
      "Device precisa estar em tradeMode REAL.",
      "DEVICE_NOT_REAL",
      403
    );
  }
  const activeDevice = await prisma.device.findFirst({
    where: {
      licenseId: input.licenseId,
      deviceId: latestHb.deviceId,
      ...ACTIVE_DEVICE_WHERE,
    },
    select: { id: true },
  });
  if (!activeDevice) {
    throw new RealManualDispatchError(
      "Device precisa estar ACTIVE para dispatch real manual.",
      "DEVICE_NOT_ACTIVE",
      403
    );
  }

  const blockedProtection = await hasUnresolvedProtectionBlock(
    input.licenseId,
    input.magicNumber
  );
  if (blockedProtection) {
    throw new RealManualDispatchError(
      "Há falha de proteção pendente para este magic.",
      "PREVIOUS_PROTECTION_FAILED",
      403
    );
  }

  const instruction = await prisma.$transaction(async (tx) => {
    const created = await tx.instruction.create({
      data: {
        licenseId: input.licenseId,
        purpose: InstructionPurpose.ENTRY,
        symbol,
        side: input.side as InstructionSide,
        orderType: input.orderType as InstructionOrderType,
        orderPrice: input.orderPrice,
        quantity: input.requestedContracts,
        idempotencyKey: buildIdempotencyKey(),
        requestId: `real-manual-${input.actorId.slice(0, 8)}`,
        expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
        source: InstructionSource.REAL_MANUAL,
        currentStatus: OrderLogStatus.RECEIVED,
        magicNumber: input.magicNumber,
        accountLogin,
        accountServer,
        requiresProtectionConfirmation: true,
        protectionBlocked: false,
      },
    });
    await tx.instructionStatusLog.create({
      data: {
        instructionId: created.id,
        status: OrderLogStatus.RECEIVED,
        message: "Instruction REAL_MANUAL criada via dispatch manual controlado.",
        metadata: {
          preflightId: preflight.id,
          source: InstructionSource.REAL_MANUAL,
          requestedContracts: input.requestedContracts,
          orderType: input.orderType,
          orderPrice: input.orderPrice ?? null,
        },
      },
    });
    return created;
  });

  await recordAdminAction({
    actorId: input.actorId,
    action: "real_trading.dispatch_manual_created",
    targetType: "instruction",
    targetId: instruction.id,
    ipAddress: input.ipAddress,
    metadata: {
      source: "REAL_MANUAL",
      preflightId: preflight.id,
      licenseId: input.licenseId,
      accountLogin,
      accountServer,
      symbol,
      side: input.side,
      orderType: input.orderType,
      orderPrice: input.orderPrice ?? null,
      requestedContracts: input.requestedContracts,
      magicNumber: input.magicNumber,
      protectionRequired: true,
      requiresProtectionConfirmation: true,
    },
  });

  return {
    ok: true as const,
    instructionId: instruction.id,
    source: instruction.source,
    status: instruction.currentStatus,
    message:
      "Instruction REAL manual criada. O EA poderá buscá-la via GET /api/v1/ea/instructions.",
  };
}
