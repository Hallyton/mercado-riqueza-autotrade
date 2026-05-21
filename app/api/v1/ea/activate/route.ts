import { activateEaDevice } from "@/lib/ea/activate";
import { eaJson } from "@/lib/ea/json";
import { problemJson } from "@/lib/ea/problem";
import {
  checkEaRateLimit,
  rateLimitProblemResponse,
  recordEaRateLimitBlocked,
} from "@/lib/ea/rate-limit";
import { activateBodySchema } from "@/lib/ea/schemas";
import { buildEaConfigResponse } from "@/lib/ea/config";
import { readEaHeaders } from "@/lib/ea/auth";
import { hashToken } from "@/lib/ea/token";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  const rateLimit = checkEaRateLimit(request, "activate");
  if (!rateLimit.allowed) {
    await recordEaRateLimitBlocked(request, rateLimit);
    return rateLimitProblemResponse(rateLimit);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problemJson(400, "INVALID_JSON", "JSON inválido", "Corpo da requisição inválido");
  }

  const parsed = activateBodySchema.safeParse(body);
  if (!parsed.success) {
    return problemJson(400, "VALIDATION_ERROR", "Dados inválidos", parsed.error.message);
  }

  const headers = readEaHeaders(request);
  const result = await activateEaDevice({
    activationCode: parsed.data.activation_code,
    deviceId: parsed.data.device_id,
    fingerprint: parsed.data.fingerprint,
    eaVersion: parsed.data.ea_version,
    requestId: headers.requestId,
    ipAddress: request.headers.get("x-forwarded-for"),
  });

  if (!result.ok) {
    const titles: Record<string, string> = {
      INVALID_ACTIVATION_CODE: "Código inválido",
      MT5_NOT_LINKED: "Conta MT5 não vinculada",
      SUBSCRIPTION_INACTIVE: "Assinatura inativa",
      SUBSCRIPTION_EXPIRED: "Assinatura vencida",
      LICENSE_REVOKED: "Licença revogada",
      LICENSE_SUSPENDED: "Licença suspensa",
      DEVICE_LIMIT_EXCEEDED: "Limite de dispositivos",
    };
    const details: Record<string, string> = {
      INVALID_ACTIVATION_CODE:
        "Código de ativação inválido ou expirado. Gere um novo código no painel.",
      MT5_NOT_LINKED:
        "Vincule login e servidor MT5 no painel antes de ativar o EA.",
      SUBSCRIPTION_INACTIVE: "Assinatura inativa.",
      SUBSCRIPTION_EXPIRED: "Assinatura vencida.",
      LICENSE_REVOKED: "Licença revogada.",
      LICENSE_SUSPENDED: "Licença suspensa.",
      DEVICE_LIMIT_EXCEEDED:
        "Limite de dispositivos/VPS do plano atingido.",
    };
    const status = result.code === "DEVICE_LIMIT_EXCEEDED" ? 403 : 401;
    return problemJson(
      status,
      result.code,
      titles[result.code] ?? "Ativação falhou",
      details[result.code] ?? "Não foi possível ativar o EA."
    );
  }

  const tokenHash = hashToken(result.device_token);
  const device = await prisma.device.findFirst({
    where: { tokenHash },
    include: {
      license: {
        include: {
          subscription: { include: { plan: true } },
          mt5Account: true,
          exposureProfile: true,
        },
      },
    },
  });

  const config = device
    ? await buildEaConfigResponse({
        device,
        license: device.license,
        requestId: headers.requestId,
        deviceIdHeader: parsed.data.device_id,
        eaVersion: parsed.data.ea_version ?? null,
      })
    : null;

  return eaJson({
    device_token: result.device_token,
    license_id: result.license_id,
    device_id: result.device_id,
    license_status: result.license_status,
    config,
  });
}
