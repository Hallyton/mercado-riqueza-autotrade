/**
 * Sincroniza hash do admin com ADMIN_EMAIL/ADMIN_PASSWORD do ambiente (build staging).
 * Opt-in: SYNC_ADMIN_PASSWORD_ON_BUILD=true
 * Não imprime senha, hash ou DATABASE_URL.
 */
import { hash } from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import prisma from "@/lib/prisma";

const BCRYPT_COST = 12;

async function main() {
  if (process.env.SYNC_ADMIN_PASSWORD_ON_BUILD !== "true") {
    console.log("[sync-staging-admin] SKIP (SYNC_ADMIN_PASSWORD_ON_BUILD != true)");
    return;
  }

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD?.trim();
  const name = process.env.ADMIN_NAME?.trim() ?? "Administrador";

  if (!email || !password) {
    console.error("[sync-staging-admin] ADMIN_EMAIL/ADMIN_PASSWORD ausentes — abortando sync.");
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("[sync-staging-admin] ADMIN_PASSWORD deve ter no mínimo 12 caracteres.");
    process.exit(1);
  }

  const passwordHash = await hash(password, BCRYPT_COST);

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      passwordHash,
      role: UserRole.SUPERADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: new Date(),
    },
    update: {
      name,
      passwordHash,
      role: UserRole.SUPERADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: new Date(),
    },
  });

  console.log(`[sync-staging-admin] email: ${user.email}`);
  console.log(`[sync-staging-admin] userId: ${user.id}`);
  console.log(`[sync-staging-admin] role: ${user.role}`);
  console.log("[sync-staging-admin] status: ADMIN_SYNC_OK");
}

main()
  .catch((err) => {
    console.error("[sync-staging-admin] Falha:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
