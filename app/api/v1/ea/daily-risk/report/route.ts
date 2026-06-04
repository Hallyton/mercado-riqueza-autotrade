import {
  assertLicenseUsable,
  assertMt5AccountAuthorized,
} from "@/lib/ea/auth";
import { withEaAuth } from "@/lib/ea/handler";
import { eaJson } from "@/lib/ea/json";
import { problemJson } from "@/lib/ea/problem";
import { dailyRiskReportBodySchema } from "@/lib/ea/schemas";
import { processDailyRiskReport } from "@/lib/risk/daily-financial-risk";
import { MR_FIBO_D1_GUARD_CODE } from "@/lib/risk/autonomous-strategy-reasons";

export const POST = withEaAuth(
  async (ctx, request) => {
    assertLicenseUsable(ctx);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return problemJson(400, "INVALID_JSON", "JSON inválido", "Corpo inválido");
    }

    const parsed = dailyRiskReportBodySchema.safeParse(body);
    if (!parsed.success) {
      return problemJson(400, "VALIDATION_ERROR", "Dados inválidos", parsed.error.message);
    }

    if (ctx.license.id !== parsed.data.license_id) {
      return problemJson(403, "FORBIDDEN", "Acesso negado", "license_id inválido");
    }
    if (ctx.device.deviceId !== parsed.data.device_id) {
      return problemJson(403, "FORBIDDEN", "Acesso negado", "device_id inválido");
    }

    assertMt5AccountAuthorized(
      ctx,
      parsed.data.account_login,
      parsed.data.account_server
    );

    const state = await processDailyRiskReport({
      licenseId: ctx.license.id,
      accountLogin: parsed.data.account_login,
      accountServer: parsed.data.account_server,
      strategyCode: parsed.data.strategy_code ?? MR_FIBO_D1_GUARD_CODE,
      symbol: parsed.data.symbol,
      tradeDate: parsed.data.trade_date,
      realizedPnl: parsed.data.realized_pnl,
      openPnl: parsed.data.open_pnl,
    });

    return eaJson({
      ok: true,
      trade_date: state.tradeDate,
      status: state.status,
      realized_pnl: state.realizedPnlCents / 100,
      open_pnl: state.openPnlCents / 100,
      total_pnl: state.totalPnlCents / 100,
      remaining_loss: state.remainingLossCents / 100,
      limit: state.limitCents / 100,
      last_updated_at: state.lastUpdatedAt.toISOString(),
    });
  },
  { rateLimit: "heartbeat" }
);
