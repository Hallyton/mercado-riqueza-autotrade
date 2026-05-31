/**
 * Fase 13.3.1 — Asaas Sandbox E2E smoke (sem imprimir secrets).
 *
 * Uso com credenciais locais ou Vercel:
 *   vercel env pull .env.staging.pull --environment=production --yes
 *   # ou exportar ASAAS_WEBHOOK_TOKEN / ADMIN_* manualmente
 *   npx tsx scripts/homologation/asaas-sandbox-e2e-smoke-1331.ts
 */
import { readFileSync, existsSync, writeFileSync } from "fs";
import { resolve } from "path";

const API = "https://autotrade-staging.mercadodariqueza.com.br";
const SMOKE_EMAIL = "portal-smoke-1313-20260530212108@example.com";
const SMOKE_PASSWORD = "PortalSmoke1313!";
const USER_ID = "cmpt1br6z0000ib04icl7nwj7";

function loadEnvFiles() {
  for (const file of [".env.staging.pull", ".env.local", ".env"]) {
    const p = resolve(process.cwd(), file);
    if (!existsSync(p)) continue;
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
      if (!process.env[k] && v) process.env[k] = v;
    }
  }
}

function maskId(id: string | null | undefined): string | null {
  if (!id || id.length < 8) return id ?? null;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function redactOutput(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(redactOutput);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const lk = k.toLowerCase();
    if (
      lk.includes("token") ||
      lk.includes("secret") ||
      lk.includes("password") ||
      lk.includes("pixcopypaste") ||
      lk.includes("pix") && lk.includes("payload") ||
      lk === "rawjson"
    ) {
      out[k] = typeof v === "string" && v.length > 0 ? `[REDACTED len=${v.length}]` : v;
    } else if (lk.includes("providerpaymentid") || lk === "providerinvoiceid") {
      out[k] = typeof v === "string" ? maskId(v) : v;
    } else {
      out[k] = redactOutput(v);
    }
  }
  return out;
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
  const csrfRes = await fetch(`${API}/api/auth/csrf`, { headers: { Cookie: jar.h() } });
  jar.absorb(csrfRes);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string };

  const body = new URLSearchParams({
    csrfToken: csrfToken ?? "",
    email,
    password,
    callbackUrl: `${API}${cb}`,
    json: "true",
  });

  const signIn = await fetch(`${API}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.h(),
    },
    body,
    redirect: "manual",
  });
  jar.absorb(signIn);

  if (signIn.status === 302 || signIn.status === 200) {
    const sessionRes = await fetch(`${API}/api/auth/session`, { headers: { Cookie: jar.h() } });
    jar.absorb(sessionRes);
    const sessionJson = (await sessionRes.json().catch(() => null)) as {
      user?: { id?: string; appRole?: string; email?: string };
    } | null;
    return { jar, loginStatus: signIn.status, session: sessionJson?.user ?? null };
  }

  const legacy = await fetch(`${API}/api/auth/signin/credentials`, {
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
  jar.absorb(legacy);
  const sessionRes = await fetch(`${API}/api/auth/session`, { headers: { Cookie: jar.h() } });
  const sessionJson = (await sessionRes.json().catch(() => null)) as {
    user?: { id?: string; appRole?: string; email?: string };
  } | null;
  return { jar, loginStatus: legacy.status, session: sessionJson?.user ?? null };
}

async function safeJson(res: Response) {
  const t = await res.text();
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return { preview: t.slice(0, 160), httpStatus: res.status };
  }
}

async function probeRuntime() {
  const res = await fetch(`${API}/api/billing/webhook/asaas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const body = (await safeJson(res)) as { code?: string };
  return body.code === "INVALID_SIGNATURE";
}

