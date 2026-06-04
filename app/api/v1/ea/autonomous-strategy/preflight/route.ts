import {
  assertDemoAllowed,
  assertLicenseUsable,
  assertMt5AccountAuthorized,
} from "@/lib/ea/auth";
import { runAutonomousStrategyPreflight } from "@/lib/ea/autonomous-strategy-preflight";
import { withEaAuth } from "@/lib/ea/handler";
import { eaJson } from "@/lib/ea/json";
import { problemJson } from "@/lib/ea/problem";
import { autonomousStrategyPreflightBodySchema } from "@/lib/ea/schemas";

export const POST = withEaAuth(
  async (ctx, request) => {
    assertLicenseUsable(ctx);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return problemJson(400, "INVALID_JSON", "JSON inválido", "Corpo inválido");
    }

    const parsed = autonomousStrategyPreflightBodySchema.safeParse(body);
    if (!parsed.success) {
      return problemJson(400, "VALIDATION_ERROR", "Dados inválidos", parsed.error.message);
    }

    assertMt5AccountAuthorized(
      ctx,
      parsed.data.account_login,
      parsed.data.account_server
    );
    assertDemoAllowed(ctx, parsed.data.trade_mode);

    const result = await runAutonomousStrategyPreflight(ctx, parsed.data);
    return eaJson(result);
  },
  { rateLimit: "instructions" }
);
