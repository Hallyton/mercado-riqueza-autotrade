/**
 * Validação centralizada de variáveis críticas (boot + rotas sensíveis).
 * Em produção, ausência de secret impede subida da aplicação e rejeita webhooks.
 */

const PLACEHOLDER_SECRETS = new Set([
  "replace-with-webhook-secret",
  "replace-with-openssl-rand-base64-32",
  "change-me-in-production",
]);

export function isProductionNodeEnv(): boolean {
  return process.env.NODE_ENV === "production";
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_SECRETS.has(value);
}

export type CriticalEnvIssue = {
  variable: string;
  message: string;
};

/** Lista problemas de configuração em produção (vazio = OK). */
export function collectCriticalEnvIssues(): CriticalEnvIssue[] {
  if (!isProductionNodeEnv()) {
    return [];
  }

  const issues: CriticalEnvIssue[] = [];

  const databaseUrl = readEnv("DATABASE_URL");
  if (!databaseUrl) {
    issues.push({
      variable: "DATABASE_URL",
      message: "obrigatória em produção",
    });
  }

  const authSecret = readEnv("AUTH_SECRET");
  if (!authSecret) {
    issues.push({
      variable: "AUTH_SECRET",
      message: "obrigatória em produção",
    });
  } else if (isPlaceholder(authSecret)) {
    issues.push({
      variable: "AUTH_SECRET",
      message: "não pode usar valor de exemplo do .env.example",
    });
  }

  const billingSecret = readEnv("BILLING_WEBHOOK_SECRET");
  if (!billingSecret) {
    issues.push({
      variable: "BILLING_WEBHOOK_SECRET",
      message:
        "obrigatória em produção — webhooks de billing não podem operar sem secret",
    });
  } else if (isPlaceholder(billingSecret)) {
    issues.push({
      variable: "BILLING_WEBHOOK_SECRET",
      message: "não pode usar valor de exemplo do .env.example",
    });
  }

  return issues;
}

export function formatCriticalEnvError(issues: CriticalEnvIssue[]): string {
  const lines = issues.map((i) => `  - ${i.variable}: ${i.message}`);
  return [
    "[Mercado da Riqueza AutoTrade] Configuração inválida para NODE_ENV=production.",
    "Corrija as variáveis de ambiente antes do deploy:",
    ...lines,
  ].join("\n");
}

/** Falha no boot (instrumentation / deploy) se produção estiver mal configurada. */
export function assertCriticalEnvAtStartup(): void {
  const issues = collectCriticalEnvIssues();
  if (issues.length > 0) {
    throw new Error(formatCriticalEnvError(issues));
  }
}

export function getBillingWebhookSecret(): string | undefined {
  const secret = readEnv("BILLING_WEBHOOK_SECRET");
  if (!secret || isPlaceholder(secret)) {
    return undefined;
  }
  return secret;
}

export type BillingWebhookAuthResult =
  | { ok: true }
  | { ok: false; code: "WEBHOOK_MISCONFIGURED" | "WEBHOOK_UNAUTHORIZED" };

/**
 * Em produção: exige BILLING_WEBHOOK_SECRET e header correspondente.
 * Em desenvolvimento/teste: sem secret configurado, aceita (homologação local).
 */
export function verifyBillingWebhookRequest(request: Request): BillingWebhookAuthResult {
  if (isProductionNodeEnv()) {
    const issues = collectCriticalEnvIssues().filter(
      (i) => i.variable === "BILLING_WEBHOOK_SECRET"
    );
    if (issues.length > 0) {
      return { ok: false, code: "WEBHOOK_MISCONFIGURED" };
    }
  }

  const secret = getBillingWebhookSecret();
  if (!secret) {
    return { ok: true };
  }

  const header =
    request.headers.get("x-webhook-secret") ??
    request.headers.get("x-billing-webhook-secret");

  if (header !== secret) {
    return { ok: false, code: "WEBHOOK_UNAUTHORIZED" };
  }

  return { ok: true };
}
