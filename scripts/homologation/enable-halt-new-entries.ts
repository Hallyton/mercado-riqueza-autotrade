/**
 * Homologação local: bloqueia novas entradas (halt_new_entries=true).
 */
import "./load-env";
import prisma from "@/lib/prisma";
import {
  assertHomologationNotProduction,
  requireEnv,
} from "./_utils";
import {
  findHomologClientLicense,
  updateHomologLicenseFlags,
} from "./_license";

async function main() {
  assertHomologationNotProduction("halt-new");

  console.warn(
    "\n⚠️  Homologação local — halt_new_entries=true. Não usar em produção.\n"
  );

  const email = requireEnv("HOMOLOG_CLIENT_EMAIL");
  const { user, license } = await findHomologClientLicense(email);

  const updated = await updateHomologLicenseFlags(
    license.id,
    {
      haltNewEntries: true,
      adminHaltNewEntries: true,
    },
    "homolog.halt_new_entries_enabled"
  );

  console.log("[homologation] Novas entradas bloqueadas.");
  console.log(`  cliente: ${user.email}`);
  console.log(`  licenseId: ${updated.id}`);
  console.log(`  halt_new_entries: ${updated.haltNewEntries}`);
  console.log(`  halt_all_trading: ${updated.haltAllTrading}`);
}

main()
  .catch((err) => {
    console.error("[homologation] Falha:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
