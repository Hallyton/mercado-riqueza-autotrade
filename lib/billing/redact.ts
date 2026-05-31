/** Redige campos sensíveis de payloads de gateway/webhook. */
export function redactBillingPayload(value: unknown): unknown {
  if (value == null || typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.map(redactBillingPayload);
  }

  const sensitive = new Set([
    "secret",
    "token",
    "authorization",
    "password",
    "passwordhash",
    "api_key",
    "apikey",
    "client_secret",
    "webhook_secret",
    "pix_copy_paste",
    "card_number",
    "cvv",
  ]);

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const lower = key.toLowerCase();
    if (sensitive.has(lower) || lower.includes("secret") || lower.includes("token")) {
      out[key] = "[REDACTED]";
      continue;
    }
    if (lower.includes("pix") && typeof val === "string" && val.length > 12) {
      out[key] = `${val.slice(0, 8)}…[REDACTED]`;
      continue;
    }
    out[key] = redactBillingPayload(val);
  }
  return out;
}

export function redactPixCopyPaste(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 12) return "****";
  return `${value.slice(0, 8)}…`;
}
