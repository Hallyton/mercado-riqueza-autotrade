/**
 * Reverte allow_demo=false no plano — somente homologação local (opcional).
 */
import "./load-env";
import {
  assertHomologationNotProduction,
  requireEnv,
} from "./_utils";
import prisma from "@/lib/prisma";

async function main() {
  assertHomologationNotProduction("disable-demo");

  const planSlug = requireEnv("HOMOLOG_PLAN_SLUG").toLowerCase();

  const plan = await prisma.plan.findUnique({ where: { slug: planSlug } });
  if (!plan) {
    console.error(`[homologation] Plano não encontrado: ${planSlug}`);
    process.exit(1);
  }

  if (!plan.allowDemo) {
    console.log(
      `[homologation] Plano "${planSlug}" já possui allow_demo=false — nenhuma alteração.`
    );
    return;
  }

  const updated = await prisma.plan.update({
    where: { id: plan.id },
    data: { allowDemo: false },
  });

  console.log("[homologation] allow_demo desabilitado (valor padrão pós-seed).");
  console.log(`  plan: ${updated.slug}`);
  console.log(`  allow_demo: ${updated.allowDemo}`);
}

main()
  .catch((err) => {
    console.error("[homologation] Falha:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