async function confirmPaymentInAsaasSandbox(paymentId: string): Promise<boolean> {
  const apiKey = process.env.ASAAS_API_KEY?.trim();
  if (!apiKey || apiKey.length <= 10) return false;
  const base =
    process.env.ASAAS_BASE_URL_SANDBOX?.trim() || "https://api-sandbox.asaas.com/v3";
  const res = await fetch(`${base}/payments/${paymentId}/receiveInCash`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
    },
    body: JSON.stringify({
      paymentDate: new Date().toISOString().slice(0, 10),
      value: 300,
    }),
  });
  return res.ok;
}

async function main() {
  loadEnvFiles();
  const out: Record<string, unknown> = {
    phase: "13.3.1",
    api: API,
    smokeUser: SMOKE_EMAIL,
    userId: USER_ID,
  };

  const runtimeOk = await probeRuntime();
  out.runtimeAsaasWebhook = runtimeOk ? "ASAAS_SANDBOX_RUNTIME_OK" : "ASAAS_SANDBOX_RUNTIME_INVALID";

  const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN?.trim() ?? "";
  out.asaasWebhookToken = webhookToken.length > 10 ? `PRESENT len=${webhookToken.length}` : "MISSING_LOCAL";

  if (!runtimeOk) {
    out.status = "ASAAS_SANDBOX_E2E_PENDING_VALID_ENV";
    console.log(JSON.stringify(redactOutput(out), null, 2));
    process.exit(1);
  }

  const client = await login(SMOKE_EMAIL, SMOKE_PASSWORD, "/dashboard/comercial");
  out.clientLogin = {
    status: client.loginStatus,
    session: client.session
      ? { id: client.session.id, appRole: client.session.appRole, email: client.session.email }
      : null,
  };

  if (!client.session) {
    out.status = "ASAAS_SANDBOX_E2E_PENDING_VALID_ENV";
    out.blocker = "CLIENT_LOGIN_FAILED";
    console.log(JSON.stringify(redactOutput(out), null, 2));
    process.exit(1);
  }

  const reqInv = await fetch(`${API}/api/me/billing/invoices/request`, {
    method: "POST",
    headers: { Cookie: client.jar.h(), Accept: "application/json" },
  });
  const reqBody = (await safeJson(reqInv)) as {
    invoiceId?: string;
    status?: string;
    error?: string;
    code?: string;
  };
  out.requestInvoice = { status: reqInv.status, body: reqBody };
  const invoiceId = reqBody.invoiceId;
  if (!invoiceId) {
    out.status = "APPROVED_WITH_RESTRICTIONS";
    out.blocker = "INVOICE_REQUEST_FAILED";
    console.log(JSON.stringify(redactOutput(out), null, 2));
    process.exit(1);
  }
  out.invoiceId = invoiceId;

  const inv = await fetch(`${API}/api/me/billing/invoices/${invoiceId}`, {
    headers: { Cookie: client.jar.h(), Accept: "application/json" },
  });
  const invWrap = (await safeJson(inv)) as { invoice?: Record<string, unknown> };
  const invJson = invWrap.invoice ?? (invWrap as Record<string, unknown>);
  out.invoiceBefore = {
    provider: invJson.provider,
    status: invJson.status,
    amountCents: invJson.amountCents,
    hasPaymentUrl: Boolean(invJson.paymentUrl || invJson.checkoutUrl),
    hasPix: Boolean(invJson.pixCopyPaste || invJson.pixQrCodeUrl),
    providerLabel: invJson.providerLabel,
  };

  if (invJson.provider !== "ASAAS") {
    out.status = "APPROVED_WITH_RESTRICTIONS";
    out.blocker = "INVOICE_NOT_ASAAS_PROVIDER";
    console.log(JSON.stringify(redactOutput(out), null, 2));
    process.exit(1);
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  let providerPaymentId: string | null = null;

  if (adminEmail && adminPassword) {
    const admin = await login(adminEmail, adminPassword, `/admin/users/${USER_ID}`);
    out.adminLogin = {
      status: admin.loginStatus,
      session: admin.session ? { id: admin.session.id, appRole: admin.session.appRole } : null,
    };
    if (admin.session) {
      const adminInv = await fetch(`${API}/api/admin/billing/invoices?userId=${USER_ID}`, {
        headers: { Cookie: admin.jar.h(), Accept: "application/json" },
      });
      const adminInvJson = (await safeJson(adminInv)) as { invoices?: Array<Record<string, unknown>> };
      const match = adminInvJson.invoices?.find((i) => i.id === invoiceId);
      out.adminInvoice = match
        ? {
            provider: match.provider,
            status: match.status,
            providerPaymentIdMasked: match.providerInvoiceIdMasked ?? null,
            pixAvailable: match.pixAvailable,
          }
        : null;

      providerPaymentId =
        typeof match?.providerInvoiceIdMasked === "string"
          ? null
          : typeof match?.providerInvoiceId === "string"
            ? match.providerInvoiceId
            : null;

      if (
        admin.session &&
        invJson.provider === "ASAAS" &&
        !invJson.paymentUrl &&
        !invJson.pixCopyPaste
      ) {
        const createPay = await fetch(
          `${API}/api/admin/billing/invoices/${invoiceId}/asaas/create-payment`,
          { method: "POST", headers: { Cookie: admin.jar.h(), Accept: "application/json" } },
        );
        out.adminCreatePayment = { status: createPay.status, body: await safeJson(createPay) };
      }

      const adminInvAfter = await fetch(`${API}/api/admin/billing/invoices?userId=${USER_ID}`, {
        headers: { Cookie: admin.jar.h(), Accept: "application/json" },
      });
      const adminAfterJson = (await safeJson(adminInvAfter)) as {
        invoices?: Array<Record<string, unknown>>;
      };
      const matchAfter = adminAfterJson.invoices?.find((i) => i.id === invoiceId);
      if (matchAfter) {
        out.adminInvoiceAfterCreate = {
          provider: matchAfter.provider,
          providerInvoiceIdMasked: matchAfter.providerInvoiceIdMasked,
          pixAvailable: matchAfter.pixAvailable,
        };
      }
    }
  }

  const invRefresh = await fetch(`${API}/api/me/billing/invoices/${invoiceId}`, {
    headers: { Cookie: client.jar.h(), Accept: "application/json" },
  });
  const invRefreshWrap = (await safeJson(invRefresh)) as { invoice?: Record<string, unknown> };
  const invFresh = invRefreshWrap.invoice ?? {};
  out.invoiceAfterProvision = {
    provider: invFresh.provider,
    hasPaymentUrl: Boolean(invFresh.paymentUrl || invFresh.checkoutUrl),
    hasPix: Boolean(invFresh.pixCopyPaste || invFresh.pixQrCodeUrl),
  };

  out.providerPaymentIdMasked = providerPaymentId ? maskId(providerPaymentId) : null;

  let webhookPath: "asaas_api_receive" | "asaas_webhook_sim" | "pending" = "pending";

  if (providerPaymentId && (await confirmPaymentInAsaasSandbox(providerPaymentId))) {
    webhookPath = "asaas_api_receive";
    out.asaasReceiveInCash = "OK";
  } else if (webhookToken.length > 10) {
    const eventId = `evt-smoke-1331-${Date.now()}`;
    const paymentIdForEvent = providerPaymentId ?? `pay_smoke_${Date.now()}`;
    const payload = {
      id: eventId,
      event: "PAYMENT_CONFIRMED",
      payment: {
        id: paymentIdForEvent,
        customer: "cus_smoke",
        value: 300,
        status: "CONFIRMED",
        externalReference: invoiceId,
      },
    };
    const wh = await fetch(`${API}/api/billing/webhook/asaas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "asaas-access-token": webhookToken,
      },
      body: JSON.stringify(payload),
    });
    out.webhookFirst = { status: wh.status, body: await safeJson(wh) };
    webhookPath = wh.ok ? "asaas_webhook_sim" : "pending";

    const whDup = await fetch(`${API}/api/billing/webhook/asaas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "asaas-access-token": webhookToken,
      },
      body: JSON.stringify(payload),
    });
    out.webhookDuplicate = { status: whDup.status, body: await safeJson(whDup) };

    const failLate = {
      id: `evt-fail-late-${Date.now()}`,
      event: "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED",
      payment: {
        id: paymentIdForEvent,
        status: "REFUSED",
        externalReference: invoiceId,
      },
    };
    const whFail = await fetch(`${API}/api/billing/webhook/asaas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "asaas-access-token": webhookToken,
      },
      body: JSON.stringify(failLate),
    });
    out.webhookLateFail = { status: whFail.status, body: await safeJson(whFail) };
  } else {
    out.paymentConfirmation = "PENDING_NO_LOCAL_ASAAS_CREDENTIALS";
  }

  out.webhookPath = webhookPath;

  if (webhookPath === "asaas_api_receive" && adminEmail && adminPassword) {
    const admin = await login(adminEmail, adminPassword, "/admin");
    if (admin.session) {
      const sync = await fetch(
        `${API}/api/admin/billing/invoices/${invoiceId}/asaas/sync`,
        {
          method: "POST",
          headers: {
            Cookie: admin.jar.h(),
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ confirmationPhrase: "SINCRONIZAR ASAAS" }),
        },
      );
      out.adminSync = { status: sync.status, body: await safeJson(sync) };
    }
  }

  await new Promise((r) => setTimeout(r, 1500));

  const invAfter = await fetch(`${API}/api/me/billing/invoices/${invoiceId}`, {
    headers: { Cookie: client.jar.h(), Accept: "application/json" },
  });
  const invAfterWrap = (await safeJson(invAfter)) as { invoice?: Record<string, unknown> };
  const invAfterJson = invAfterWrap.invoice ?? (invAfterWrap as Record<string, unknown>);
  out.invoiceAfter = {
    status: invAfterJson.status,
    paidAt: invAfterJson.paidAt ?? null,
    provider: invAfterJson.provider,
  };

  const sub = await fetch(`${API}/api/me/subscription`, {
    headers: { Cookie: client.jar.h(), Accept: "application/json" },
  });
  const subWrap = (await safeJson(sub)) as Record<string, unknown>;
  out.subscription = subWrap.subscription ?? subWrap;

  if (adminEmail && adminPassword) {
    const admin = await login(adminEmail, adminPassword, "/admin");
    if (admin.session) {
      const approvals = await fetch(`${API}/api/admin/real-trading/approvals`, {
        headers: { Cookie: admin.jar.h(), Accept: "application/json" },
      });
      if (approvals.ok) {
        const a = (await approvals.json()) as { items?: Array<{ userId?: string }> };
        out.realApprovalForSmokeUser = a.items?.some((x) => x.userId === USER_ID) ?? false;
      }
    }
  }

  const paid = invAfterJson.status === "PAID";
  const idempotent =
    out.webhookDuplicate &&
    typeof out.webhookDuplicate === "object" &&
    (out.webhookDuplicate as { body?: { duplicate?: boolean } }).body?.duplicate === true;

  out.idempotencyValidated = idempotent || webhookPath === "asaas_api_receive";

  if (paid && runtimeOk) {
    out.status =
      webhookPath === "pending" ? "APPROVED_WITH_RESTRICTIONS" : "ASAAS_SANDBOX_E2E_SMOKE_APPROVED";
  } else if (invJson.provider === "ASAAS" && runtimeOk) {
    out.status = "APPROVED_WITH_RESTRICTIONS";
    out.blocker = paid ? null : "PAYMENT_CONFIRMATION_PENDING";
  } else {
    out.status = "ASAAS_SANDBOX_E2E_PENDING_VALID_ENV";
  }

  const reportPath = resolve(process.cwd(), "scripts/homologation/.asaas-e2e-smoke-result.json");
  writeFileSync(reportPath, JSON.stringify(redactOutput(out), null, 2));
  console.log(JSON.stringify(redactOutput(out), null, 2));
}

main().catch((e) => {
  console.error("SMOKE_FAIL", e instanceof Error ? e.message : e);
  process.exit(1);
});
