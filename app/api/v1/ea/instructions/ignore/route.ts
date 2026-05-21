import { assertLicenseUsable } from "@/lib/ea/auth";
import { withEaAuth } from "@/lib/ea/handler";
import { eaJson } from "@/lib/ea/json";
import { problemJson } from "@/lib/ea/problem";
import { reportIgnored } from "@/lib/ea/instructions";
import { ignoredBodySchema } from "@/lib/ea/schemas";

export const POST = withEaAuth(
  async (ctx, request) => {
  assertLicenseUsable(ctx);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problemJson(400, "INVALID_JSON", "JSON inválido", "Corpo inválido");
  }

  const parsed = ignoredBodySchema.safeParse(body);
  if (!parsed.success) {
    return problemJson(400, "VALIDATION_ERROR", "Dados inválidos", parsed.error.message);
  }

  const result = await reportIgnored(
    ctx,
    parsed.data.instruction_id,
    parsed.data.reason
  );

  if (!result.ok) {
    return problemJson(404, result.code, "Não encontrado", "Instrução não encontrada");
  }

  return eaJson({ ok: true, instruction_id: parsed.data.instruction_id, status: "IGNORED" });
  },
  { rateLimit: "ignore" }
);
