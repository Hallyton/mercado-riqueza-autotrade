/**
 * Fase 13.4 — Commercial & Billing Final Consolidation smoke (sem imprimir secrets).
 * Uso: vercel env pull .env.staging.pull --environment=production --yes
 *      npx tsx scripts/homologation/phase-13-4-final-consolidation-smoke.ts
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const API = "https://autotrade-staging.mercadodariqueza.com.br";
const SMOKE_EMAIL = "portal-smoke-1313-20260530212108@example.com";
const SMOKE_PASSWORD = "PortalSmoke1313!";
const USER_ID = "cmpt1br6z0000ib04icl7nwj7";
const SUBSCRIPTION_ID = "cmpt1brdo0002ib049ajziz2e";

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

function maskId(id: string | null | undefined): string | null {
  if (!id || id.length < 8) return id ?? null;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
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
  const out: Record<string, unknown> = {
    phase: "13.4",
    api: API,
    smokeUser: SMOKE_EMAIL,
    userId: USER_ID,
  };

  const envCheck = {
    BILLING_PROVIDER: process.env.BILLING_PROVIDER?.trim() || "EMPTY",
    ASAAS_ENV: process.env.ASAAS_ENV?.trim() || "EMPTY",
    BILLING_REAL_PAYMENTS_ENABLED:
      process.env.BILLING_REAL_PAYMENTS_ENABLED?.trim() || "EMPTY",
    ASAAS_API_KEY: process.env.ASAAS_API_KEY?.trim()
      ? `SET(len=${process.env.ASAAS_API_KEY.trim().length})`
      : "EMPTY",
    ASAAS_WEBHOOK_TOKEN: process.env.ASAAS_WEBHOOK_TOKEN?.trim()
      ? `SET(len=${process.env.ASAAS_WEBHOOK_TOKEN.trim().length})`
      : "EMPTY",
  };
  out.vercelEnvPull = envCheck;
  out.asaasE2ePossible =
    envCheck.ASAAS_API_KEY !== "EMPTY" &&
    envCheck.ASAAS_WEBHOOK_TOKEN !== "EMPTY" &&
    envCheck.BILLING_PROVIDER === "asaas" &&
    envCheck.ASAAS_ENV === "sandbox" &&
    envCheck.BILLING_REAL_PAYMENTS_ENABLED === "false";

  for (const path of ["/planos", "/cadastro", "/termos/autotrade"]) {
    const res = await fetch(`${API}${path}`);
    out[`public${path.replace(/\//g, "_")}`] = { status: res.status, ok: res.ok };
  }

  const client = await login(SMOKE_EMAIL, SMOKE_PASSWORD, "/dashboard/comercial");
  out.clientLogin = {
    status: client.loginStatus,
    session: client.session ? { id: client.session.id, appRole: client.session.appRole } : null,
  };

  const portal = await fetch(`${API}/dashboard/comercial`, {
    headers: { Cookie: client.jar.h() },
    redirect: "manual",
  });
  out.portalDashboard = { status: portal.status };

  const adminDenied = await fetch(`${API}/admin`, {
    headers: { Cookie: client.jar.h() },
    redirect: "manual",
  });
  out.clientAdminDenied = adminDenied.status === 307 || adminDenied.status === 302 || adminDenied.status === 403;

  const sub = await fetch(`${API}/api/me/subscription`, {
    headers: { Cookie: client.jar.h(), Accept: "application/json" },
  });
  out.subscription = await safeJson(sub);

  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  if (adminEmail && adminPassword) {
    const admin = await login(adminEmail, adminPassword, "/admin");
    out.adminLogin = {
      status: admin.loginStatus,
      session: admin.session ? { id: admin.session.id, appRole: admin.session.appRole } : null,
    };

    if (admin.session) {
      const createInv = await fetch(`${API}/api/admin/billing/invoices`, {
        method: "POST",
        headers: {
          Cookie: admin.jar.h(),
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          subscriptionId: SUBSCRIPTION_ID,
          amountCents: 30000,
          description: "Fase 13.4 mark-paid fresh PENDING smoke",
        }),
      });
      const createBody = (await safeJson(createInv)) as { invoiceId?: string; error?: string };
      out.freshInvoiceCreate = { status: createInv.status, body: createBody };
      const freshInvoiceId = createBody.invoiceId;

      if (freshInvoiceId) {
        out.freshInvoiceId = freshInvoiceId;

        const mark = await fetch(`${API}/api/admin/billing/invoices/${freshInvoiceId}/mark-paid`, {
          method: "POST",
          headers: {
            Cookie: admin.jar.h(),
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ confirmationPhrase: "MARCAR FATURA PAGA" }),
        });
        out.freshMarkPaid = { status: mark.status, body: await safeJson(mark) };

        const invAfter = await fetch(`${API}/api/me/billing/invoices/${freshInvoiceId}`, {
          headers: { Cookie: client.jar.h(), Accept: "application/json" },
        });
        const invJson = (await safeJson(invAfter)) as {
          status?: string;
          paidAt?: string | null;
          provider?: string;
          providerPaymentId?: string | null;
        };
        out.freshInvoiceAfterMarkPaid = {
          status: invJson.status,
          paidAt: invJson.paidAt ?? null,
          provider: invJson.provider,
          providerPaymentIdMasked: maskId(invJson.providerPaymentId ?? undefined),
        };

        if (envCheck.BILLING_PROVIDER === "asaas" && envCheck.ASAAS_API_KEY !== "EMPTY") {
          const asaasCreate = await fetch(
            `${API}/api/admin/billing/invoices/${freshInvoiceId}/asaas/create-payment`,
            {
              method: "POST",
              headers: {
                Cookie: admin.jar.h(),
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({}),
            }
          );
          out.asaasCreatePayment = { status: asaasCreate.status, body: await safeJson(asaasCreate) };
        } else {
          out.asaasCreatePayment = { skipped: true, reason: "ASAAS_NOT_CONFIGURED_ON_STAGING" };
        }
      }

      const approvals = await fetch(`${API}/api/admin/real-trading/approvals`, {
        headers: { Cookie: admin.jar.h(), Accept: "application/json" },
      });
      if (approvals.ok) {
        const a = (await approvals.json()) as { items?: Array<{ userId?: string }> };
        out.realApprovalForSmokeUser = a.items?.some((x) => x.userId === USER_ID) ?? false;
      }
    }
  } else {
    out.adminLogin = { skipped: true, reason: "ADMIN_CREDENTIALS_MISSING_IN_PULL" };
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const secret = process.env.BILLING_WEBHOOK_SECRET?.trim();
  if (secret) headers["x-webhook-secret"] = secret;

  const mockEventId = `mock-134-${Date.now()}`;
  const whDup1 = await fetch(`${API}/api/billing/webhook/mock`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      eventId: mockEventId,
      idempotencyKey: mockEventId,
      eventType: "payment.approved",
      invoiceId: out.freshInvoiceId ?? "cmpt3ahzo0044l70447agvdsg",
      paid: true,
      amountCents: 30000,
    }),
  });
  const whDup2 = await fetch(`${API}/api/billing/webhook/mock`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      eventId: mockEventId,
      idempotencyKey: mockEventId,
      eventType: "payment.approved",
      invoiceId: out.freshInvoiceId ?? "cmpt3ahzo0044l70447agvdsg",
      paid: true,
      amountCents: 30000,
    }),
  });
  out.mockWebhookIdempotency = {
    first: { status: whDup1.status, body: await safeJson(whDup1) },
    second: { status: whDup2.status, body: await safeJson(whDup2) },
  };

  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error("SMOKE_FAIL", e instanceof Error ? e.message : e);
  process.exit(1);
});
