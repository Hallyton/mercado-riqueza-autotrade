/**
 * Smoke 13.2.2 — billing admin + webhook (sem imprimir secrets).
 * Uso: vercel env pull .env.staging.pull --environment=production && npx tsx scripts/homologation/billing-admin-webhook-smoke-13222.ts
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const API = "https://autotrade-staging.mercadodariqueza.com.br";
const INVOICE_ID = "cmpt3ahzo0044l70447agvdsg";
const USER_ID = "cmpt1br6z0000ib04icl7nwj7";

function loadPull() {
  const p = resolve(process.cwd(), ".env.staging.pull");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

class Jar {
  private c = new Map<string, string>();
  absorb(r: Response) {
    const raw = typeof r.headers.getSetCookie === "function" ? r.headers.getSetCookie() : [];
    for (const line of raw) {
      const pair = line.split(";")[0];
      const eq = pair.indexOf("=");
      if (eq > 0) this.c.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  h() {
    return [...this.c.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function login(email: string, password: string, cb: string) {
  const jar = new Jar();
  const csrf = await fetch(`${API}/api/auth/csrf`);
  jar.absorb(csrf);
  const { csrfToken } = (await csrf.json()) as { csrfToken?: string };
  const res = await fetch(`${API}/api/auth/signin/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: jar.h() },
    body: new URLSearchParams({
      csrfToken: csrfToken!,
      email,
      password,
      callbackUrl: `${API}${cb}`,
      redirect: "false",
      json: "true",
    }),
    redirect: "manual",
  });
  jar.absorb(res);
  const session = await fetch(`${API}/api/auth/session`, { headers: { Cookie: jar.h() } });
  const sessionJson = (await session.json().catch(() => null)) as {
    user?: { id?: string; appRole?: string };
  } | null;
  return { jar, loginStatus: res.status, session: sessionJson?.user ?? null };
}

async function safeJson(res: Response) {
  const t = await res.text();
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return { preview: t.slice(0, 120), status: res.status };
  }
}

async function main() {
  loadPull();
  const out: Record<string, unknown> = { invoiceId: INVOICE_ID, userId: USER_ID };

  const client = await login(
    "portal-smoke-1313-20260530212108@example.com",
    "PortalSmoke1313!",
    "/dashboard/comercial"
  );
  out.clientSession = client.session ? { id: client.session.id, appRole: client.session.appRole } : null;

  const inv = await fetch(`${API}/api/me/billing/invoices/${INVOICE_ID}`, {
    headers: { Cookie: client.jar.h(), Accept: "application/json" },
  });
  out.invoiceClient = await safeJson(inv);

  const sub = await fetch(`${API}/api/me/subscription`, {
    headers: { Cookie: client.jar.h(), Accept: "application/json" },
  });
  out.subscriptionClient = await safeJson(sub);

  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  if (adminEmail && adminPassword) {
    const admin = await login(adminEmail, adminPassword, "/admin");
    out.adminSession = admin.session
      ? { id: admin.session.id, appRole: admin.session.appRole }
      : null;
    out.adminLoginStatus = admin.loginStatus;

    if (admin.session) {
      const mark = await fetch(`${API}/api/admin/billing/invoices/${INVOICE_ID}/mark-paid`, {
        method: "POST",
        headers: {
          Cookie: admin.jar.h(),
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ confirmationPhrase: "MARCAR FATURA PAGA" }),
      });
      out.adminMarkPaid = { status: mark.status, body: await safeJson(mark) };

      const approvals = await fetch(`${API}/api/admin/real-trading/approvals`, {
        headers: { Cookie: admin.jar.h(), Accept: "application/json" },
      });
      if (approvals.ok) {
        const a = (await approvals.json()) as { items?: Array<{ userId?: string }> };
        out.realApprovalForSmokeUser =
          a.items?.some((x) => x.userId === USER_ID) ?? false;
      }
    }
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const secret = process.env.BILLING_WEBHOOK_SECRET?.trim();
  if (secret) headers["x-webhook-secret"] = secret;

  const eventId = `mock-13222-${Date.now()}`;
  const payload = {
    eventId,
    idempotencyKey: eventId,
    eventType: "payment.approved",
    invoiceId: INVOICE_ID,
    paid: true,
    amountCents: 30000,
  };
  const wh1 = await fetch(`${API}/api/billing/webhook/mock`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const wh2 = await fetch(`${API}/api/billing/webhook/mock`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  out.webhookDup = { first: { status: wh1.status, body: await safeJson(wh1) }, second: { status: wh2.status, body: await safeJson(wh2) } };

  const failLate = {
    eventId: `fail-late-13222-${Date.now()}`,
    idempotencyKey: `fail-late-13222-${Date.now()}`,
    eventType: "payment.failed",
    invoiceId: INVOICE_ID,
    paid: false,
  };
  const whFail = await fetch(`${API}/api/billing/webhook/mock`, {
    method: "POST",
    headers,
    body: JSON.stringify(failLate),
  });
  out.webhookLateFail = { status: whFail.status, body: await safeJson(whFail) };

  const invAfter = await fetch(`${API}/api/me/billing/invoices/${INVOICE_ID}`, {
    headers: { Cookie: client.jar.h(), Accept: "application/json" },
  });
  out.invoiceAfterWebhook = await safeJson(invAfter);

  out.webhookUnknown = (
    await fetch(`${API}/api/billing/webhook/unknown-provider`, {
      method: "POST",
      headers,
      body: "{}",
    })
  ).status;

  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error("SMOKE_FAIL", e instanceof Error ? e.message : e);
  process.exit(1);
});
