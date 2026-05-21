import { assertLicenseUsable } from "@/lib/ea/auth";
import { withEaAuth } from "@/lib/ea/handler";
import { eaJson } from "@/lib/ea/json";
import { problemJson } from "@/lib/ea/problem";
import { reportExecution } from "@/lib/ea/instructions";
import { executionBodySchema } from "@/lib/ea/schemas";

export const POST = withEaAuth(async (ctx, request) => {
  assertLicenseUsable(ctx);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problemJson(400, "INVALID_JSON", "JSON inválido", "Corpo inválido");
  }

  const parsed = executionBodySchema.safeParse(body);
  if (!parsed.success) {
    return problemJson(400, "VALIDATION_ERROR", "Dados inválidos", parsed.error.message);
  }

  const result = await reportExecution(ctx, {
    ...parsed.data,
    fill_price: parsed.data.fill_price
      ? Number(parsed.data.fill_price)
      : undefined,
    fill_quantity: parsed.data.fill_quantity
      ? Number(parsed.data.fill_quantity)
      : undefined,
    slippage: parsed.data.slippage
      ? Number(parsed.data.slippage)
      : undefined,
  });

  if (!result.ok) {
    return problemJson(404, result.code, "Não encontrado", "Instrução não encontrada");
  }

  return eaJson({
    ok: true,
    instruction_id: parsed.data.instruction_id,
    order_status: result.orderStatus,
  });
});
