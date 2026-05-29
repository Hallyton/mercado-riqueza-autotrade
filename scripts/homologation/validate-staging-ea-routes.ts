/**
 * Valida rotas EA em staging com Bearer (sem imprimir token/secrets).
 *
 * Uso:
 *   STAGING_DATABASE_URL="..." STAGING_API_BASE_URL="https://autotrade-staging.mercadodariqueza.com.br" \
 *     npx tsx scripts/homologation/validate-staging-ea-routes.ts
 *
 * Opcional: STAGING_EA_BEARER_TOKEN (pula ativação; não logar).
 * Migrate: APPLY_MIGRATE=1
 */
import "./load-env";
import { execSync } from "child_process";
import { createActivationCodeForLicense } from "@/lib/ea/activate";
import prisma from "@/lib/prisma";

const API_BASE =
  process.env.STAGING_API_BASE_URL?.replace(/\/$/, "") ??
  "https://autotrade-staging.mercadodariqueza.com.br";

const redact = (s: string) =>
  s.replace(/postgres(ql)?:\/\/[^\s'"]+/gi, "[REDACTED]").replace(
    /Bearer\s+[A-Za-z0-9._-]+/gi,
    "Bearer [REDACTED]"
  );

type HttpResult = {
  status: number;
  code?: string;
  bodyPreview: string;
  json?: Record<string, unknown>;
};

async function httpPost(
  path: string,
  bearer: string,
  body: unknown,
  deviceId: string
): Promise<HttpResult> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearer}`,
      "X-Device-Id": deviceId,
      "X-EA-Version": "1.0.0",
      "X-Request-Id": `dry-run-${Date.now()}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let code: string | undefined;
  let json: Record<string, unknown> | undefined;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
    if (typeof json.code === "string") code = json.code;
  } catch {
    /* ignore */
  }
  const preview = redact(text.slice(0, 200));
  return { status: res.status, code, bodyPreview: preview, json };
}

async function activateOnStaging(
  activationCode: string,
  deviceId: string
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/v1/ea/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      activation_code: activationCode,
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
  return token;
}

class CookieJar {
  private readonly cookies = new Map<string, string>();

