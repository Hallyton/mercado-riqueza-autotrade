/**
 * Ativa assinatura + licença para cliente de homologação (sem gateway real).
 */
import "./load-env";
import { SubscriptionStatus } from "@prisma/client";
import {
  assertHomologationNotProduction,
  normalizeEmail,
  requireEnv,
} from "./_utils";
import { activateSubscription } from "@/lib/licensing/service";
import prisma from "@/lib/prisma";

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

async function main() {
  assertHomologationNotProduction("create-active-subscription");

  const email = normalizeEmail(requireEnv("HOMOLOG_CLIENT_EMAIL"));
  const planSlug = requireEnv("HOMOLOG_PLAN_SLUG").toLowerCase();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(
      `[homologation] Cliente não encontrado: ${email}. Execute npm run homolog:create-client primeiro.`
    );
    process.exit(1);
  }

  const plan = await prisma.plan.findUnique({ where: { slug: planSlug } });
  if (!plan) {
    console.error(
      `[homologation] Plano não encontrado: ${planSlug}. Rode o seed (start, pro, black).`
    );
    process.exit(1);
  }

  let subscription = await prisma.subscription.findFirst({
    where: { userId: user.id, planId: plan.id },
    orderBy: { createdAt: "desc" },
    include: { licenses: true },
  });

  if (!subscription) {
    subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        status: SubscriptionStatus.INCOMPLETE,
        gateway: "manual",
      },
      include: { licenses: true },
    });
    console.log(`[homologation] Assinatura criada (INCOMPLETE): ${subscription.id}`);
  } else {
    console.log(`[homologation] Assinatura existente reutilizada: ${subscription.id}`);
  }

  const now = new Date();
  const periodEnd = addMonths(now, 2);

  const activated = await activateSubscription(
    subscription.id,
    { start: now, end: periodEnd },
    { gateway: "manual", gatewaySubscriptionId: `homolog-${subscription.id}` }
  );

  const license = await prisma.license.findFirst({
    where: { subscriptionId: activated.id },
    orderBy: { createdAt: "desc" },
  });

  console.log("[homologation] Assinatura ativada para homologação local.");
  console.log(`  userId: ${user.id}`);
  console.log(`  email: ${user.email}`);
  console.log(`  plan: ${plan.slug} (${plan.name})`);
  console.log(`  subscriptionId: ${activated.id}`);
  console.log(`  subscriptionStatus: ${activated.status}`);
  console.log(`  periodEnd: ${periodEnd.toISOString()}`);
  if (license) {
    console.log(`  licenseId: ${license.id}`);
    console.log(`  licenseStatus: ${license.status}`);
  }
  console.log("Próximo passo (opcional demo MT5): npm run homolog:enable-demo");
  console.log("Resumo: npm run homolog:summary");
}

main()
  .catch((err) => {
    console.error("[homologation] Falha:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
