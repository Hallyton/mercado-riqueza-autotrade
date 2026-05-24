import { assertMasterSignalAuth } from "@/lib/master-signals/auth";
import { intakeMasterSignal } from "@/lib/master-signals/intake";
import { validateMasterSignalPayload } from "@/lib/master-signals/service";
import { problemJson } from "@/lib/ea/problem";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

const AUTH_TITLES: Record<string, string> = {
  MASTER_SECRET_NOT_CONFIGURED: "Secret do EA Mãe não configurado",
  MASTER_AUTH_REQUIRED: "Autenticação obrigatória",
  MASTER_AUTH_INVALID: "Autenticação inválida",
};

const AUTH_DETAILS: Record<string, string> = {
  MASTER_SECRET_NOT_CONFIGURED:
    "MASTER_EA_API_SECRET não está configurado neste ambiente.",
  MASTER_AUTH_REQUIRED:
    "Envie Authorization: Bearer <secret> ou X-Master-EA-Secret.",
  MASTER_AUTH_INVALID: "Credencial do EA Mãe inválida.",
};

// TODO(Fase 2.6+): rate limit dedicado (Redis/KV) para POST /api/master/signals.

export async function POST(request: Request) {
  const auth = assertMasterSignalAuth(request);
  if (!auth.ok) {
    return problemJson(
      auth.status,
      auth.code,
      AUTH_TITLES[auth.code] ?? "Erro de autenticação",
      AUTH_DETAILS[auth.code] ?? "Não autorizado."
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problemJson(400, "INVALID_JSON", "JSON inválido", "Corpo da requisição inválido");
  }

  let normalized;
  try {
    normalized = validateMasterSignalPayload(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return problemJson(400, "VALIDATION_ERROR", "Dados inválidos", e.message);
    }
    throw e;
  }

  const result = await intakeMasterSignal(normalized);
  if (!result.ok) {
    return problemJson(
      result.status,
      result.code,
      "Conflito de sinal mestre",
      "master_signal_id ou idempotency_key já utilizado com payload diferente."
    );
  }

  const payload = {
    ok: true,
    master_signal_id: result.masterSignalId,
    status: result.status,
    dispatch: "NOT_STARTED" as const,
    ...(result.created ? {} : { idempotent: true }),
  };

  return NextResponse.json(payload, { status: result.created ? 201 : 200 });
}
