import { assertLicenseUsable, assertMt5AccountAuthorized } from "@/lib/ea/auth";
import { withEaAuth } from "@/lib/ea/handler";
import { eaJson } from "@/lib/ea/json";
import { problemJson } from "@/lib/ea/problem";
import { accountSnapshotBodySchema } from "@/lib/ea/schemas";
import { saveAccountSnapshotFromEa } from "@/lib/risk/account-snapshot-service";

export const POST = withEaAuth(
  async (ctx, request) => {
    assertLicenseUsable(ctx);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return problemJson(400, "INVALID_JSON", "JSON inválido", "Corpo inválido");
    }

    const parsed = accountSnapshotBodySchema.safeParse(body);
    if (!parsed.success) {
      return problemJson(
        400,
        "VALIDATION_ERROR",
        "Dados inválidos",
        "Verifique snapshot_type, conta e valores numéricos."
      );
    }

    assertMt5AccountAuthorized(
      ctx,
      parsed.data.account_login,
      parsed.data.account_server
    );

    const result = await saveAccountSnapshotFromEa(ctx, {
      snapshot_type: parsed.data.snapshot_type,
      account_login: parsed.data.account_login,
      account_server: parsed.data.account_server,
      environment: parsed.data.environment,
      currency: parsed.data.currency,
      balance: Number(parsed.data.balance),
      equity: Number(parsed.data.equity),
      margin: parsed.data.margin ? Number(parsed.data.margin) : undefined,
      free_margin: parsed.data.free_margin
        ? Number(parsed.data.free_margin)
        : undefined,
      margin_level: parsed.data.margin_level
        ? Number(parsed.data.margin_level)
        : undefined,
      open_positions: parsed.data.open_positions,
      pending_orders: parsed.data.pending_orders,
      active_magic_numbers: parsed.data.active_magic_numbers,
      captured_at: parsed.data.captured_at,
    });

    return eaJson({ ok: true, snapshot_id: result.snapshotId });
  },
  { rateLimit: "heartbeat" }
);
