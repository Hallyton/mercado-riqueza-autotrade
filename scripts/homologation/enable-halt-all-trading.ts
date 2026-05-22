/**
 * Homologação local: halt_all_trading=true (pausa total).
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
  assertHomologationNotProduction("halt-all");

  console.warn(
    "\n⚠️  Homologação local — halt_all_trading=true. Não usar em produção.\n"
  );

  const email = requireEnv("HOMOLOG_CLIENT_EMAIL");
  const { user, license } = await findHomologClientLicense(email);

  const updated = await updateHomologLicenseFlags(
    license.id,
    { haltAllTrading: true },
    "homolog.halt_all_trading_enabled"
  );

  console.log("[homologation] Trading total bloqueado.");
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
