/**
 * Resolve Device.deviceId a partir de STAGING_EA_BEARER_TOKEN (hash no banco).
 *
 * Uso (não imprimir token no chat):
 *   $env:STAGING_EA_BEARER_TOKEN = (Get-Content ...\mr_at_<login>.dat -First 1).Trim()
 *   $env:DATABASE_URL = "..."   # ou STAGING_DATABASE_URL — mesmo banco do deploy staging
 *   npx tsx scripts/homologation/resolve-ea-device-id-from-token.ts
 *   Remove-Item Env:STAGING_EA_BEARER_TOKEN, Env:DATABASE_URL
 */
import "./load-env";
import { resolveEaDeviceFromBearerToken } from "./resolve-ea-device-from-token";
import prisma from "@/lib/prisma";

async function main() {
  const token = process.env.STAGING_EA_BEARER_TOKEN?.trim();
  if (!token) {
    console.error("STAGING_EA_BEARER_TOKEN ausente.");
    process.exit(2);
  }

  const stagingDb = process.env.STAGING_DATABASE_URL?.trim();
  if (stagingDb) {
    process.env.DATABASE_URL = stagingDb;
  }

  if (!process.env.DATABASE_URL?.trim()) {
    console.error(
      "DATABASE_URL ou STAGING_DATABASE_URL ausente. Defina no shell (não commitar .env)."
    );
    process.exit(2);
  }

  const resolved = await resolveEaDeviceFromBearerToken(token);
  if (!resolved) {
    console.error("DEVICE_NOT_FOUND_FOR_TOKEN_HASH");
    process.exit(1);
  }

  console.log(JSON.stringify(resolved, null, 2));
}

main()
  .catch((err) => {
    const msg = String(err instanceof Error ? err.message : err).replace(
      /postgres(ql)?:\/\/[^\s'"]+/gi,
      "[REDACTED]"
    );
    console.error(msg);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
