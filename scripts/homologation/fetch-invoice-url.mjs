/** Fetch invoice payment URL for smoke (no secrets). */
const API = "https://autotrade-staging.mercadodariqueza.com.br";
const EMAIL = "portal-smoke-1313-20260530212108@example.com";
const PASS = "PortalSmoke1313!";
const INVOICE_ID = process.argv[2] ?? "cmptcblws0001jo04wwag9y97";

class Jar {
  c = new Map();
  absorb(r) {
    for (const line of typeof r.headers.getSetCookie === "function" ? r.headers.getSetCookie() : []) {
      const p = line.split(";")[0];
      const eq = p.indexOf("=");
      if (eq > 0) this.c.set(p.slice(0, eq).trim(), p.slice(eq + 1).trim());
    }
  }
  h() {
    return [...this.c.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function login() {
  const jar = new Jar();
  const csrf = await fetch(`${API}/api/auth/csrf`, { headers: { Cookie: jar.h() } });
  jar.absorb(csrf);
  const { csrfToken } = await csrf.json();
  const s = await fetch(`${API}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: jar.h() },
    body: new URLSearchParams({ csrfToken, email: EMAIL, password: PASS, callbackUrl: `${API}/dashboard/comercial`, json: "true" }),
    redirect: "manual",
  });
  jar.absorb(s);
  return jar;
}

const jar = await login();
const res = await fetch(`${API}/api/me/billing/invoices/${INVOICE_ID}`, {
  headers: { Cookie: jar.h(), Accept: "application/json" },
});
const data = await res.json();
const inv = data.invoice ?? data;
console.log(JSON.stringify({
  provider: inv.provider,
  status: inv.status,
  amountCents: inv.amountCents,
  hasPaymentUrl: Boolean(inv.paymentUrl || inv.checkoutUrl),
  paymentUrlHost: inv.paymentUrl ? new URL(inv.paymentUrl).host : null,
  hasPix: Boolean(inv.pixCopyPaste),
}, null, 2));
