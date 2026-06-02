import { createHash } from "crypto";
import {
  InstructionOrderType,
  InstructionPurpose,
  InstructionSide,
  InstructionSource,
  OrderLogStatus,
  RealManualBulkDispatchBatchStatus,
  RealManualBulkDispatchItemStatus,
  RealTradePreflightSource,
} from "@prisma/client";
import { z } from "zod";
import { recordAdminAction } from "@/lib/admin/record-action";
import {
  deriveLegacyPricesFromPlan,
  managementPlanSchema,
  validateManagementPlan,
  type RealManualManagementPlan,
} from "@/lib/admin/real-manual-management-plan";
import {
  evaluateBulkLicenseEligibility,
  listBulkCandidateLicenseIds,
  type BulkOrderParams,
} from "@/lib/admin/real-manual-bulk-eligibility";
import {
  REAL_MANUAL_PREFLIGHT_MAX_AGE_MS,
  validateRealManualOrderFields,
} from "@/lib/admin/real-manual-dispatch-validation";
import prisma from "@/lib/prisma";
import { runRealTradePreflight } from "@/lib/risk/real-trade-preflight";
import { isAutoDispatchEnabled } from "@/lib/risk/real-trading-config";
import { isRealTradingEnabled } from "@/lib/risk/real-trading-guard";

export const BULK_PREVIEW_EXPIRY_MS = 5 * 60 * 1000;
export const BULK_DISPATCH_CONFIRM_PHRASE = "AUTORIZO DISPARO REAL EM LOTE";

export function bulkDispatchCountConfirmPhrase(count: number) {
  return `AUTORIZO DISPARO REAL EM LOTE PARA ${count} CLIENTES`;
}

export function hashManagementPlan(plan: RealManualManagementPlan): string {
  return createHash("sha256").update(JSON.stringify(plan)).digest("hex");
}

export function buildBulkInstructionIdempotencyKey(input: {
  batchId: string;
  licenseId: string;
  symbol: string;
  side: string;
  orderType: string;
  orderPrice?: number | null;
  managementPlanHash: string;
}) {
  const pricePart =
    input.orderPrice != null ? String(input.orderPrice) : "MARKET";
  return `bulk:${input.batchId}:${input.licenseId}:${input.symbol}:${input.side}:${input.orderType}:${pricePart}:${input.managementPlanHash}`;
}

export const bulkPreviewSchema = z.object({
  symbol: z.string().min(1).max(32),
  side: z.enum(["BUY", "SELL"]),
  orderType: z.enum(["MARKET", "LIMIT", "STOP"]),
  orderPrice: z.number().positive().optional(),
  requestedContracts: z.number().int().positive(),
  managementPlan: managementPlanSchema,
});

export const bulkExecuteSchema = z.object({
  batchPreviewId: z.string().min(1),
  selectedLicenseIds: z.array(z.string().min(1)).min(1),
  adminConfirmation: z.string().min(1),
  adminConfirmationCount: z.string().min(1),
});

export class RealManualBulkDispatchError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "RealManualBulkDispatchError";
  }
}

function mapEligibleToApi(
  row: Extract<
    Awaited<ReturnType<typeof evaluateBulkLicenseEligibility>>,
    { eligible: true }
  >
) {
  return {
    licenseId: row.licenseId,
    userId: row.userId,
    clientName: row.userName ?? row.userEmail,
    email: row.userEmail,
    accountLogin: row.accountLogin,
    accountServer: row.accountServer,
    symbol: row.symbol,
    magicNumber: row.magicNumber,
    requestedContracts: row.requestedContracts,
    maxContracts: row.maxContracts,
    freeMargin: row.freeMargin,
    eaOnline: row.eaOnline,
    deviceActiveReal: row.deviceActiveReal,
    heartbeatAt: row.heartbeatAt,
    approvalId: row.approvalId,
    accountSnapshotId: row.accountSnapshotId,
    status: "ELEGÍVEL" as const,
    links: {
      license: `/admin/licenses/${row.licenseId}`,
      approval: `/admin/real-trading/approvals/${row.approvalId}`,
      snapshots: "/admin/real-trading/snapshots",
      instructions: `/admin/real-trading/instructions?licenseId=${encodeURIComponent(row.licenseId)}`,
    },
  };
}

