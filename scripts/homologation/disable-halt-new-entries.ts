/**
 * Homologação local: libera novas entradas (halt_new_entries=false).
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
import { syncLicenseFlags } from "@/lib/licensing/service";

async function main() {
  assertHomologationNotProduction("resume-new");

  console.warn(
    "\n⚠️  Homologação local — retomada de novas entradas. Não usar em produção.\n"
  );

  const email = requireEnv("HOMOLOG_CLIENT_EMAIL");
  const { user, license } = await findHomologClientLicense(email);

  await updateHomologLicenseFlags(
    license.id,
    {
      haltNewEntries: false,
      adminHaltNewEntries: false,
    },
    "homolog.halt_new_entries_disabled"
  );

  const synced = await syncLicenseFlags(license.id, {
    reason: "homolog_resume_new_entries",
  });

  console.log("[homologation] Novas entradas liberadas (conforme política da assinatura).");
  console.log(`  cliente: ${user.email}`);
  console.log(`  licenseId: ${synced.id}`);
  console.log(`  halt_new_entries: ${synced.haltNewEntries}`);
  console.log(`  halt_all_trading: ${synced.haltAllTrading}`);
}

main()
  .catch((err) => {
    console.error("[homologation] Falha:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
