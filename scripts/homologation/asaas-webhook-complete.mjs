/**
 * Completa smoke Asaas via webhook (token via env, nunca logado).
 * Uso: cmd /c "set ASAAS_WEBHOOK_TOKEN=*** && node scripts/homologation/asaas-webhook-complete.mjs cmptcblws0001jo04wwag9y97 pay_efunfd39uzugpbg9"
 */
const API = "https://autotrade-staging.mercadodariqueza.com.br";
const invoiceId = process.argv[2];
const paymentId = process.argv[3] ?? `pay_smoke_${Date.now()}`;
const token = process.env.ASAAS_WEBHOOK_TOKEN?.trim() ?? "";

if (!invoiceId) {
  console.log("usage: node asaas-webhook-complete.mjs <invoiceId> [paymentId]");
  process.exit(1);
}

if (!token || token.length <= 10) {
  console.log(JSON.stringify({ status: "MISSING_ASAAS_WEBHOOK_TOKEN" }));
  process.exit(1);
}

async function sendWebhook(eventId, eventType, status, paid) {
  const payload = {
    id: eventId,
    event: eventType,
    payment: {
      id: paymentId,
      customer: "cus_smoke",
      value: 300,
      status,
      externalReference: invoiceId,
    },
  };
  const res = await fetch(`${API}/api/billing/webhook/asaas`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "asaas-access-token": token,
    },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const eventId = `evt-1331-${Date.now()}`;
const first = await sendWebhook(eventId, "PAYMENT_CONFIRMED", "CONFIRMED", true);
const dup = await sendWebhook(eventId, "PAYMENT_CONFIRMED", "CONFIRMED", true);
const failLate = await sendWebhook(
  `evt-fail-${Date.now()}`,
  "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED",
  "REFUSED",
  false,
);

console.log(
  JSON.stringify(
    {
      invoiceId,
      paymentIdMasked:
        paymentId.length > 8 ? `${paymentId.slice(0, 6)}…${paymentId.slice(-4)}` : paymentId,
      webhookFirst: first,
      webhookDuplicate: dup,
      webhookLateFail: failLate,
    },
    null,
    2,
  ),
);