function mapBlockedToApi(
  row: Extract<
    Awaited<ReturnType<typeof evaluateBulkLicenseEligibility>>,
    { eligible: false }
  >
) {
  return {
    licenseId: row.licenseId,
    userId: row.userId,
    clientName: row.userName ?? row.userEmail,
    email: row.userEmail,
    accountLogin: row.accountLogin,
    accountServer: row.accountServer,
    expectedSymbol: row.symbol,
    magicNumber: row.magicNumber,
    reasonCode: row.reasonCode,
    reasonDetail: row.reasonDetail,
    actionHint: row.actionHint,
    links: row.regularizationLinks,
  };
}

function validateBulkOrderInput(
  input: z.infer<typeof bulkPreviewSchema>
): BulkOrderParams {
  if (isAutoDispatchEnabled()) {
    throw new RealManualBulkDispatchError(
      "Dispatch automático deve permanecer desativado.",
      "AUTO_DISPATCH_ENABLED",
      409
    );
  }
  if (!isRealTradingEnabled()) {
    throw new RealManualBulkDispatchError(
      "ENABLE_REAL_TRADING=false bloqueia preview em lote.",
      "REAL_TRADING_DISABLED",
      403
    );
  }

  const symbol = input.symbol.trim().toUpperCase();
  const planValidation = validateManagementPlan({
    plan: input.managementPlan,
    requestedContracts: input.requestedContracts,
    side: input.side,
    entryPrice: input.orderPrice ?? null,
  });
  if (planValidation) {
    throw new RealManualBulkDispatchError(
      planValidation.message,
      planValidation.code,
      400
    );
  }

  const { stopLossPrice, takeProfitPrice } = deriveLegacyPricesFromPlan(
    input.managementPlan
  );
  const orderValidation = validateRealManualOrderFields({
    orderType: input.orderType,
    orderPrice: input.orderPrice ?? null,
    stopLossPrice,
    takeProfitPrice,
  });
  if (orderValidation) {
    throw new RealManualBulkDispatchError(
      orderValidation.message,
      orderValidation.code,
      400
    );
  }

  return {
    symbol,
    side: input.side,
    orderType: input.orderType,
    orderPrice: input.orderPrice,
    requestedContracts: input.requestedContracts,
    managementPlan: input.managementPlan,
  };
}

export async function previewRealManualBulkDispatch(input: {
  actorId: string;
  body: z.infer<typeof bulkPreviewSchema>;
  ipAddress?: string | null;
}) {
  const order = validateBulkOrderInput(input.body);
  const managementPlanHash = hashManagementPlan(order.managementPlan);
  const licenseIds = await listBulkCandidateLicenseIds();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + BULK_PREVIEW_EXPIRY_MS);

  const eligible: ReturnType<typeof mapEligibleToApi>[] = [];
  const blocked: ReturnType<typeof mapBlockedToApi>[] = [];

  for (const licenseId of licenseIds) {
    const result = await evaluateBulkLicenseEligibility({ licenseId, order });
    if (result.eligible) {
      eligible.push(mapEligibleToApi(result));
    } else {
      blocked.push(mapBlockedToApi(result));
    }
  }

  const batch = await prisma.realManualBulkDispatchBatch.create({
    data: {
      createdByAdminId: input.actorId,
      status: RealManualBulkDispatchBatchStatus.PREVIEW_READY,
      symbol: order.symbol,
      side: order.side as InstructionSide,
      orderType: order.orderType as InstructionOrderType,
      orderPrice: order.orderPrice,
      requestedContracts: order.requestedContracts,
      managementPlan: order.managementPlan,
      managementPlanHash,
      eligibleCount: eligible.length,
      blockedCount: blocked.length,
      totalCandidates: licenseIds.length,
      expiresAt,
      items: {
        create: [
          ...eligible.map((row) => ({
            userId: row.userId,
            licenseId: row.licenseId,
            accountLogin: row.accountLogin,
            accountServer: row.accountServer,
            symbol: row.symbol,
            magicNumber: row.magicNumber,
            requestedContracts: row.requestedContracts,
            status: RealManualBulkDispatchItemStatus.ELIGIBLE,
            approvalId: row.approvalId,
            accountSnapshotId: row.accountSnapshotId,
            freeMargin: row.freeMargin,
            maxContracts: row.maxContracts,
            eaOnline: row.eaOnline,
            deviceActiveReal: row.deviceActiveReal,
            heartbeatAt: row.heartbeatAt ? new Date(row.heartbeatAt) : null,
          })),
          ...blocked.map((row) => ({
            userId: row.userId,
            licenseId: row.licenseId,
            accountLogin: row.accountLogin,
            accountServer: row.accountServer,
            symbol: row.expectedSymbol,
            magicNumber: row.magicNumber,
            requestedContracts: order.requestedContracts,
            status: RealManualBulkDispatchItemStatus.BLOCKED,
            reasonCode: row.reasonCode,
            reasonDetail: row.reasonDetail,
            actionHint: row.actionHint,
          })),
        ],
      },
    },
  });

  await recordAdminAction({
    actorId: input.actorId,
    action: "real_trading.bulk_dispatch_preview",
    targetType: "real_manual_bulk_dispatch_batch",
    targetId: batch.id,
    ipAddress: input.ipAddress,
    metadata: {
      symbol: order.symbol,
      side: order.side,
      orderType: order.orderType,
      eligibleCount: eligible.length,
      blockedCount: blocked.length,
      totalCandidates: licenseIds.length,
      expiresAt: expiresAt.toISOString(),
    },
  });

  return {
    batchPreviewId: batch.id,
    status: "PREVIEW_READY" as const,
    expiresAt: expiresAt.toISOString(),
    summary: {
      totalCandidates: licenseIds.length,
      eligibleCount: eligible.length,
      blockedCount: blocked.length,
    },
    eligible,
    blocked,
  };
}

