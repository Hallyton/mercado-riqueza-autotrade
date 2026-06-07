import {
  assertDemoAllowed,
  assertLicenseUsable,
  assertMt5AccountAuthorized,
} from "@/lib/ea/auth";
import { processHeartbeat } from "@/lib/ea/heartbeat";
import { withEaAuth } from "@/lib/ea/handler";
import { eaJson } from "@/lib/ea/json";
import { problemJson } from "@/lib/ea/problem";
import { heartbeatBodySchema } from "@/lib/ea/schemas";

export const POST = withEaAuth(
  async (ctx, request) => {
  assertLicenseUsable(ctx);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problemJson(400, "INVALID_JSON", "JSON inválido", "Corpo inválido");
  }

  const parsed = heartbeatBodySchema.safeParse(body);
  if (!parsed.success) {
    return problemJson(400, "VALIDATION_ERROR", "Dados inválidos", parsed.error.message);
  }

  assertMt5AccountAuthorized(ctx, parsed.data.login, parsed.data.server);
  assertDemoAllowed(ctx, parsed.data.trade_mode);

  const result = await processHeartbeat(ctx, parsed.data);
  return eaJson(result);
  },
  { rateLimit: "heartbeat", activitySource: "HEARTBEAT" }
);
