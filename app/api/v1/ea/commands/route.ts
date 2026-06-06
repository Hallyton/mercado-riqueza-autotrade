import { randomUUID } from "node:crypto";
import {
  assertLicenseUsable,
  assertMt5AccountAuthorized,
} from "@/lib/ea/auth";
import { withEaAuth } from "@/lib/ea/handler";
import { eaJson } from "@/lib/ea/json";
import { listPendingCommandsForEa } from "@/lib/operations/operational-command-service";

export const GET = withEaAuth(async (ctx) => {
  assertLicenseUsable(ctx);

  const accountLogin =
    ctx.license.mt5Account?.login ?? ctx.license.expectedAccountLogin;
  const accountServer =
    ctx.license.mt5Account?.server ?? ctx.license.expectedAccountServer;
  const symbol = ctx.license.expectedSymbol;

  if (!accountLogin || !accountServer || !symbol) {
    return eaJson(
      {
        ok: false,
        requestId: randomUUID(),
        code: "LICENSE_CONTEXT_INCOMPLETE",
        message: "Licença sem conta/símbolo configurado.",
      },
      409
    );
  }

  assertMt5AccountAuthorized(ctx, accountLogin, accountServer);

  const commands = await listPendingCommandsForEa({
    licenseId: ctx.license.id,
    deviceId: ctx.device.deviceId,
    accountLogin,
    accountServer,
    symbol,
  });

  return eaJson({
    ok: true,
    requestId: randomUUID(),
    commands: commands.map((cmd) => ({
      command_id: cmd.id,
      command_type: cmd.commandType,
      requested_at: cmd.requestedAt.toISOString(),
      expires_at: cmd.expiresAt.toISOString(),
      payload: {},
    })),
  });
});
