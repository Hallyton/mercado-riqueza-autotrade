import { randomUUID } from "node:crypto";
import {
  assertLicenseUsable,
  assertMt5AccountAuthorized,
} from "@/lib/ea/auth";
import { withEaAuth } from "@/lib/ea/handler";
import { eaJson } from "@/lib/ea/json";
import { dailyRiskReportBodySchema } from "@/lib/ea/schemas";
import { processDailyRiskReport } from "@/lib/risk/daily-financial-risk";
import { MR_FIBO_D1_GUARD_CODE } from "@/lib/risk/autonomous-strategy-reasons";
import { maskAccountLogin } from "@/lib/risk/real-trading-guard-status";

export const POST = withEaAuth(
  async (ctx, request) => {
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

    const parsed = dailyRiskReportBodySchema.safeParse(body);
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
          effectiveKey: {
            licenseId: parsed.data.license_id,
            accountLogin: parsed.data.account_login,
            accountServer: parsed.data.account_server,
            symbol: parsed.data.symbol,
            strategyCode: parsed.data.strategy_code ?? MR_FIBO_D1_GUARD_CODE,
            tradeDate: parsed.data.trade_date,
          },
          actionHint: "Verifique license_id do EA.",
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

    console.info("[daily_risk.report.received]", {
      requestId,
      licenseId: ctx.license.id,
      accountLogin: maskAccountLogin(parsed.data.account_login),
      accountServer: parsed.data.account_server,
      symbol: parsed.data.symbol,
      strategyCode: parsed.data.strategy_code ?? MR_FIBO_D1_GUARD_CODE,
      tradeDate: parsed.data.trade_date,
    });

    const result = await processDailyRiskReport({
      licenseId: ctx.license.id,
      accountLogin: parsed.data.account_login,
      accountServer: parsed.data.account_server,
      strategyCode: parsed.data.strategy_code ?? MR_FIBO_D1_GUARD_CODE,
      symbol: parsed.data.symbol,
      tradeDate: parsed.data.trade_date,
      realizedPnl: parsed.data.realized_pnl,
      openPnl: parsed.data.open_pnl,
      requestId,
    });

    return eaJson({
      ok: true,
      request_id: result.requestId,
      state_id: result.state.id,
      created: result.created,
      updated: result.updated,
      effective_key: {
        license_id: result.effectiveKey.licenseId,
        account_login: result.effectiveKey.accountLogin,
        account_server: result.effectiveKey.accountServer,
        symbol: result.effectiveKey.symbol,
        strategy_code: result.effectiveKey.strategyCode,
        trade_date: result.effectiveKey.tradeDate,
      },
      received: {
        strategy_code_raw: result.received.strategyCodeRaw,
        strategy_code_normalized: result.received.strategyCodeNormalized,
        symbol_raw: result.received.symbolRaw,
        symbol_normalized: result.received.symbolNormalized,
        trade_date_raw: result.received.tradeDateRaw,
        trade_date_operational: result.received.tradeDateOperational,
        trade_date_mismatch: result.received.tradeDateMismatch,
      },
      trade_date: result.state.tradeDate,
      status: result.state.status,
      realized_pnl: result.state.realizedPnlCents / 100,
      open_pnl: result.state.openPnlCents / 100,
      total_pnl: result.state.totalPnlCents / 100,
      remaining_loss: result.state.remainingLossCents / 100,
      limit: result.state.limitCents / 100,
      last_updated_at: result.state.lastUpdatedAt.toISOString(),
    });
  },
  { rateLimit: "heartbeat", activitySource: "DAILY_RISK_REPORT" }
);
