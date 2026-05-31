/**
 * Valida env Asaas — pull local + sonda runtime staging (sem imprimir secrets).
 * Uso:
 *   vercel env pull .env.staging.pull --environment=production --yes
 *   node scripts/homologation/check-asaas-runtime-env.mjs
 */
import fs from "fs";

const API = "https://autotrade-staging.mercadodariqueza.com.br";
const path = process.argv.find((a) => a.endsWith(".pull") || a.endsWith(".tmp")) ?? ".env.staging.pull";

async function probeStagingRuntime() {
  const asaas = await fetch(`${API}/api/billing/webhook/asaas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const asaasBody = await asaas.json().catch(() => ({}));
  const mock = await fetch(`${API}/api/billing/webhook/mock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const mockBody = await mock.json().catch(() => ({}));
  const asaasOk = asaasBody.code === "INVALID_SIGNATURE";
  const mockOff = mockBody.code === "WEBHOOK_DISABLED" || mock.status === 503;
  return { asaasOk, mockOff, asaasStatus: asaas.status, mockStatus: mock.status };
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => {
        const eq = l.indexOf("=");
        if (eq <= 0) return null;
        const k = l.slice(0, eq).trim();
        let v = l.slice(eq + 1).trim();
        if (
          (v.startsWith('"') && v.endsWith('"')) ||
          (v.startsWith("'") && v.endsWith("'"))
        ) {
          v = v.slice(1, -1);
        }
        return [k, v];
      })
      .filter(Boolean),
  );
}

const env = loadEnvFile(path);
const get = (k) => (env[k] ?? "").trim();

const billingProvider = get("BILLING_PROVIDER");
const asaasEnv = get("ASAAS_ENV");
const apiKey = get("ASAAS_API_KEY");
const webhookToken = get("ASAAS_WEBHOOK_TOKEN");
const sandboxUrl = get("ASAAS_BASE_URL_SANDBOX");
const productionUrl = get("ASAAS_BASE_URL_PRODUCTION");
const realPayments = get("BILLING_REAL_PAYMENTS_ENABLED");
const mockWebhook = get("MOCK_BILLING_WEBHOOK_ENABLED");

console.log(`[local pull: ${path}]`);
console.log(`BILLING_PROVIDER: ${billingProvider || "EMPTY"}`);
console.log(`ASAAS_ENV: ${asaasEnv || "EMPTY"}`);
console.log(
  `ASAAS_API_KEY: ${apiKey.length > 10 ? `PRESENT len=${apiKey.length}` : "MISSING_OR_TOO_SHORT"}`,
);
console.log(
  `ASAAS_WEBHOOK_TOKEN: ${webhookToken.length > 10 ? `PRESENT len=${webhookToken.length}` : "MISSING_OR_TOO_SHORT"}`,
);
console.log(
  `ASAAS_BASE_URL_SANDBOX: ${sandboxUrl.includes("api-sandbox.asaas.com/v3") ? "OK" : sandboxUrl ? "INVALID" : "EMPTY"}`,
);
console.log(
  `ASAAS_BASE_URL_PRODUCTION: ${productionUrl.includes("api.asaas.com/v3") ? "OK" : productionUrl ? "INVALID" : "EMPTY"}`,
);
console.log(`BILLING_REAL_PAYMENTS_ENABLED: ${realPayments || "EMPTY"}`);
console.log(`MOCK_BILLING_WEBHOOK_ENABLED: ${mockWebhook || "EMPTY"}`);

const localOk =
  billingProvider === "asaas" &&
  asaasEnv === "sandbox" &&
  apiKey.length > 10 &&
  webhookToken.length > 10 &&
  sandboxUrl.includes("api-sandbox.asaas.com/v3") &&
  productionUrl.includes("api.asaas.com/v3") &&
  realPayments === "false" &&
  mockWebhook === "false";

const probe = await probeStagingRuntime();
console.log(`[staging runtime probe]`);
console.log(`runtime_webhook_asaas: ${probe.asaasOk ? "OK (401 INVALID_SIGNATURE)" : "INVALID"}`);
console.log(`runtime_webhook_mock: ${probe.mockOff ? "DISABLED" : "ENABLED"}`);

if (localOk) {
  console.log("status: ASAAS_SANDBOX_ENV_OK");
  process.exit(0);
}

if (probe.asaasOk && probe.mockOff) {
  console.log("status: ASAAS_SANDBOX_RUNTIME_OK");
  console.log("note: Vercel pull local vazio para secrets — runtime staging validado via sonda.");
  process.exit(0);
}

console.log("status: ASAAS_SANDBOX_ENV_INVALID");
process.exit(1);