async function createBulkRealManualInstruction(input: {
  batchId: string;
  licenseId: string;
  accountLogin: string;
  accountServer: string;
  symbol: string;
  side: "BUY" | "SELL";
  orderType: "MARKET" | "LIMIT" | "STOP";
  orderPrice?: number;
  managementPlan: RealManualManagementPlan;
  requestedContracts: number;
  magicNumber: number;
  preflightId: string;
  managementPlanHash: string;
}) {
  const { stopLossPrice, takeProfitPrice } = deriveLegacyPricesFromPlan(
    input.managementPlan
  );
  const now = new Date();
  const idempotencyKey = buildBulkInstructionIdempotencyKey({
    batchId: input.batchId,
    licenseId: input.licenseId,
    symbol: input.symbol,
    side: input.side,
    orderType: input.orderType,
    orderPrice: input.orderPrice ?? null,
    managementPlanHash: input.managementPlanHash,
  });

  const existing = await prisma.instruction.findUnique({
    where: { idempotencyKey },
    select: { id: true },
  });
  if (existing) {
    return { instructionId: existing.id, alreadyExists: true as const };
  }

  const instruction = await prisma.$transaction(async (tx) => {
    const created = await tx.instruction.create({
      data: {
        licenseId: input.licenseId,
        bulkBatchId: input.batchId,
        purpose: InstructionPurpose.ENTRY,
        symbol: input.symbol,
        side: input.side as InstructionSide,
        orderType: input.orderType as InstructionOrderType,
        orderPrice: input.orderPrice,
        stopLoss: stopLossPrice,
        takeProfit: takeProfitPrice,
        quantity: input.requestedContracts,
        idempotencyKey,
        requestId: `bulk-real-manual-${input.batchId.slice(0, 8)}`,
        expiresAt: new Date(now.getTime() + REAL_MANUAL_PREFLIGHT_MAX_AGE_MS),
        source: InstructionSource.REAL_MANUAL,
        currentStatus: OrderLogStatus.RECEIVED,
        magicNumber: input.magicNumber,
        accountLogin: input.accountLogin,
        accountServer: input.accountServer,
        requiresProtectionConfirmation: true,
        protectionBlocked: false,
        managementPlan: input.managementPlan,
      },
    });
    await tx.instructionStatusLog.create({
      data: {
        instructionId: created.id,
        status: OrderLogStatus.RECEIVED,
        message: "Instruction REAL_MANUAL criada via disparo em lote controlado.",
        metadata: {
          batchId: input.batchId,
          preflightId: input.preflightId,
          source: InstructionSource.REAL_MANUAL,
          protectionRequired: true,
          requiresProtectionConfirmation: true,
        },
      },
    });
    await tx.realTradePreflight.update({
      where: { id: input.preflightId },
      data: { instructionId: created.id },
    });
    return created;
  });

  return { instructionId: instruction.id, alreadyExists: false as const };
}

