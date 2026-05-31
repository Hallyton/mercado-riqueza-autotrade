/**
 * Reset de senha do admin de homologação staging (Neon/Vercel staging).
 *
 * Uso (PowerShell — não commitar credenciais):
 *   $env:DATABASE_URL = "<connection-string-neon-staging>"
 *   $env:ADMIN_EMAIL = "admin@mercadodariqueza.com.br"
 *   $env:ADMIN_PASSWORD = "<senha-temporaria-min-12>"
 *   npm run homolog:reset-staging-admin-password
 *
 * Não imprime senha, hash, DATABASE_URL nem secrets.
 */
import { hash } from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { isAdminRole } from "@/lib/auth/roles";
import {
  assertHomologationNotProduction,
  normalizeEmail,
  requireEnv,
} from "./_utils";
import prisma from "@/lib/prisma";

const BCRYPT_COST = 12;

function assertDatabaseUrlPresent(): void {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error(
      "[homologation:reset-staging-admin-password] DATABASE_URL ausente. Exporte no shell antes de executar."
    );
    process.exit(1);
  }
}

function assertStagingDatabaseUrl(): void {
  const url = process.env.DATABASE_URL!.trim();
  if (/localhost|127\.0\.0\.1/i.test(url)) {
    console.error(
      "[homologation:reset-staging-admin-password] Abortado: DATABASE_URL aponta para host local. Use o Neon staging no shell."
    );
    process.exit(1);
  }
}

async function main() {
  assertHomologationNotProduction("reset-staging-admin-password");
  assertDatabaseUrlPresent();
  assertStagingDatabaseUrl();

  const email = normalizeEmail(requireEnv("ADMIN_EMAIL"));
  const password = requireEnv("ADMIN_PASSWORD");
  if (password.length < 12) {
    console.error(
      "[homologation:reset-staging-admin-password] ADMIN_PASSWORD deve ter no mínimo 12 caracteres."
    );
    process.exit(1);
  }

  const passwordHash = await hash(password, BCRYPT_COST);

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (!isAdminRole(existing.role)) {
      console.error(
        `[homologation:reset-staging-admin-password] Usuário ${email} existe mas não é admin (role=${existing.role}).`
      );
      process.exit(1);
    }

    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, status: UserStatus.ACTIVE, emailVerified: new Date() },
    });

    console.log(`email: ${existing.email}`);
    console.log(`userId: ${existing.id}`);
    console.log(`role: ${existing.role}`);
    console.log("status: PASSWORD_RESET_OK");
    return;
  }

  const created = await prisma.user.create({
    data: {
      email,
      name: process.env.ADMIN_NAME?.trim() || "Admin Staging",
      passwordHash,
      role: UserRole.SUPERADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: new Date(),
    },
  });

  console.log(`email: ${created.email}`);
  console.log(`userId: ${created.id}`);
  console.log(`role: ${created.role}`);
  console.log("status: ADMIN_CREATED_OK");
}

main()
  .catch((err) => {
    console.error("[homologation:reset-staging-admin-password] Falha:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
