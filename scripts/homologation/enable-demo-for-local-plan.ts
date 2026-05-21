/**
 * allow_demo=true no plano — somente banco local de homologação.
 */
import "./load-env";
import {
  assertHomologationNotProduction,
  requireEnv,
} from "./_utils";
import prisma from "@/lib/prisma";

async function main() {
  assertHomologationNotProduction("enable-demo");

  const planSlug = requireEnv("HOMOLOG_PLAN_SLUG").toLowerCase();

  console.warn(
    "\n⚠️  Esta alteração é apenas para homologação local/demo. Não usar em produção.\n"
  );

  const plan = await prisma.plan.findUnique({ where: { slug: planSlug } });
  if (!plan) {
    console.error(
      `[homologation] Plano não encontrado: ${planSlug}. Rode o seed primeiro.`
    );
    process.exit(1);
  }

  if (plan.allowDemo) {
    console.log(
      `[homologation] Plano "${planSlug}" já possui allow_demo=true — nenhuma alteração.`
    );
    return;
  }

  const updated = await prisma.plan.update({
    where: { id: plan.id },
    data: { allowDemo: true },
  });

  console.log("[homologation] allow_demo habilitado localmente.");
  console.log(`  plan: ${updated.slug} (${updated.name})`);
  console.log(`  allow_demo: ${updated.allowDemo}`);
  console.log(
    "\nPara reverter localmente: npm run homolog:disable-demo (ou UPDATE manual no banco).\n"
  );
}

main()
  .catch((err) => {
    console.error("[homologation] Falha:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
