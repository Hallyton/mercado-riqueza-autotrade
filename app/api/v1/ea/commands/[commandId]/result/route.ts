import { randomUUID } from "node:crypto";
import { assertLicenseUsable } from "@/lib/ea/auth";
import { withEaAuth } from "@/lib/ea/handler";
import { eaJson } from "@/lib/ea/json";
import { eaCommandResultBodySchema } from "@/lib/ea/schemas";
import {
  OperationalCommandError,
  completeOperationalCommand,
} from "@/lib/operations/operational-command-service";

type RouteContext = { params: Promise<{ commandId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { commandId } = await context.params;

  return withEaAuth(async (ctx, req) => {
    assertLicenseUsable(ctx);
    const requestId = randomUUID();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return eaJson(
        { ok: false, requestId, code: "INVALID_JSON", message: "JSON inválido" },
        400
      );
    }

    const parsed = eaCommandResultBodySchema.safeParse(body);
    if (!parsed.success) {
      return eaJson(
        {
          ok: false,
          requestId,
          code: "VALIDATION_ERROR",
          message: "Dados inválidos",
          detail: parsed.error.message,
        },
        400
      );
    }

    try {
      const command = await completeOperationalCommand({
        commandId,
        licenseId: ctx.license.id,
        status: parsed.data.status,
        resultCode: parsed.data.result_code,
        resultMessage: parsed.data.result_message,
        details: parsed.data.details,
      });

      return eaJson({
        ok: true,
        requestId,
        command_id: command.id,
        status: command.status,
      });
    } catch (error) {
      if (error instanceof OperationalCommandError) {
        return eaJson(
          { requestId, ...error.toPayload() },
          error.status
        );
      }
      throw error;
    }
  }, { activitySource: "COMMAND_RESULT" })(request);
}
