import { createAuditLog } from "@/lib/audit/log";
import { jsonError, jsonOk } from "@/lib/api/http";
import { handleBillingWebhook } from "@/lib/billing/webhook-handler";
import { billingWebhookEventSchema } from "@/lib/billing/webhook-types";
import {
  assertCriticalEnvAtStartup,
  verifyBillingWebhookRequest,
} from "@/lib/env/critical";
import { AuditActorType } from "@prisma/client";

export async function POST(request: Request) {
  assertCriticalEnvAtStartup();

  const auth = verifyBillingWebhookRequest(request);
  if (!auth.ok) {
    await createAuditLog({
      actorType: AuditActorType.SYSTEM,
      action: "webhook.rejected",
      entityType: "webhook",
      metadata: {
        reason:
          auth.code === "WEBHOOK_MISCONFIGURED"
            ? "billing_webhook_secret_missing"
            : "invalid_secret",
      },
      ipAddress: request.headers.get("x-forwarded-for"),
    });

    if (auth.code === "WEBHOOK_MISCONFIGURED") {
      return jsonError(
        "Billing webhook not configured: set BILLING_WEBHOOK_SECRET in production",
        503,
        auth.code
      );
    }

    return jsonError("Unauthorized", 401, auth.code);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = billingWebhookEventSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.message, 400, "VALIDATION_ERROR");
  }

  try {
    const result = await handleBillingWebhook(parsed.data);
    return jsonOk({
      ok: true,
      duplicate: result.duplicate,
      subscriptionId: result.subscriptionId,
      error: "error" in result ? result.error : undefined,
    });
  } catch (error) {
    console.error("[webhook/billing]", error);
    return jsonError("Webhook processing failed", 500);
  }
}
