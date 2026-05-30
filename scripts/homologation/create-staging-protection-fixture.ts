/**
 * Cria ou reutiliza Instruction de dry-run para homologação de execution-protection em staging.
 * Não dispara ordem, não chama broker, não imprime secrets.
 *
 * Uso:
 *   STAGING_DATABASE_URL="..." STAGING_EA_BEARER_TOKEN="..." \
 *     npx tsx scripts/homologation/create-staging-protection-fixture.ts
 *
 * Opcional:
 *   STAGING_FIXTURE_LICENSE_ID — pula resolução por token
 *   FIXTURE_VARIANT=confirmed|failed — qual fixture criar (default: both se --create-both)
 *   CREATE_BOTH=1 — cria duas instructions (confirmed + failed)
 */
import "./load-env";
import {
  InstructionSource,
  OrderLogStatus,
  TradeMode,
  UserRole,
} from "@prisma/client";
import { createAdminDispatchedInstruction } from "@/lib/admin/instruction-dispatch";
import prisma from "@/lib/prisma";
import { resolveEaDeviceFromBearerToken } from "./resolve-ea-device-from-token";

const MAGIC = 910001;
const ACCOUNT_LOGIN = "52609973";
const ACCOUNT_SERVER = "XPMT5-DEMO";
const SYMBOL = "WDOM26";

function applyStagingDatabaseUrl() {
  const stagingDb = process.env.STAGING_DATABASE_URL?.trim();
  if (stagingDb) {
    process.env.DATABASE_URL = stagingDb;
    console.log("[db] Usando STAGING_DATABASE_URL (host redigido em logs)");
    return;
  }
  const db = process.env.DATABASE_URL?.trim();
  if (!db) {
    console.error(
      "[db] Defina STAGING_DATABASE_URL ou DATABASE_URL no shell (não commitar .env)."
    );
    process.exit(1);
  }
  console.log("[db] Usando DATABASE_URL do ambiente");
}

async function resolveLicenseId(): Promise<string> {
  const preset = process.env.STAGING_FIXTURE_LICENSE_ID?.trim();
  if (preset) {
    console.log(`[license] STAGING_FIXTURE_LICENSE_ID=${preset}`);
    return preset;
  }

  const bearer = process.env.STAGING_EA_BEARER_TOKEN?.trim();
  if (bearer) {
    const resolved = await resolveEaDeviceFromBearerToken(bearer);
    if (resolved) {
      console.log(
        `[license] Resolvida via token: licenseId=${resolved.licenseId} deviceId=${resolved.deviceId}`
      );
      return resolved.licenseId;
    }
    console.log(
      "[license] Token não encontrado no banco apontado — defina STAGING_FIXTURE_LICENSE_ID."
    );
  }

  const license = await prisma.license.findFirst({
    where: {
      status: "ACTIVE",
      mt5Account: { login: ACCOUNT_LOGIN, server: ACCOUNT_SERVER },
    },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
  });
  if (license) {
    console.log(`[license] Encontrada por MT5 ${ACCOUNT_LOGIN}@${ACCOUNT_SERVER}`);
    return license.id;
  }

  throw new Error(
    "Licença staging não encontrada. Defina STAGING_EA_BEARER_TOKEN ou STAGING_FIXTURE_LICENSE_ID."
  );
}

type FixtureRow = {
  id: string;
  idempotencyKey: string;
  currentStatus: string;
  protectionBlocked: boolean;
  requiresProtectionConfirmation: boolean;
};

async function findReusableFixture(
  licenseId: string,
  suffix: string
): Promise<FixtureRow | null> {
  const prefix = `dry-run-protection-${suffix}-`;
  return prisma.instruction.findFirst({
    where: {
      licenseId,
      source: InstructionSource.HOMOLOGATION,
      magicNumber: MAGIC,
      accountLogin: ACCOUNT_LOGIN,
      accountServer: ACCOUNT_SERVER,
      symbol: SYMBOL,
      requiresProtectionConfirmation: true,
      idempotencyKey: { startsWith: prefix },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      idempotencyKey: true,
      currentStatus: true,
      protectionBlocked: true,
      requiresProtectionConfirmation: true,
    },
  });
}

async function resolveAdminActorId(): Promise<string> {
  const email =
    process.env.STAGING_ADMIN_EMAIL?.trim() ??
    process.env.ADMIN_EMAIL?.trim() ??
    "admin@mercadodariqueza.com.br";
  const admin = await prisma.user.findFirst({
    where: { email, role: UserRole.ADMIN },
    select: { id: true },
  });
  if (!admin) {
    throw new Error(`Admin não encontrado no banco para email ${email}`);
  }
  return admin.id;
}

