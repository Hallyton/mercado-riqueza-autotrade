/**
 * Homologação local: halt_all_trading=false.
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
  assertHomologationNotProduction("resume-all");

  console.warn(
    "\n⚠️  Homologação local — retomada de trading (halt_all_trading=false). Não usar em produção.\n"
  );

  const email = requireEnv("HOMOLOG_CLIENT_EMAIL");
  const { user, license } = await findHomologClientLicense(email);

  const updated = await updateHomologLicenseFlags(
    license.id,
    { haltAllTrading: false },
    "homolog.halt_all_trading_disabled"
  );

  console.log("[homologation] Trading total liberado.");
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
