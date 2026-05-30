/**
 * Valida POST /api/v1/ea/execution-protection em staging (dry-run, sem ordem real).
 * Não imprime Bearer, DATABASE_URL ou secrets.
 *
 * Uso:
 *   STAGING_EA_BEARER_TOKEN="..." STAGING_DATABASE_URL="..." \
 *     npx tsx scripts/homologation/validate-staging-execution-protection.ts
 *
 * Opcional:
 *   STAGING_API_BASE_URL (default autotrade-staging custom domain)
 *   FIXTURE_INSTRUCTION_ID_CONFIRMED / FIXTURE_INSTRUCTION_ID_FAILED
 */
import "./load-env";
import { execSync } from "child_process";
import { ProtectionStatus, TradeMode } from "@prisma/client";
import { createActivationCodeForLicense } from "@/lib/ea/activate";
import prisma from "@/lib/prisma";
import {
  maskOpaqueToken,
  resolveEaDeviceFromBearerToken,
} from "./resolve-ea-device-from-token";
import {
  resolveBearerToken,
  resolveLicenseIdFromEaDatFile,
} from "./resolve-staging-ea-bearer";
import {
  activateBearerViaClientDashboard,
  createHomologationInstructionViaAdmin,
  isLocalDatabaseUrl,
  loginStagingAdmin,
} from "./staging-http-session";

const API_BASE =
  process.env.STAGING_API_BASE_URL?.replace(/\/$/, "") ??
  "https://autotrade-staging.mercadodariqueza.com.br";

const MAGIC = 910001;
const ACCOUNT_LOGIN = "52609973";
const ACCOUNT_SERVER = "XPMT5-DEMO";
const SYMBOL = "WDOM26";

