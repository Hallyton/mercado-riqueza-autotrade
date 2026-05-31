/**
 * Sonda runtime Asaas no staging — sem imprimir secrets.
 * Uso: node scripts/homologation/probe-asaas-runtime-staging.mjs
 */
const API = "https://autotrade-staging.mercadodariqueza.com.br";

async function probeWebhook() {
  const res = await fetch(`${API}/api/billing/webhook/asaas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, code: body.code ?? body.error ?? null };
}

async function probeMockWebhook() {
  const res = await fetch(`${API}/api/billing/webhook/mock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, code: body.code ?? body.error ?? null };
}

async function main() {
  const asaas = await probeWebhook();
  const mock = await probeMockWebhook();

  console.log("runtime_webhook_asaas:", asaas);
  console.log("runtime_webhook_mock:", mock);

  // Asaas configured: webhook allowed → 401 INVALID_SIGNATURE (not 503 WEBHOOK_DISABLED)
  const asaasRuntimeOk =
    asaas.code === "INVALID_SIGNATURE" ||
    asaas.code === "Invalid JSON" ||
    (asaas.status === 400 && asaas.code !== "WEBHOOK_DISABLED");

  const mockDisabled =
    mock.code === "WEBHOOK_DISABLED" || mock.status === 503;

  console.log(
    "runtime_asaas_provider_likely:",
    asaasRuntimeOk ? "YES" : "NO",
  );
  console.log("runtime_mock_disabled:", mockDisabled ? "YES" : "NO");

  const ok = asaasRuntimeOk && mockDisabled;
  console.log(`status: ${ok ? "ASAAS_SANDBOX_RUNTIME_OK" : "ASAAS_SANDBOX_RUNTIME_INVALID"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("PROBE_FAIL", e.message);
  process.exit(1);
});