async function createFixture(
  licenseId: string,
  suffix: "confirmed" | "failed"
): Promise<FixtureRow> {
  const actorId = await resolveAdminActorId();
  const result = await createAdminDispatchedInstruction({
    license_id: licenseId,
    source: "HOMOLOGATION",
    purpose: "ENTRY",
    symbol: SYMBOL,
    side: "BUY",
    order_type: "MARKET",
    quantity: 1,
    expires_in_minutes: 1440,
    magic_number: MAGIC,
    account_login: ACCOUNT_LOGIN,
    account_server: ACCOUNT_SERVER,
    requires_protection_confirmation: true,
    note: `dry-run protection ${suffix} fixture — sem ordem real`,
    actorId,
    ipAddress: "127.0.0.1",
  });

  await prisma.instruction.update({
    where: { id: result.instructionId },
    data: { currentStatus: OrderLogStatus.SENT },
  });
  await prisma.instructionStatusLog.create({
    data: {
      instructionId: result.instructionId,
      status: OrderLogStatus.SENT,
      message: `Fixture dry-run protection (${suffix}) — sem ordem real`,
      metadata: { fixture: true, variant: suffix, tradeModeIntent: "DEMO" },
    },
  });

  const instruction = await prisma.instruction.findUniqueOrThrow({
    where: { id: result.instructionId },
    select: {
      id: true,
      idempotencyKey: true,
      currentStatus: true,
      protectionBlocked: true,
      requiresProtectionConfirmation: true,
    },
  });

  return instruction;
}

async function printContext(licenseId: string) {
  const hb = await prisma.eaHeartbeat.findFirst({
    where: { licenseId },
    orderBy: { receivedAt: "desc" },
    select: { tradeMode: true, receivedAt: true },
  });
  console.log(
    `[context] tradeMode=${hb?.tradeMode ?? "unknown"} lastHeartbeat=${hb?.receivedAt?.toISOString() ?? "—"}`
  );
  if (hb?.tradeMode === TradeMode.REAL) {
    console.log(
      "[warn] Heartbeat REAL — reports FAILED bloqueiam instruction; CONFIRMED exige SL/TP válidos."
    );
  } else {
    console.log(
      "[info] Heartbeat DEMO — reports salvam; bloqueio de instruction em FAILED só aplica em REAL."
    );
  }
}

async function ensureFixture(
  licenseId: string,
  suffix: "confirmed" | "failed",
  forceCreate: boolean
): Promise<{ variant: string; reused: boolean; instruction: FixtureRow }> {
  if (!forceCreate) {
    const existing = await findReusableFixture(licenseId, suffix);
    if (existing) {
      const hasReport = await prisma.executionProtectionReport.findFirst({
        where: { instructionId: existing.id },
        select: { id: true, protectionStatus: true },
      });
      if (!hasReport) {
        console.log(`[fixture:${suffix}] Reutilizando instruction_id=${existing.id}`);
        return { variant: suffix, reused: true, instruction: existing };
      }
      console.log(
        `[fixture:${suffix}] Existente ${existing.id} já tem report — criando nova`
      );
    }
  }

  const created = await createFixture(licenseId, suffix);
  console.log(`[fixture:${suffix}] Criada instruction_id=${created.id}`);
  return { variant: suffix, reused: false, instruction: created };
}

async function main() {
  applyStagingDatabaseUrl();

  const licenseId = await resolveLicenseId();
  await printContext(licenseId);

  const createBoth =
    process.env.CREATE_BOTH === "1" ||
    process.argv.includes("--create-both");
  const forceCreate = process.argv.includes("--force-create");
  const variantArg = process.env.FIXTURE_VARIANT?.trim() as
    | "confirmed"
    | "failed"
    | undefined;

  const variants: Array<"confirmed" | "failed"> = createBoth
    ? ["confirmed", "failed"]
    : variantArg
      ? [variantArg]
      : ["confirmed"];

  const fixtures = [];
  for (const v of variants) {
    fixtures.push(await ensureFixture(licenseId, v, forceCreate));
  }

  console.log("\n=== Fixture(s) pronta(s) ===");
  console.log(
    JSON.stringify(
      {
        license_id: licenseId,
        account_login: ACCOUNT_LOGIN,
        account_server: ACCOUNT_SERVER,
        symbol: SYMBOL,
        magic_number: MAGIC,
        fixtures: fixtures.map((f) => ({
          variant: f.variant,
          reused: f.reused,
          instruction_id: f.instruction.id,
          idempotency_key: f.instruction.idempotencyKey,
          current_status: f.instruction.currentStatus,
          requires_protection_confirmation:
            f.instruction.requiresProtectionConfirmation,
        })),
        no_real_order: true,
        no_broker_call: true,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