export async function executeRealManualBulkDispatch(input: {
  actorId: string;
  body: z.infer<typeof bulkExecuteSchema>;
  ipAddress?: string | null;
}) {
  if (isAutoDispatchEnabled()) {
    throw new RealManualBulkDispatchError(
      "Dispatch automático deve permanecer desativado.",
      "AUTO_DISPATCH_ENABLED",
      409
    );
  }
  if (!isRealTradingEnabled()) {
    throw new RealManualBulkDispatchError(
      "ENABLE_REAL_TRADING=false bloqueia execute em lote.",
      "REAL_TRADING_DISABLED",
      403
    );
  }

  if (input.body.adminConfirmation.trim() !== BULK_DISPATCH_CONFIRM_PHRASE) {
    throw new RealManualBulkDispatchError(
      `Confirmação inválida. Digite: ${BULK_DISPATCH_CONFIRM_PHRASE}`,
      "CONFIRMATION_MISMATCH",
      400
    );
  }

  const expectedCountPhrase = bulkDispatchCountConfirmPhrase(
    input.body.selectedLicenseIds.length
  );
  if (input.body.adminConfirmationCount.trim() !== expectedCountPhrase) {
    throw new RealManualBulkDispatchError(
      `Confirmação de contagem inválida. Digite: ${expectedCountPhrase}`,
      "CONFIRMATION_COUNT_MISMATCH",
      400
    );
  }

  const batch = await prisma.realManualBulkDispatchBatch.findUnique({
    where: { id: input.body.batchPreviewId },
    include: { items: true },
  });

  if (!batch) {
    throw new RealManualBulkDispatchError("Preview não encontrado.", "BATCH_NOT_FOUND", 404);
  }

  const now = new Date();
  if (batch.expiresAt.getTime() < now.getTime()) {
    await prisma.realManualBulkDispatchBatch.update({
      where: { id: batch.id },
      data: { status: RealManualBulkDispatchBatchStatus.EXPIRED },
    });
    throw new RealManualBulkDispatchError(
      "Preview expirado. Execute nova validação.",
      "PREVIEW_EXPIRED",
      409
    );
  }

  if (batch.status !== RealManualBulkDispatchBatchStatus.PREVIEW_READY) {
    throw new RealManualBulkDispatchError(
      "Preview não está disponível para execute.",
      "BATCH_STATUS_INVALID",
      409
    );
  }

  const eligibleIds = new Set(
    batch.items
      .filter((i) => i.status === RealManualBulkDispatchItemStatus.ELIGIBLE)
      .map((i) => i.licenseId)
  );

  for (const licenseId of input.body.selectedLicenseIds) {
    if (!eligibleIds.has(licenseId)) {
      throw new RealManualBulkDispatchError(
        "selectedLicenseIds contém licença não elegível no preview.",
        "SELECTED_NOT_ELIGIBLE",
        400
      );
    }
  }

  const order: BulkOrderParams = {
    symbol: batch.symbol,
    side: batch.side as "BUY" | "SELL",
    orderType: batch.orderType as "MARKET" | "LIMIT" | "STOP",
    orderPrice: batch.orderPrice != null ? Number(batch.orderPrice) : undefined,
    requestedContracts: batch.requestedContracts,
    managementPlan: batch.managementPlan as RealManualManagementPlan,
  };

  await prisma.realManualBulkDispatchBatch.update({
    where: { id: batch.id },
    data: { status: RealManualBulkDispatchBatchStatus.EXECUTING },
  });

  const reportItems: Array<{
    licenseId: string;
    status: string;
    instructionId?: string;
    preflightId?: string;
    reasonCode?: string;
    actionHint?: string;
  }> = [];

  let dispatched = 0;
  let skipped = 0;
  let failed = 0;

  for (const licenseId of input.body.selectedLicenseIds) {
    const item = batch.items.find((i) => i.licenseId === licenseId);
    if (!item) {
      skipped += 1;
      reportItems.push({ licenseId, status: "SKIPPED" });
      continue;
    }

    const existingDispatched = await prisma.realManualBulkDispatchItem.findFirst({
      where: {
        batchId: batch.id,
        licenseId,
        status: RealManualBulkDispatchItemStatus.DISPATCHED,
        instructionId: { not: null },
      },
    });
    if (existingDispatched?.instructionId) {
      dispatched += 1;
      reportItems.push({
        licenseId,
        status: "DISPATCHED",
        instructionId: existingDispatched.instructionId,
        preflightId: existingDispatched.preflightId ?? undefined,
      });
      continue;
    }

    const eligibility = await evaluateBulkLicenseEligibility({ licenseId, order });
    if (!eligibility.eligible) {
      skipped += 1;
      await prisma.realManualBulkDispatchItem.update({
        where: { id: item.id },
        data: {
          status: RealManualBulkDispatchItemStatus.BLOCKED_AT_EXECUTE,
          reasonCode: eligibility.reasonCode,
          reasonDetail: eligibility.reasonDetail,
          actionHint: eligibility.actionHint,
        },
      });
      reportItems.push({
        licenseId,
        status: "BLOCKED_AT_EXECUTE",
        reasonCode: eligibility.reasonCode,
        actionHint: eligibility.actionHint,
      });
      continue;
    }

    const preflight = await runRealTradePreflight({
      userId: eligibility.userId,
      licenseId: eligibility.licenseId,
      accountLogin: eligibility.accountLogin,
      accountServer: eligibility.accountServer,
      symbol: eligibility.symbol,
      magicNumber: eligibility.magicNumber,
      requestedContracts: eligibility.requestedContracts,
      dryRun: true,
      persist: true,
    });

    if (!preflight.passed || !preflight.preflightId) {
      failed += 1;
      await prisma.realManualBulkDispatchItem.update({
        where: { id: item.id },
        data: {
          status: RealManualBulkDispatchItemStatus.FAILED,
          reasonCode: "PREFLIGHT_FAILED",
          reasonDetail: preflight.reason ?? "Preflight falhou no execute.",
        },
      });
      reportItems.push({
        licenseId,
        status: "FAILED",
        reasonCode: "PREFLIGHT_FAILED",
      });
      continue;
    }

    await prisma.realTradePreflight.update({
      where: { id: preflight.preflightId },
      data: { source: RealTradePreflightSource.BULK_DISPATCH },
    });

    try {
      const created = await createBulkRealManualInstruction({
        batchId: batch.id,
        licenseId: eligibility.licenseId,
        accountLogin: eligibility.accountLogin,
        accountServer: eligibility.accountServer,
        symbol: eligibility.symbol,
        side: order.side,
        orderType: order.orderType,
        orderPrice: order.orderPrice,
        managementPlan: order.managementPlan,
        requestedContracts: eligibility.requestedContracts,
        magicNumber: eligibility.magicNumber,
        preflightId: preflight.preflightId,
        managementPlanHash: batch.managementPlanHash,
      });

      dispatched += 1;
      await prisma.realManualBulkDispatchItem.update({
        where: { id: item.id },
        data: {
          status: RealManualBulkDispatchItemStatus.DISPATCHED,
          preflightId: preflight.preflightId,
          instructionId: created.instructionId,
        },
      });
      reportItems.push({
        licenseId,
        status: "DISPATCHED",
        instructionId: created.instructionId,
        preflightId: preflight.preflightId,
      });
    } catch (error) {
      failed += 1;
      await prisma.realManualBulkDispatchItem.update({
        where: { id: item.id },
        data: {
          status: RealManualBulkDispatchItemStatus.FAILED,
          reasonCode: "INSTRUCTION_CREATE_FAILED",
          reasonDetail: error instanceof Error ? error.message : "Falha desconhecida.",
        },
      });
      reportItems.push({
        licenseId,
        status: "FAILED",
        reasonCode: "INSTRUCTION_CREATE_FAILED",
      });
    }
  }

  const finalStatus =
    failed > 0 && dispatched > 0
      ? RealManualBulkDispatchBatchStatus.PARTIAL
      : RealManualBulkDispatchBatchStatus.EXECUTED;

  await prisma.realManualBulkDispatchBatch.update({
    where: { id: batch.id },
    data: { status: finalStatus },
  });

  await recordAdminAction({
    actorId: input.actorId,
    action: "real_trading.bulk_dispatch_execute",
    targetType: "real_manual_bulk_dispatch_batch",
    targetId: batch.id,
    ipAddress: input.ipAddress,
    metadata: {
      selected: input.body.selectedLicenseIds.length,
      dispatched,
      skipped,
      failed,
    },
  });

  return {
    batchId: batch.id,
    status: finalStatus,
    summary: {
      selected: input.body.selectedLicenseIds.length,
      dispatched,
      skipped,
      failed,
    },
    items: reportItems,
  };
}

export async function getRealManualBulkDispatchBatchDetail(batchId: string) {
  return prisma.realManualBulkDispatchBatch.findUnique({
    where: { id: batchId },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      createdByAdmin: { select: { email: true, name: true } },
      instructions: {
        select: {
          id: true,
          licenseId: true,
          currentStatus: true,
          createdAt: true,
        },
      },
    },
  });
}
