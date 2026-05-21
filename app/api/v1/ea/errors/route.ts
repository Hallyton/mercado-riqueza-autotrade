import { assertLicenseUsable } from "@/lib/ea/auth";
import { reportEaError } from "@/lib/ea/errors";
import { withEaAuth } from "@/lib/ea/handler";
import { eaJson } from "@/lib/ea/json";
import { problemJson } from "@/lib/ea/problem";
import { errorBodySchema } from "@/lib/ea/schemas";

export const POST = withEaAuth(
  async (ctx, request) => {
  assertLicenseUsable(ctx);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problemJson(400, "INVALID_JSON", "JSON inválido", "Corpo inválido");
  }

  const parsed = errorBodySchema.safeParse(body);
  if (!parsed.success) {
    return problemJson(400, "VALIDATION_ERROR", "Dados inválidos", parsed.error.message);
  }

  const result = await reportEaError(ctx, parsed.data);
  return eaJson({ ok: true, error_report_id: result.id });
  },
  { rateLimit: "errors" }
);