const redact = (s: string) =>
  s
    .replace(/postgres(ql)?:\/\/[^\s'"]+/gi, "[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");

type HttpResult = {
  status: number;
  code?: string;
  json?: Record<string, unknown>;
  bodyPreview: string;
};

function applyStagingDatabaseUrl(): boolean {
  const stagingDb = process.env.STAGING_DATABASE_URL?.trim();
  if (stagingDb) {
    process.env.DATABASE_URL = stagingDb;
    console.log("[db] STAGING_DATABASE_URL aplicado (host redigido)");
    return true;
  }
  if (!isLocalDatabaseUrl()) {
    console.log("[db] DATABASE_URL remoto detectado");
    return true;
  }
  console.log("[db] DATABASE_URL local — fixtures/auth via HTTP staging");
  return false;
}

async function httpPostProtection(
  bearer: string,
  body: Record<string, unknown>
): Promise<HttpResult> {
  const res = await fetch(`${API_BASE}/api/v1/ea/execution-protection`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearer}`,
      "X-EA-Version": "1.0.0",
      "X-Request-Id": `dry-run-protection-${Date.now()}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: Record<string, unknown> | undefined;
  let code: string | undefined;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
    if (typeof json.code === "string") code = json.code;
  } catch {
    /* ignore */
  }
  return {
    status: res.status,
    code,
    json,
    bodyPreview: redact(text.slice(0, 240)),
  };
}

function runFixtureScript() {
  const env = { ...process.env, CREATE_BOTH: "1" };
  const out = execSync("npx tsx scripts/homologation/create-staging-protection-fixture.ts", {
    encoding: "utf8",
    env,
    stdio: ["pipe", "pipe", "pipe"],
    cwd: process.cwd(),
  });
  console.log(redact(out));
  const match = out.match(/\{[\s\S]*"fixtures"[\s\S]*\}/);
  if (!match) {
    throw new Error("Fixture script não retornou JSON esperado");
  }
  const parsed = JSON.parse(match[0]) as {
    license_id: string;
    fixtures: Array<{ variant: string; instruction_id: string }>;
  };
  const confirmed = parsed.fixtures.find((f) => f.variant === "confirmed");
  const failed = parsed.fixtures.find((f) => f.variant === "failed");
  if (!confirmed?.instruction_id || !failed?.instruction_id) {
    throw new Error("Fixtures confirmed/failed não encontradas");
  }
  return {
    licenseId: parsed.license_id,
    confirmedId: confirmed.instruction_id,
    failedId: failed.instruction_id,
  };
}

async function activateBearerOnStaging(
  licenseId: string
): Promise<string> {
  const { code } = await createActivationCodeForLicense(licenseId);
  const deviceId = `dry-run-protection-${Date.now()}`;
  const res = await fetch(`${API_BASE}/api/v1/ea/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      activation_code: code,
      device_id: deviceId,
      ea_version: "1.0.0",
    }),
  });
  const text = await res.text();
  let json: Record<string, unknown> | undefined;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  if (res.status < 200 || res.status >= 300) {
    throw new Error(
      `Ativação staging HTTP=${res.status} code=${String(json?.code ?? "—")}`
    );
  }
  const token = json?.device_token;
  if (typeof token !== "string" || token.length < 8) {
    throw new Error("Ativação staging sem device_token na resposta");
  }
  console.log(
    `[auth] Bearer obtido via activation-code (masked=${maskOpaqueToken(token)}) deviceId=${deviceId}`
  );
  return token;
}

async function resolveLicenseIdForBearer(): Promise<string> {
  const preset = process.env.STAGING_FIXTURE_LICENSE_ID?.trim();
  if (preset) return preset;

  const bearer = process.env.STAGING_EA_BEARER_TOKEN?.trim();
  if (bearer) {
    const resolved = await resolveEaDeviceFromBearerToken(bearer);
    if (resolved) return resolved.licenseId;
  }

  const license = await prisma.license.findFirst({
    where: {
      status: "ACTIVE",
      mt5Account: { login: ACCOUNT_LOGIN, server: ACCOUNT_SERVER },
    },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!license) {
    throw new Error(
      "Licença staging não encontrada para resolver Bearer (MT5 52609973)."
    );
  }
  return license.id;
}

async function findFixtureIdsFromEaPull(bearer: string): Promise<{
  confirmedId?: string;
  failedId?: string;
}> {
  const res = await fetch(`${API_BASE}/api/v1/ea/instructions`, {
    headers: {
      Authorization: `Bearer ${bearer}`,
      Accept: "application/json",
      "X-EA-Version": "1.0.0",
    },
  });
  if (!res.ok) return {};
  const json = (await res.json()) as {
    instructions?: Array<{ instruction_id?: string; magic_number?: number }>;
  };
  const ids =
    json.instructions
      ?.map((i) => i.instruction_id)
      .filter((id): id is string => Boolean(id)) ?? [];
  if (ids.length >= 2) {
    return { confirmedId: ids[0], failedId: ids[1] };
  }
  if (ids.length === 1) {
    return { confirmedId: ids[0] };
  }
  return {};
}

async function createFixturesViaHttp(licenseId: string) {
  const adminJar = await loginStagingAdmin();
  const confirmedId = await createHomologationInstructionViaAdmin(
    adminJar,
    licenseId,
    "dry-run protection confirmed fixture"
  );
  const failedId = await createHomologationInstructionViaAdmin(
    adminJar,
    licenseId,
    "dry-run protection failed fixture"
  );
  console.log(`[fixture:http] confirmed instruction_id=${confirmedId}`);
  console.log(`[fixture:http] failed instruction_id=${failedId}`);
  return { licenseId, confirmedId, failedId };
}

async function resolveBearerAndLicense(): Promise<{
  bearer: string;
  licenseId: string;
}> {
  let bearer: string;
  try {
    bearer = resolveBearerToken();
  } catch {
    bearer = "";
  }

  if (bearer) {
    if (process.env.STAGING_EA_BEARER_TOKEN?.trim()) {
      console.log(
        `[auth] STAGING_EA_BEARER_TOKEN presente (masked=${maskOpaqueToken(bearer)})`
      );
    }
    const resolved = await resolveEaDeviceFromBearerToken(bearer);
    return {
      bearer,
      licenseId:
        resolved?.licenseId ??
        resolveLicenseIdFromEaDatFile() ??
        process.env.STAGING_FIXTURE_LICENSE_ID?.trim() ??
        "",
    };
  }

  const hasRemoteDb =
    Boolean(process.env.STAGING_DATABASE_URL?.trim()) ||
    !isLocalDatabaseUrl(process.env.DATABASE_URL);

  if (hasRemoteDb && process.env.DATABASE_URL?.trim()) {
    const licenseId = await resolveLicenseIdForBearer();
    const activated = await activateBearerOnStaging(licenseId);
    return { bearer: activated, licenseId };
  }

  const client = await activateBearerViaClientDashboard();
  console.log(
    `[auth] Bearer via dashboard (masked=${maskOpaqueToken(client.bearer)}) licenseId=${client.licenseId}`
  );
  return { bearer: client.bearer, licenseId: client.licenseId };
}

async function verifyDbReport(
  instructionId: string,
  expectedStatus: ProtectionStatus
) {
  const report = await prisma.executionProtectionReport.findFirst({
    where: { instructionId },
    orderBy: { reportedAt: "desc" },
    select: {
      id: true,
      protectionStatus: true,
      errorCode: true,
      errorMessageRedacted: true,
      magicNumber: true,
    },
  });
  const instruction = await prisma.instruction.findUnique({
    where: { id: instructionId },
    select: { protectionBlocked: true, currentStatus: true },
  });
  return { report, instruction };
}

async function main() {
  const hasRemoteDb = applyStagingDatabaseUrl();
  console.log(`[api] Base: ${API_BASE}`);

  const { bearer, licenseId: bearerLicenseId } = await resolveBearerAndLicense();
  const resolved = await resolveEaDeviceFromBearerToken(bearer);
  if (resolved) {
    console.log(
      `[auth] Bearer válido no banco (masked=${resolved.tokenMasked}) licenseId=${resolved.licenseId}`
    );
  } else if (!hasRemoteDb) {
    console.log("[auth] Bearer válido na API staging (verificação DB local indisponível)");
  } else {
    console.log("[auth] Bearer presente — device não encontrado no banco apontado");
  }

  let confirmedId = process.env.FIXTURE_INSTRUCTION_ID_CONFIRMED?.trim();
  let failedId = process.env.FIXTURE_INSTRUCTION_ID_FAILED?.trim();
  let licenseId =
    resolved?.licenseId ||
    bearerLicenseId ||
    process.env.STAGING_FIXTURE_LICENSE_ID?.trim() ||
    "";

  if (!confirmedId || !failedId) {
    if (hasRemoteDb && process.env.DATABASE_URL?.trim()) {
      console.log("[fixture] Criando/reutilizando fixtures via script DB...");
      const fixtures = runFixtureScript();
      confirmedId = fixtures.confirmedId;
      failedId = fixtures.failedId;
      licenseId = fixtures.licenseId;
    } else {
      if (!licenseId) {
        licenseId =
          process.env.STAGING_FIXTURE_LICENSE_ID?.trim() ??
          resolveLicenseIdFromEaDatFile() ??
          "cmpj3wby70005sx18ot5e939p";
        console.log(`[fixture] licenseId=${licenseId}`);
      }

      const pulled = await findFixtureIdsFromEaPull(bearer);
      if (pulled.confirmedId && !confirmedId) confirmedId = pulled.confirmedId;
      if (pulled.failedId && !failedId) failedId = pulled.failedId;

      if (!confirmedId || !failedId) {
        try {
          console.log("[fixture] Criando fixtures via admin HTTP staging...");
          const fixtures = await createFixturesViaHttp(licenseId);
          confirmedId = confirmedId ?? fixtures.confirmedId;
          failedId = failedId ?? fixtures.failedId;
          licenseId = fixtures.licenseId;
        } catch (adminErr) {
          console.log(
            `[fixture] Admin HTTP indisponível: ${adminErr instanceof Error ? adminErr.message : "erro"}`
          );
          throw new Error(
            "Fixtures ausentes. Exporte STAGING_DATABASE_URL e rode create-staging-protection-fixture.ts, ou defina FIXTURE_INSTRUCTION_ID_*."
          );
        }
      }
    }
  }

  console.log(`[fixture] confirmed instruction_id=${confirmedId}`);
  console.log(`[fixture] failed instruction_id=${failedId}`);

  const hb = licenseId
    ? await prisma.eaHeartbeat.findFirst({
        where: { licenseId },
        orderBy: { receivedAt: "desc" },
        select: { tradeMode: true },
      })
    : null;
  const tradeMode = hb?.tradeMode ?? TradeMode.DEMO;
  console.log(`[context] tradeMode=${tradeMode}`);

  const now = new Date().toISOString();

  const confirmedPayload = {
    instruction_id: confirmedId,
    account_login: ACCOUNT_LOGIN,
    account_server: ACCOUNT_SERVER,
    symbol: SYMBOL,
    magic_number: MAGIC,
    entry_order_ticket: "dry-run-order-001",
    entry_deal_ticket: "dry-run-deal-001",
    stop_loss_present: true,
    take_profit_present: true,
    stop_loss_price: 0,
    take_profit_price: 0,
    stop_order_ticket: "dry-run-stop-001",
    take_order_ticket: "dry-run-take-001",
    protection_mode: "PENDING_PROTECTION_ORDERS",
    protection_status: "PROTECTION_CONFIRMED",
    reported_at: now,
  };

  const confirmedHttp = await httpPostProtection(bearer, confirmedPayload);
  console.log(
    `[confirmed] HTTP=${confirmedHttp.status} code=${confirmedHttp.code ?? "—"} preview=${confirmedHttp.bodyPreview}`
  );
  const confirmedReportId =
    typeof confirmedHttp.json?.report_id === "string"
      ? confirmedHttp.json.report_id
      : null;

  let confirmedDb = null;
  if (hasRemoteDb && process.env.DATABASE_URL?.trim()) {
    confirmedDb = await verifyDbReport(
      confirmedId!,
      ProtectionStatus.PROTECTION_CONFIRMED
    );
    if (confirmedDb.report) {
      console.log(
        `[db:confirmed] report_id=${confirmedDb.report.id} status=${confirmedDb.report.protectionStatus} blocked=${confirmedDb.instruction?.protectionBlocked}`
      );
    }
  }

  const failedPayload = {
    instruction_id: failedId,
    account_login: ACCOUNT_LOGIN,
    account_server: ACCOUNT_SERVER,
    symbol: SYMBOL,
    magic_number: MAGIC,
    entry_order_ticket: "dry-run-order-failed-001",
    entry_deal_ticket: "dry-run-deal-failed-001",
    stop_loss_present: false,
    take_profit_present: false,
    protection_mode: "PENDING_PROTECTION_ORDERS",
    protection_status: "PROTECTION_FAILED",
    error_code: "DRY_RUN_PROTECTION_FAILED",
    error_message: "dry run protection failure without real order",
    reported_at: new Date().toISOString(),
  };

  const failedHttp = await httpPostProtection(bearer, failedPayload);
  console.log(
    `[failed] HTTP=${failedHttp.status} code=${failedHttp.code ?? "—"} preview=${failedHttp.bodyPreview}`
  );
  const failedReportId =
    typeof failedHttp.json?.report_id === "string"
      ? failedHttp.json.report_id
      : null;

  let failedDb = null;
  if (hasRemoteDb && process.env.DATABASE_URL?.trim()) {
    failedDb = await verifyDbReport(
      failedId!,
      ProtectionStatus.PROTECTION_FAILED
    );
    if (failedDb.report) {
      console.log(
        `[db:failed] report_id=${failedDb.report.id} status=${failedDb.report.protectionStatus} error_code=${failedDb.report.errorCode} blocked=${failedDb.instruction?.protectionBlocked}`
      );
      if (failedDb.report.errorMessageRedacted) {
        console.log(
          `[db:failed] error_message_redacted=${failedDb.report.errorMessageRedacted.slice(0, 80)}`
        );
      }
    }
  }

  const adminProtectionUrl = `${API_BASE}/admin/real-trading/protection`;
  console.log(`[admin] Conferir manualmente: ${adminProtectionUrl}`);

  console.log("\n=== Resumo execution-protection dry-run ===");
  console.log(
    JSON.stringify(
      {
        confirmed_instruction_id: confirmedId,
        failed_instruction_id: failedId,
        protection_confirmed: {
          http: confirmedHttp.status,
          ok: confirmedHttp.status >= 200 && confirmedHttp.status < 300,
          report_id: confirmedReportId,
          db_report_id: confirmedDb?.report?.id ?? null,
          instruction_blocked: confirmedDb?.instruction?.protectionBlocked ?? null,
        },
        protection_failed: {
          http: failedHttp.status,
          ok: failedHttp.status >= 200 && failedHttp.status < 300,
          report_id: failedReportId,
          db_report_id: failedDb?.report?.id ?? null,
          instruction_blocked: failedDb?.instruction?.protectionBlocked ?? null,
          trade_mode: tradeMode,
          blocking_expected_on_real_only: tradeMode !== TradeMode.REAL,
        },
        no_real_order: true,
        dispatch_automatic: false,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(redact(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
