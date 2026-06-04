import prisma from "@/lib/prisma";
import { LIVE_MARKET_OPERATIONAL_MODE } from "@/lib/admin/live-market-operational-mode";
import {
  extractManagementEventsFromLogs,
  formatManagementPlanListSummary,
  parseManagementPlanFromJson,
} from "@/lib/admin/real-manual-management-plan";

export async function getBulkDispatchBatchLiveTracking(batchId: string) {
  const batch = await prisma.realManualBulkDispatchBatch.findUnique({
    where: { id: batchId },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      createdByAdmin: { select: { email: true, name: true } },
      instructions: {
        orderBy: { createdAt: "asc" },
        include: {
          executions: {
            orderBy: { executedAt: "desc" },
            take: 1,
            select: {
              id: true,
              status: true,
              executedAt: true,
              brokerTicket: true,
              errorCode: true,
            },
          },
          executionProtectionReports: {
            orderBy: { reportedAt: "desc" },
            take: 1,
            select: {
              id: true,
              protectionStatus: true,
              reportedAt: true,
              stopLossPresent: true,
              takeProfitPresent: true,
            },
          },
          statusLogs: { orderBy: { createdAt: "asc" } },
          license: { select: { user: { select: { email: true } } } },
        },
      },
    },
  });

  if (!batch) return null;

  const licenseIds = [...new Set(batch.instructions.map((i) => i.licenseId))];
  const heartbeats = await Promise.all(
    licenseIds.map(async (licenseId) => {
      const hb = await prisma.eaHeartbeat.findFirst({
        where: { licenseId },
        orderBy: { receivedAt: "desc" },
        select: {
          eaStatus: true,
          tradeMode: true,
          receivedAt: true,
        },
      });
      return [licenseId, hb] as const;
    })
  );
  const hbByLicense = new Map(heartbeats);

  const instructionTracking = batch.instructions.map((inst) => ({
    instructionId: inst.id,
    licenseId: inst.licenseId,
    clientEmail: inst.license.user.email,
    currentStatus: inst.currentStatus,
    operationalMode: inst.operationalMode ?? LIVE_MARKET_OPERATIONAL_MODE,
    bulkBatchId: inst.bulkBatchId,
    orderType: inst.orderType,
    managementPlanSummary: formatManagementPlanListSummary(
      parseManagementPlanFromJson(inst.managementPlan)
    ),
    latestExecution: inst.executions[0] ?? null,
    latestProtection: inst.executionProtectionReports[0] ?? null,
    managementEvents: extractManagementEventsFromLogs(inst.statusLogs).map((e) => ({
      event: e.event,
      at: e.createdAt.toISOString(),
    })),
    heartbeat: hbByLicense.get(inst.licenseId)
      ? {
          eaStatus: hbByLicense.get(inst.licenseId)!.eaStatus ?? "—",
          tradeMode: hbByLicense.get(inst.licenseId)!.tradeMode ?? "—",
          receivedAt:
            hbByLicense.get(inst.licenseId)!.receivedAt?.toISOString() ?? null,
        }
      : null,
    detailUrl: `/admin/real-trading/instructions/${inst.id}`,
  }));

  return {
    batch: {
      id: batch.id,
      status: batch.status,
      operationalMode: batch.operationalMode ?? LIVE_MARKET_OPERATIONAL_MODE,
      symbol: batch.symbol,
      side: batch.side,
      orderType: batch.orderType,
      orderPrice: batch.orderPrice != null ? Number(batch.orderPrice) : null,
      requestedContracts: batch.requestedContracts,
      managementPlan: batch.managementPlan,
      managementPlanSummary: formatManagementPlanListSummary(
        parseManagementPlanFromJson(batch.managementPlan)
      ),
      eligibleCount: batch.eligibleCount,
      blockedCount: batch.blockedCount,
      totalCandidates: batch.totalCandidates,
      expiresAt: batch.expiresAt.toISOString(),
      createdAt: batch.createdAt.toISOString(),
      createdBy: batch.createdByAdmin.email,
    },
    items: batch.items,
    instructionTracking,
    summary: {
      dispatched: batch.items.filter((i) => i.status === "DISPATCHED").length,
      blocked: batch.items.filter((i) => i.status === "BLOCKED").length,
      blockedAtExecute: batch.items.filter((i) => i.status === "BLOCKED_AT_EXECUTE")
        .length,
      skipped: batch.items.filter((i) => i.status === "SKIPPED").length,
      failed: batch.items.filter((i) => i.status === "FAILED").length,
    },
  };
}
