import { randomUUID } from "node:crypto";
import {
  assertLicenseUsable,
  assertMt5AccountAuthorized,
} from "@/lib/ea/auth";
import { withEaAuth } from "@/lib/ea/handler";
import { eaJson } from "@/lib/ea/json";
import { operationSnapshotBodySchema } from "@/lib/ea/schemas";
import { MR_FIBO_D1_GUARD_CODE } from "@/lib/risk/autonomous-strategy-reasons";
import { upsertOperationalSnapshotFromEa } from "@/lib/operations/operational-snapshot-service";

export const POST = withEaAuth(async (ctx, request) => {
  assertLicenseUsable(ctx);
  const requestId = randomUUID();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return eaJson(
      { ok: false, requestId, code: "INVALID_JSON", message: "JSON inválido" },
      400
    );
  }

  const parsed = operationSnapshotBodySchema.safeParse(body);
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

  if (ctx.license.id !== parsed.data.license_id) {
    return eaJson(
      {
        ok: false,
        requestId,
        code: "FORBIDDEN",
        message: "Acesso negado",
        detail: "license_id inválido",
      },
      403
    );
  }

  if (ctx.device.deviceId !== parsed.data.device_id) {
    return eaJson(
      {
        ok: false,
        requestId,
        code: "FORBIDDEN",
        message: "Acesso negado",
        detail: "device_id inválido",
      },
      403
    );
  }

  assertMt5AccountAuthorized(
    ctx,
    parsed.data.account_login,
    parsed.data.account_server
  );

  const snapshot = await upsertOperationalSnapshotFromEa(
    ctx.license.id,
    ctx.device.deviceId,
    parsed.data
  );

  return eaJson({
    ok: true,
    requestId,
    snapshot_id: snapshot.id,
    strategy_code: parsed.data.strategy_code ?? MR_FIBO_D1_GUARD_CODE,
    updated_at: snapshot.updatedAt.toISOString(),
  });
});
