import { redactBillingPayload } from "@/lib/billing/redact";

/** Redige payloads Asaas antes de persistir/logar. */
export function redactAsaasPayload(value: unknown): unknown {
  const redacted = redactBillingPayload(value);
  if (redacted == null || typeof redacted !== "object" || Array.isArray(redacted)) {
    return redacted;
  }

  const out = { ...(redacted as Record<string, unknown>) };

  if (out.payment && typeof out.payment === "object" && !Array.isArray(out.payment)) {
    const payment = { ...(out.payment as Record<string, unknown>) };
    if (typeof payment.creditCard === "object" && payment.creditCard) {
      payment.creditCard = "[REDACTED]";
    }
    out.payment = payment;
  }

  return out;
}

export function maskAsaasProviderId(id: string | null | undefined): string | null {
  if (!id) return null;
  if (id.length <= 8) return `${id.slice(0, 2)}…`;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}
