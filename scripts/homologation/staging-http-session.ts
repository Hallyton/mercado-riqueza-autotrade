/**
 * Sessão HTTP para homologação staging (login admin/cliente).
 * Não imprime senhas nem cookies completos.
 */
const API_BASE =
  process.env.STAGING_API_BASE_URL?.replace(/\/$/, "") ??
  "https://autotrade-staging.mercadodariqueza.com.br";

export class StagingCookieJar {
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

async function loginCredentials(
  email: string,
  password: string,
  callbackPath: string
): Promise<StagingCookieJar> {
  const jar = new StagingCookieJar();
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
      callbackUrl: `${API_BASE}${callbackPath}`,
      redirect: "false",
      json: "true",
    }),
    redirect: "manual",
  });
  jar.absorb(loginRes);
  if (loginRes.status !== 200 && loginRes.status !== 302) {
    throw new Error(`Login staging HTTP=${loginRes.status} email=${email}`);
  }
  return jar;
}

export async function loginStagingClient(): Promise<StagingCookieJar> {
  const email =
    process.env.STAGING_HOMOLOG_CLIENT_EMAIL?.trim().toLowerCase() ??
    process.env.HOMOLOG_CLIENT_EMAIL?.trim().toLowerCase() ??
    "cliente.staging@mercadodariqueza.com.br";
  const password =
    process.env.STAGING_HOMOLOG_CLIENT_PASSWORD?.trim() ??
    process.env.HOMOLOG_CLIENT_PASSWORD?.trim();
  if (!password) {
    throw new Error(
      "STAGING_HOMOLOG_CLIENT_PASSWORD ou HOMOLOG_CLIENT_PASSWORD necessário para login cliente staging."
    );
  }
  console.log(`[auth] Login cliente staging (${email})`);
  return loginCredentials(email, password, "/dashboard");
}

export async function loginStagingAdmin(): Promise<StagingCookieJar> {
  const email = process.env.STAGING_ADMIN_EMAIL?.trim() ?? process.env.ADMIN_EMAIL?.trim();
  const password =
    process.env.STAGING_ADMIN_PASSWORD?.trim() ?? process.env.ADMIN_PASSWORD?.trim();
  if (!email || !password) {
    throw new Error(
      "STAGING_ADMIN_EMAIL/PASSWORD ou ADMIN_EMAIL/PASSWORD necessários para login admin staging."
    );
  }
  console.log(`[auth] Login admin staging (${email})`);
  return loginCredentials(email, password, "/admin");
}

export async function activateBearerViaClientDashboard(): Promise<{
  bearer: string;
  licenseId: string;
  login: string;
  server: string;
}> {
  const jar = await loginStagingClient();

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
  const license =
    sub.licenses?.find(
      (l) =>
        l.mt5Account?.login === "52609973" &&
        l.mt5Account?.server === "XPMT5-DEMO"
    ) ?? sub.licenses?.find((l) => l.mt5Account?.login);

  if (!license?.mt5Account) {
    throw new Error("Nenhuma licença com MT5 no cliente staging.");
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

  const deviceId = `dry-run-protection-${Date.now()}`;
  const actRes = await fetch(`${API_BASE}/api/v1/ea/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      activation_code: codeBody.code,
      device_id: deviceId,
      ea_version: "1.0.0",
    }),
  });
  const actJson = (await actRes.json()) as { device_token?: string; code?: string };
  if (actRes.status < 200 || actRes.status >= 300) {
    throw new Error(
      `POST /ea/activate HTTP=${actRes.status} code=${String(actJson.code ?? "—")}`
    );
  }
  if (!actJson.device_token) {
    throw new Error("Ativação staging sem device_token");
  }

  return {
    bearer: actJson.device_token,
    licenseId: license.id,
    login: license.mt5Account.login,
    server: license.mt5Account.server,
  };
}

export async function createHomologationInstructionViaAdmin(
  jar: StagingCookieJar,
  licenseId: string,
  note: string
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/admin/instructions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: jar.header(),
      Accept: "application/json",
    },
    body: JSON.stringify({
      license_id: licenseId,
      source: "HOMOLOGATION",
      purpose: "ENTRY",
      symbol: "WDOM26",
      side: "BUY",
      order_type: "MARKET",
      quantity: 1,
      expires_in_minutes: 1440,
      magic_number: 910001,
      account_login: "52609973",
      account_server: "XPMT5-DEMO",
      requires_protection_confirmation: true,
      note,
    }),
  });
  const text = await res.text();
  let json: { instructionId?: string; code?: string; message?: string } = {};
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    /* ignore */
  }
  if (res.status < 200 || res.status >= 300 || !json.instructionId) {
    throw new Error(
      `POST admin/instructions HTTP=${res.status} code=${String(json.code ?? "—")} msg=${String(json.message ?? text.slice(0, 120) ?? "—")}`
    );
  }
  return json.instructionId;
}

export function isLocalDatabaseUrl(url?: string | null): boolean {
  const u = (url ?? process.env.DATABASE_URL ?? "").toLowerCase();
  return (
    !u ||
    u.includes("localhost") ||
    u.includes("127.0.0.1") ||
    u.includes("@host.docker.internal")
  );
}
