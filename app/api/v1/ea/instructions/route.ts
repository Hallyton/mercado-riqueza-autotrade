import {
  assertLicenseUsable,
  assertMt5AccountAuthorized,
  assertSubscriptionActive,
  EaAuthError,
} from "@/lib/ea/auth";
import { withEaAuth } from "@/lib/ea/handler";
import { eaJson } from "@/lib/ea/json";
import { pullInstructionsForEa } from "@/lib/ea/instructions";

export const GET = withEaAuth(
  async (ctx, request) => {
  assertLicenseUsable(ctx);

  const url = new URL(request.url);
  const login = url.searchParams.get("login");
  const server = url.searchParams.get("server");

  if (login && server) {
    assertMt5AccountAuthorized(ctx, login, server);
  }

  let subscriptionActive = true;
  let subscriptionNotice: string | undefined;
  try {
    assertSubscriptionActive(ctx);
  } catch (e) {
    subscriptionActive = false;
    if (e instanceof EaAuthError) {
      subscriptionNotice =
        "Assinatura inativa: novas entradas bloqueadas; gestão de posição aberta mantida.";
    }
  }

  const instructions = await pullInstructionsForEa(ctx);
  return eaJson({
    instructions,
    subscription_active: subscriptionActive,
    ...(subscriptionNotice ? { notice: subscriptionNotice } : {}),
  });
  },
  { rateLimit: "instructions" }
);