  absorb(response: Response) {
    const raw =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [];
    for (const line of raw) {
      const pair = line.split(";")[0];
      const eq = pair.indexOf("=");
      if (eq > 0) {
        this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    }
  }

  header(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function loginStagingDashboard(): Promise<CookieJar> {
  const email = process.env.HOMOLOG_CLIENT_EMAIL?.trim().toLowerCase();
  const password = process.env.HOMOLOG_CLIENT_PASSWORD?.trim();
  if (!email || !password) {
    throw new Error(
      "HOMOLOG_CLIENT_EMAIL e HOMOLOG_CLIENT_PASSWORD necessários para ativação via dashboard staging."
    );
  }

  const jar = new CookieJar();
  const csrfRes = await fetch(`${API_BASE}/api/auth/csrf`, { method: "GET" });
  jar.absorb(csrfRes);
  const csrfJson = (await csrfRes.json()) as { csrfToken?: string };
  if (!csrfJson.csrfToken) {
    throw new Error("CSRF token ausente no staging");
  }

  const loginRes = await fetch(`${API_BASE}/api/auth/signin/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.header(),
    },
    body: new URLSearchParams({
      csrfToken: csrfJson.csrfToken,
      email,
      password,
      callbackUrl: `${API_BASE}/dashboard`,
      redirect: "false",
      json: "true",
    }),
    redirect: "manual",
  });
  jar.absorb(loginRes);
  if (loginRes.status !== 200 && loginRes.status !== 302) {
    const preview = redact((await loginRes.text()).slice(0, 120));
    throw new Error(`Login staging HTTP=${loginRes.status} body=${preview}`);
  }
  console.log("[auth] Sessão dashboard staging obtida (cookie não exibido)");
  return jar;
}

async function resolveBearerViaStagingDashboard(): Promise<{
  bearer: string;
  deviceId: string;
  licenseId: string;
  login: string;
  server: string;
}> {
  const jar = await loginStagingDashboard();

  const subRes = await fetch(`${API_BASE}/api/me/subscription`, {
    headers: { Cookie: jar.header(), Accept: "application/json" },
  });
  jar.absorb(subRes);
  const subCt = subRes.headers.get("content-type") ?? "";
  if (!subRes.ok || !subCt.includes("application/json")) {
    throw new Error(
      `GET /api/me/subscription HTTP=${subRes.status} content-type=${subCt.split(";")[0]}`
    );
  }
  const sub = (await subRes.json()) as {
    licenses?: Array<{
      id: string;
      mt5Account?: { login: string; server: string } | null;
    }>;
  };
  const license = sub.licenses?.find((l) => l.mt5Account?.login);
  if (!license?.mt5Account) {
    throw new Error("Nenhuma licença com MT5 no cliente de homologação staging.");
  }

  const codeRes = await fetch(
    `${API_BASE}/api/me/licenses/${license.id}/activation-code`,
    { method: "POST", headers: { Cookie: jar.header(), Accept: "application/json" } }
  );
  jar.absorb(codeRes);
  if (!codeRes.ok) {
    throw new Error(`POST activation-code HTTP=${codeRes.status}`);
  }
  const codeBody = (await codeRes.json()) as { code?: string };
  if (!codeBody.code) {
    throw new Error("Resposta activation-code sem campo code");
  }

  const deviceId = `dry-run-${Date.now()}`;
  const bearer = await activateOnStaging(codeBody.code, deviceId);

  return {
    bearer,
    deviceId,
    licenseId: license.id,
    login: license.mt5Account.login,
    server: license.mt5Account.server,
  };
}

async function resolveBearer(): Promise<{
  bearer: string;
  deviceId: string;
  licenseId: string;
  login: string;
  server: string;
}> {
  const preset = process.env.STAGING_EA_BEARER_TOKEN?.trim();
  const presetDevice = process.env.STAGING_EA_DEVICE_ID?.trim() ?? "dry-run-vps-001";

  if (preset) {
    const license = await prisma.license.findFirst({
      where: { status: "ACTIVE", mt5Account: { isNot: null } },
      include: { mt5Account: true },
      orderBy: { updatedAt: "desc" },
    });
    if (!license?.mt5Account) {
      const ctx = await resolveBearerViaStagingDashboard();
      return {
        bearer: preset,
        deviceId: presetDevice,
        licenseId: ctx.licenseId,
        login: ctx.login,
        server: ctx.server,
      };
    }
    return {
      bearer: preset,
      deviceId: presetDevice,
      licenseId: license.id,
      login: license.mt5Account.login,
      server: license.mt5Account.server,
    };
  }

  try {
    return await resolveBearerViaStagingDashboard();
  } catch (dashboardErr) {
    console.log(
      `[auth] Dashboard staging falhou: ${dashboardErr instanceof Error ? dashboardErr.message : "erro"} — tentando banco local`
    );
  }

  const email = process.env.HOMOLOG_CLIENT_EMAIL?.trim().toLowerCase();
  const license = await prisma.license.findFirst({
    where: email
      ? { user: { email } }
      : { status: "ACTIVE", mt5Account: { isNot: null } },
    include: { mt5Account: true },
    orderBy: { updatedAt: "desc" },
  });

  if (!license?.mt5Account) {
    throw new Error(
      "Licença com MT5 não encontrada. Vincule MT5 no homolog staging ou defina STAGING_EA_BEARER_TOKEN."
    );
  }

  const { code } = await createActivationCodeForLicense(license.id);
  const deviceId = `dry-run-${Date.now()}`;
  const bearer = await activateOnStaging(code, deviceId);

  return {
    bearer,
    deviceId,
    licenseId: license.id,
    login: license.mt5Account.login,
    server: license.mt5Account.server,
  };
}

function runMigrateIfRequested() {
  const dbUrl = process.env.STAGING_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!dbUrl?.trim()) {
    console.log("[migrate] DATABASE_URL ausente — skip");
    return false;
  }
  if (process.env.APPLY_MIGRATE !== "1") {
    console.log("[migrate] APPLY_MIGRATE não definido — skip deploy");
    return false;
  }
  process.env.DATABASE_URL = dbUrl.trim();
  try {
    const out = execSync("npx prisma migrate deploy", {
      encoding: "utf8",
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    console.log(redact(out));
    execSync("npx prisma generate", { encoding: "utf8", stdio: "pipe" });
    console.log("[migrate] prisma generate OK");
    return true;
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; status?: number };
    if (err.stdout) console.log(redact(String(err.stdout)));
    if (err.stderr) console.error(redact(String(err.stderr)));
    throw new Error("migrate deploy falhou");
  }
}

async function main() {
  const stagingDb = process.env.STAGING_DATABASE_URL?.trim();
  if (stagingDb) {
    process.env.DATABASE_URL = stagingDb;
    console.log("[db] Usando STAGING_DATABASE_URL (host redigido em logs)");
  } else {
    console.log(
      "[db] STAGING_DATABASE_URL ausente — usando DATABASE_URL do .env (confirme se é o mesmo banco do deploy staging)"
    );
  }

  runMigrateIfRequested();

  console.log(`[api] Base: ${API_BASE}`);

  const ctx = await resolveBearer();
  console.log(
    `[auth] Bearer obtido (não exibido). licenseId=${ctx.licenseId} deviceId=${ctx.deviceId} login=${ctx.login}`
  );

  const emptySnap = await httpPost(
    "/api/v1/ea/account-snapshots",
    ctx.bearer,
    {},
    ctx.deviceId
  );
  console.log(
    `[empty] account-snapshots HTTP=${emptySnap.status} code=${emptySnap.code ?? "—"}`
  );

  const emptyProt = await httpPost(
    "/api/v1/ea/execution-protection",
    ctx.bearer,
    {},
    ctx.deviceId
  );
  console.log(
    `[empty] execution-protection HTTP=${emptyProt.status} code=${emptyProt.code ?? "—"}`
  );

  const preMarket = await httpPost(
    "/api/v1/ea/account-snapshots",
    ctx.bearer,
    {
      snapshot_type: "PRE_MARKET",
      account_login: ctx.login,
      account_server: ctx.server,
      environment: "DEMO",
      currency: "BRL",
      balance: 100000,
      equity: 100000,
      margin: 0,
      free_margin: 100000,
      margin_level: 0,
      open_positions: [],
      pending_orders: [],
      active_magic_numbers: [910001],
      captured_at: new Date().toISOString(),
    },
    ctx.deviceId
  );
  console.log(
    `[pre_market] account-snapshots HTTP=${preMarket.status} code=${preMarket.code ?? "—"} preview=${preMarket.bodyPreview}`
  );

  let snapshotId: string | null = null;
  if (preMarket.status >= 200 && preMarket.status < 300) {
    const sid = preMarket.json?.snapshot_id;
    if (typeof sid === "string") snapshotId = sid;

    const row = await prisma.accountSnapshot.findFirst({
      where: { licenseId: ctx.licenseId },
      orderBy: { capturedAt: "desc" },
      select: { id: true, snapshotType: true, accountLogin: true },
    });
    if (row) {
      console.log(
        `[db] snapshot salvo id=${row.id} type=${row.snapshotType} login=${row.accountLogin}`
      );
      snapshotId = row.id;
    }
  }

  const fakeInstructionId = "00000000-0000-4000-8000-000000000001";
  const protInvalid = await httpPost(
    "/api/v1/ea/execution-protection",
    ctx.bearer,
    {
      instruction_id: fakeInstructionId,
      account_login: ctx.login,
      account_server: ctx.server,
      symbol: "WDOM26",
      magic_number: 910001,
      stop_loss_present: true,
      take_profit_present: true,
      stop_loss_price: 100,
      take_profit_price: 110,
      protection_mode: "ATTACHED_SL_TP",
      protection_status: "PROTECTION_CONFIRMED",
      reported_at: new Date().toISOString(),
    },
    ctx.deviceId
  );
  console.log(
    `[protection] instruction inexistente HTTP=${protInvalid.status} code=${protInvalid.code ?? "—"}`
  );

  console.log("\n=== Resumo ===");
  console.log(
    JSON.stringify(
      {
        empty_snap_ok: emptySnap.status === 400,
        empty_prot_ok: emptyProt.status === 400,
        pre_market_ok: preMarket.status >= 200 && preMarket.status < 300,
        snapshot_db_id: snapshotId,
        protection_fake_instruction_http: protInvalid.status,
        protection_fake_code: protInvalid.code,
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
