#!/usr/bin/env npx tsx
/**
 * Smoke seguro: roda preview de elegibilidade sem execute.
 * Não cria instruction REAL — apenas persiste batch PREVIEW_READY.
 */
import prisma from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { previewRealManualBulkDispatch } from "@/lib/admin/real-manual-bulk-dispatch";
import { createDefaultManagementPlan } from "@/lib/admin/real-manual-management-plan";

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: { in: [UserRole.SUPERADMIN, UserRole.OPS] } },
    select: { id: true, email: true },
  });
  if (!admin) {
    console.error("Nenhum admin encontrado para smoke.");
    process.exit(1);
  }

  const plan = createDefaultManagementPlan();
  plan.initialStopLoss = 5640;
  plan.takes[0] = {
    label: "T1",
    enabled: true,
    price: 5655,
    quantity: 1,
  };
  plan.takes[1].enabled = false;

  const result = await previewRealManualBulkDispatch({
    actorId: admin.id,
    body: {
      symbol: "WDON26",
      side: "BUY",
      orderType: "LIMIT",
      orderPrice: 5650,
      requestedContracts: 1,
      managementPlan: plan,
    },
  });

  console.log(JSON.stringify({
    smoke: "live_market_preview_only",
    admin: admin.email,
    batchPreviewId: result.batchPreviewId,
    operationalMode: result.operationalMode,
    summary: result.summary,
    topBlockedReasons: result.blocked
      .slice(0, 5)
      .map((b) => ({ licenseId: b.licenseId, reasonCode: b.reasonCode })),
    eligibleSample: result.eligible.slice(0, 3).map((e) => e.licenseId),
    note: "Execute NÃO foi acionado — preview apenas.",
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
