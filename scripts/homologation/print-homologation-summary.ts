/**
 * Resumo somente leitura da homologação AutoTrade (cliente de teste).
 */
import "./load-env";
import { normalizeEmail, requireEnv } from "./_utils";
import prisma from "@/lib/prisma";

async function main() {
  const email = normalizeEmail(requireEnv("HOMOLOG_CLIENT_EMAIL"));

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      subscriptions: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        include: {
          plan: true,
          licenses: {
            orderBy: { updatedAt: "desc" },
            take: 1,
            include: {
              mt5Account: true,
              devices: {
                where: { revokedAt: null },
                orderBy: { lastSeenAt: "desc" },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    console.error(
      `[homologation] Cliente não encontrado: ${email}. Execute homolog:create-client.`
    );
    process.exit(1);
  }

  const sub = user.subscriptions[0];
  const license = sub?.licenses[0];

  let lastHeartbeat: { receivedAt: Date } | null = null;
  if (license) {
    lastHeartbeat = await prisma.eaHeartbeat.findFirst({
      where: { licenseId: license.id },
      orderBy: { receivedAt: "desc" },
      select: { receivedAt: true },
    });
  }

  console.log("\n=== Resumo homologação AutoTrade (somente leitura) ===\n");
  console.log(`Cliente:        ${user.name ?? "—"}`);
  console.log(`Email:          ${user.email}`);
  console.log(`User ID:        ${user.id}`);
  console.log(`Role:           ${user.role}`);

  if (!sub) {
    console.log("\nAssinatura:     (nenhuma) — rode homolog:create-subscription");
    return;
  }

  console.log(`\nPlano:          ${sub.plan.slug} (${sub.plan.name})`);
  console.log(`Subscription:   ${sub.id}`);
  console.log(`Status assin.:   ${sub.status}`);
  console.log(`Vigência até:   ${sub.currentPeriodEnd?.toISOString() ?? "—"}`);
  console.log(`allow_demo:     ${sub.plan.allowDemo}`);
  console.log(`max_devices:    ${sub.plan.maxDevices}`);
  console.log(`max_mt5:        ${sub.plan.maxMt5Accounts}`);

  if (!license) {
    console.log("\nLicença:        (nenhuma vinculada à assinatura)");
    return;
  }

  console.log(`\nLicense ID:     ${license.id}`);
  console.log(`Status licença: ${license.status}`);
  console.log(`halt_new_entries: ${license.haltNewEntries}`);
  console.log(`halt_all_trading: ${license.haltAllTrading}`);

  if (license.mt5Account) {
    console.log(
      `MT5 vinculado:  sim — ${license.mt5Account.login} @ ${license.mt5Account.server}`
    );
  } else {
    console.log("MT5 vinculado:  não — vincule em /dashboard/assinatura");
  }

  const devices = license.devices;
  console.log(`Devices ativos: ${devices.length}`);
  for (const d of devices) {
    console.log(
      `  - ${d.deviceId} (last_seen: ${d.lastSeenAt?.toISOString() ?? "—"})`
    );
  }

  console.log(
    `Último heartbeat: ${lastHeartbeat?.receivedAt.toISOString() ?? "(nenhum)"}`
  );

  console.log("\n=== Próximos passos MT5/EA ===");
  console.log("1. /dashboard/assinatura — MT5 + código de ativação");
  console.log("2. EA: InpApiBaseUrl=http://localhost:3000, InpDebugMode=true");
  console.log("3. WebRequest liberado para localhost");
  console.log("4. Admin /admin/instrucoes — instrução TEST");
  console.log("\n(DARF não faz parte desta homologação.)\n");
}

main()
  .catch((err) => {
    console.error("[homologation] Falha:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
