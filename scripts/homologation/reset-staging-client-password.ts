/**
 * Reset de senha do cliente de homologação staging (Neon/Vercel staging).
 *
 * Uso (PowerShell — não commitar credenciais):
 *   $env:DATABASE_URL = "<connection-string-neon-staging>"
 *   $env:STAGING_CLIENT_EMAIL = "cliente.staging@mercadodariqueza.com.br"
 *   $env:STAGING_CLIENT_PASSWORD = "<senha-temporaria-min-12>"
 *   npm run homolog:reset-staging-client-password
 *
 * Não imprime senha, hash, DATABASE_URL nem secrets.
 */
import { hash } from "bcryptjs";
import {
  assertHomologationNotProduction,
  normalizeEmail,
  requireEnv,
} from "./_utils";
import prisma from "@/lib/prisma";

const BCRYPT_COST = 12;
const STAGING_HOMOLOG_EMAIL = "cliente.staging@mercadodariqueza.com.br";

function assertDatabaseUrlPresent(): void {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error(
      "[homologation:reset-staging-password] DATABASE_URL ausente. Exporte no shell antes de executar."
    );
    process.exit(1);
  }
}

function assertStagingDatabaseUrl(): void {
  const url = process.env.DATABASE_URL!.trim();
  if (/localhost|127\.0\.0\.1/i.test(url)) {
    console.error(
      "[homologation:reset-staging-password] Abortado: DATABASE_URL aponta para host local. Use o Neon staging no shell."
    );
    process.exit(1);
  }
}

async function main() {
  assertHomologationNotProduction("reset-staging-password");
  assertDatabaseUrlPresent();
  assertStagingDatabaseUrl();

  const email = normalizeEmail(requireEnv("STAGING_CLIENT_EMAIL"));
  if (email !== STAGING_HOMOLOG_EMAIL) {
    console.error(
      `[homologation:reset-staging-password] Abortado: este script aceita apenas ${STAGING_HOMOLOG_EMAIL}.`
    );
    process.exit(1);
  }

  const password = requireEnv("STAGING_CLIENT_PASSWORD");
  if (password.length < 12) {
    console.error(
      "[homologation:reset-staging-password] STAGING_CLIENT_PASSWORD deve ter no mínimo 12 caracteres."
    );
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(
      `[homologation:reset-staging-password] Usuário não encontrado: ${email}`
    );
    process.exit(1);
  }

  const passwordHash = await hash(password, BCRYPT_COST);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  console.log(`email: ${user.email}`);
  console.log(`userId: ${user.id}`);
  console.log("status: PASSWORD_RESET_OK");
}

main()
  .catch((err) => {
    console.error("[homologation:reset-staging-password] Falha:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
