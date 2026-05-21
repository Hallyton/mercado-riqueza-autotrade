/**
 * Cria usuário CLIENT de teste para homologação local (não altera existentes).
 */
import { hash } from "bcryptjs";
import { UserRole } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  assertHomologationNotProduction,
  normalizeEmail,
  requireEnv,
} from "./_utils";

async function main() {
  assertHomologationNotProduction("create-test-client");

  const email = normalizeEmail(requireEnv("HOMOLOG_CLIENT_EMAIL"));
  const password = requireEnv("HOMOLOG_CLIENT_PASSWORD");
  const name = process.env.HOMOLOG_CLIENT_NAME?.trim() ?? "Cliente Homologação";

  if (password.length < 12) {
    console.error(
      "[homologation] HOMOLOG_CLIENT_PASSWORD deve ter no mínimo 12 caracteres."
    );
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(
      `[homologation] Usuário já existe — nenhuma alteração feita.\n` +
        `  id: ${existing.id}\n` +
        `  email: ${existing.email}\n` +
        `  role: ${existing.role}`
    );
    if (existing.role !== UserRole.CLIENT) {
      console.warn(
        `[homologation] Aviso: role atual é ${existing.role}, esperado CLIENT para homologação AutoTrade.`
      );
    }
    return;
  }

  const passwordHash = await hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: UserRole.CLIENT,
      emailVerified: new Date(),
    },
  });

  console.log("[homologation] Cliente de teste criado.");
  console.log(`  id: ${user.id}`);
  console.log(`  email: ${user.email}`);
  console.log(`  role: ${user.role}`);
  console.log("Próximo passo: npm run homolog:create-subscription");
}

main()
  .catch((err) => {
    console.error("[homologation] Falha:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
