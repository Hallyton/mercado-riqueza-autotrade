import { NextResponse } from "next/server";
import { authenticateEaRequest, EaAuthError } from "./auth";
import {
  applyDeviceActivityToContext,
  touchEaDeviceActivity,
  type EaActivitySource,
} from "./device-activity";
import { problemJson } from "./problem";
import type { EaRateLimitScope } from "./rate-limit";
import {
  applyEaRateLimitHeaders,
  checkEaRateLimit,
  type EaRateLimitCheckResult,
  rateLimitProblemResponse,
  recordEaRateLimitBlocked,
} from "./rate-limit";

export type EaContext = Awaited<ReturnType<typeof authenticateEaRequest>>;

type EaHandler = (ctx: EaContext, request: Request) => Promise<NextResponse>;

export type WithEaAuthOptions = {
  rateLimit?: EaRateLimitScope;
  activitySource?: EaActivitySource;
};

const ERROR_TITLES: Record<string, string> = {
  MISSING_TOKEN: "Token ausente",
  INVALID_TOKEN: "Token inválido",
  DEVICE_MISMATCH: "Dispositivo inválido",
  SUBSCRIPTION_INACTIVE: "Assinatura inativa",
  SUBSCRIPTION_EXPIRED: "Assinatura vencida",
  LICENSE_REVOKED: "Licença revogada",
  LICENSE_PENDING: "Licença pendente",
  MT5_NOT_LINKED: "Conta MT5 não vinculada",
  MT5_UNAUTHORIZED: "Conta não autorizada",
  DEMO_NOT_ALLOWED: "Demo não permitida",
};

export function withEaAuth(handler: EaHandler, options?: WithEaAuthOptions) {
  return async (request: Request) => {
    try {
      const ctx = await authenticateEaRequest(request);

      if (options?.activitySource) {
        const activity = await touchEaDeviceActivity({
          deviceId: ctx.device.id,
          licenseId: ctx.license.id,
          source: options.activitySource,
          requestId: ctx.requestId,
        });
        ctx.device = applyDeviceActivityToContext(ctx.device, activity);
      }

      let rl: EaRateLimitCheckResult | undefined;
      if (options?.rateLimit) {
        rl = checkEaRateLimit(request, options.rateLimit);
        if (!rl.allowed) {
          await recordEaRateLimitBlocked(request, rl, {
            license: { id: ctx.license.id, userId: ctx.license.userId },
            device: { id: ctx.device.id, deviceId: ctx.device.deviceId },
          });
          return rateLimitProblemResponse(rl);
        }
      }

      const response = await handler(ctx, request);
      return rl ? applyEaRateLimitHeaders(response, rl) : response;
    } catch (e) {
      if (e instanceof EaAuthError) {
        return problemJson(
          e.status,
          e.code,
          ERROR_TITLES[e.code] ?? "Erro EA",
          e.message
        );
      }
      console.error("[ea]", e);
      return problemJson(
        500,
        "INTERNAL_ERROR",
        "Erro interno",
        "Falha ao processar requisição EA"
      );
    }
  };
}
