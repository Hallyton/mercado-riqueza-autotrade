import { assertLicenseUsable } from "@/lib/ea/auth";
import { withEaAuth } from "@/lib/ea/handler";
import { eaJson } from "@/lib/ea/json";
import { problemJson } from "@/lib/ea/problem";
import { managementEventSchema, reportManagementEvent } from "@/lib/ea/management-events";

export const POST = withEaAuth(async (ctx, request) => {
  assertLicenseUsable(ctx);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problemJson(400, "INVALID_JSON", "JSON inválido", "Corpo inválido");
  }

  const parsed = managementEventSchema.safeParse(body);
  if (!parsed.success) {
    return problemJson(400, "VALIDATION_ERROR", "Dados inválidos", "Evento de gestão inválido");
  }

  const result = await reportManagementEvent(ctx, parsed.data);
  if (!result.ok) {
    return problemJson(404, result.code, "Instruction não encontrada", "Instruction não encontrada");
  }

  return eaJson({ ok: true });
});
