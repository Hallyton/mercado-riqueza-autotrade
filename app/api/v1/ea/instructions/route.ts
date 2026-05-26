import {
  assertLicenseUsable,
  assertMt5AccountAuthorized,
  assertSubscriptionActive,
  EaAuthError,
} from "@/lib/ea/auth";
import { withEaAuth } from "@/lib/ea/handler";
import { eaJson } from "@/lib/ea/json";
import {
  auditDeliverableInstructionsForEa,
  evaluateEaRealTradingGuard,
  pullInstructionsForEa,
} from "@/lib/ea/instructions";

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

  const realTradingGuard = await evaluateEaRealTradingGuard(ctx.license.id);
  const instructions = await pullInstructionsForEa(ctx, { realTradingGuard });

  if (process.env.NODE_ENV === "development") {
    const audit = await auditDeliverableInstructionsForEa(ctx.license.id);
    const linked = ctx.license.mt5Account;
    console.info("[ea/instructions]", {
      licenseId: ctx.license.id,
      login: login ?? linked?.login ?? null,
      server: server ?? linked?.server ?? null,
      linkedLogin: linked?.login ?? null,
      linkedServer: linked?.server ?? null,
      statusesSought: ["RECEIVED", "SENT (sem execução)"],
      candidateCount: audit.candidateCount,
      deliverableCount: audit.deliverableCount,
      deliveredCount: instructions.length,
      skipped: audit.skipped,
      subscriptionActive,
      ...(login &&
      server &&
      linked &&
      (linked.login.trim() !== login.trim() ||
        linked.server.trim() !== server.trim())
        ? { notDeliveredReason: "MT5 login/server não conferem com a licença" }
        : {}),
      ...(audit.deliverableCount > 0 && instructions.length === 0
        ? {
            notDeliveredReason:
              "candidatas entregáveis no audit mas pull retornou vazio",
          }
        : {}),
      ...(audit.deliverableCount === 0 && instructions.length === 0
        ? {
            notDeliveredReason:
              audit.skipped.length > 0
                ? "política bloqueou candidatas"
                : audit.candidateCount === 0
                  ? "nenhuma candidata na fila entregável"
                  : undefined,
          }
        : {}),
    });
  }

  return eaJson({
    instructions,
    subscription_active: subscriptionActive,
    ...(!realTradingGuard.allowed
      ? {
          real_trading_blocked: true,
          block_reason: realTradingGuard.code,
        }
      : {}),
    ...(subscriptionNotice ? { notice: subscriptionNotice } : {}),
  });
  },
  { rateLimit: "instructions" }
);
