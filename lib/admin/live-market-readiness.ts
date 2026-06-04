import {
  AccountSnapshotType,
  InstructionSource,
  LicenseStatus,
  OrderLogStatus,
  RealManualBulkDispatchBatchStatus,
  RealTradingApprovalStatus,
  TradeMode,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { ACTIVE_DEVICE_WHERE } from "@/lib/licensing/device-lifecycle";
import { LIVE_MARKET_OPERATIONAL_MODE } from "@/lib/admin/live-market-operational-mode";
import {
  isAutoDispatchEnabled,
  eaOnlineThresholdMs,
} from "@/lib/risk/real-trading-config";
import { isRealTradingEnabled } from "@/lib/risk/real-trading-guard";
import { hasUnresolvedProtectionBlock } from "@/lib/risk/execution-protection";

const OPEN_REAL_INSTRUCTION_STATUSES: OrderLogStatus[] = [
  OrderLogStatus.RECEIVED,
  OrderLogStatus.SENT,
  OrderLogStatus.EXECUTED,
  OrderLogStatus.REJECTED,
];

function startOfUtcDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export type LiveMarketReadinessSnapshot = {
  operationalMode: typeof LIVE_MARKET_OPERATIONAL_MODE;
  enableRealTrading: boolean;
  enableAutoDispatch: boolean;
  totalCandidates: number;
  devicesActiveReal: number;
  easOnline: number;
  preMarketValidToday: number;
  approvalsValid: number;
  protectionBlockingCount: number;
  openRealInstructions: number;
  lastPreviewBatchId: string | null;
  lastPreviewExpiresAt: string | null;
  lastPreviewEligibleCount: number | null;
  lastPreviewBlockedCount: number | null;
  eaRealOrderSendConfigNote: string;
};

export async function getLiveMarketReadinessSnapshot(): Promise<LiveMarketReadinessSnapshot> {
  const now = new Date();
  const threshold = new Date(now.getTime() - eaOnlineThresholdMs());
  const dayStart = startOfUtcDay();

  const licenses = await prisma.license.findMany({
    where: { subscriptionId: { not: null }, status: LicenseStatus.ACTIVE },
    select: { id: true, expectedMagicNumber: true },
  });
  const licenseIds = licenses.map((l) => l.id);

  const [devicesActiveReal, easOnline, preMarketValidToday, approvalsValid, openRealInstructions, lastPreview] =
    await Promise.all([
      prisma.device.count({
        where: {
          licenseId: { in: licenseIds },
          ...ACTIVE_DEVICE_WHERE,
          license: { expectedTradeMode: TradeMode.REAL },
        },
      }),
      prisma.eaHeartbeat.findMany({
        where: {
          licenseId: { in: licenseIds },
          receivedAt: { gte: threshold },
          eaStatus: "ONLINE",
          tradeMode: TradeMode.REAL,
        },
        distinct: ["licenseId"],
        select: { licenseId: true },
      }),
      prisma.accountSnapshot.findMany({
        where: {
          licenseId: { in: licenseIds },
          snapshotType: AccountSnapshotType.PRE_MARKET,
          environment: TradeMode.REAL,
          capturedAt: { gte: dayStart },
        },
        distinct: ["licenseId"],
        select: { licenseId: true },
      }),
      prisma.realTradingApproval.count({
        where: {
          licenseId: { in: licenseIds },
          status: RealTradingApprovalStatus.APPROVED,
          allowReal: true,
        },
      }),
      prisma.instruction.count({
        where: {
          licenseId: { in: licenseIds },
          source: InstructionSource.REAL_MANUAL,
          currentStatus: { in: OPEN_REAL_INSTRUCTION_STATUSES },
        },
      }),
      prisma.realManualBulkDispatchBatch.findFirst({
        where: { status: RealManualBulkDispatchBatchStatus.PREVIEW_READY },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          expiresAt: true,
          eligibleCount: true,
          blockedCount: true,
        },
      }),
    ]);

  let protectionBlockingCount = 0;
  for (const license of licenses) {
    if (license.expectedMagicNumber == null) continue;
    const blocked = await hasUnresolvedProtectionBlock(
      license.id,
      license.expectedMagicNumber
    );
    if (blocked) protectionBlockingCount += 1;
  }

  return {
    operationalMode: LIVE_MARKET_OPERATIONAL_MODE,
    enableRealTrading: isRealTradingEnabled(),
    enableAutoDispatch: isAutoDispatchEnabled(),
    totalCandidates: licenses.length,
    devicesActiveReal,
    easOnline: easOnline.length,
    preMarketValidToday: preMarketValidToday.length,
    approvalsValid,
    protectionBlockingCount,
    openRealInstructions,
    lastPreviewBatchId: lastPreview?.id ?? null,
    lastPreviewExpiresAt: lastPreview?.expiresAt.toISOString() ?? null,
    lastPreviewEligibleCount: lastPreview?.eligibleCount ?? null,
    lastPreviewBlockedCount: lastPreview?.blockedCount ?? null,
    eaRealOrderSendConfigNote:
      "A flag de envio de ordens reais no EA/MT5 é configurada no terminal do cliente (input InpAllowRealOrderSend). A plataforma não altera esse parâmetro remotamente.",
  };
}
