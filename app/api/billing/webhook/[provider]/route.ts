import { jsonError, jsonOk } from "@/lib/api/http";
import {
  BillingWebhookError,
  handleProviderWebhook,
} from "@/lib/billing/webhook-service";

type RouteContext = { params: Promise<{ provider: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { provider } = await context.params;
  const rawBody = await request.text();

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  try {
    const result = await handleProviderWebhook(provider, payload, request, rawBody);
    return jsonOk({ ok: true, ...result });
  } catch (e) {
    if (e instanceof BillingWebhookError) {
      return jsonError(e.message, e.status, e.code);
    }
    console.error("[billing/webhook]", e);
    return jsonError("Webhook processing failed", 500);
  }
}
