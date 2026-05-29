import { assertLicenseUsable } from "@/lib/ea/auth";
import { withEaAuth } from "@/lib/ea/handler";
import { eaJson } from "@/lib/ea/json";
import { problemJson } from "@/lib/ea/problem";
import { executionProtectionBodySchema } from "@/lib/ea/schemas";
import { reportExecutionProtection } from "@/lib/risk/execution-protection";
import { TradeMode } from "@prisma/client";
import prisma from "@/lib/prisma";

export const POST = withEaAuth(
  async (ctx, request) => {
    assertLicenseUsable(ctx);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return problemJson(400, "INVALID_JSON", "JSON inválido", "Corpo inválido");
    }

    const parsed = executionProtectionBodySchema.safeParse(body);
    if (!parsed.success) {
      return problemJson(
        400,
        "VALIDATION_ERROR",
        "Dados inválidos",
        "Verifique instruction_id, magic_number e protection_status."
      );
    }

    const hb = await prisma.eaHeartbeat.findFirst({
      where: { licenseId: ctx.license.id },
      orderBy: { receivedAt: "desc" },
      select: { tradeMode: true },
    });

    const result = await reportExecutionProtection(
      ctx,
      {
        instruction_id: parsed.data.instruction_id,
        execution_id: parsed.data.execution_id,
        account_login: parsed.data.account_login,
        account_server: parsed.data.account_server,
        symbol: parsed.data.symbol,
        magic_number: parsed.data.magic_number,
        entry_order_ticket: parsed.data.entry_order_ticket,
        entry_deal_ticket: parsed.data.entry_deal_ticket,
        stop_loss_present: parsed.data.stop_loss_present,
        take_profit_present: parsed.data.take_profit_present,
        stop_loss_price: parsed.data.stop_loss_price
          ? Number(parsed.data.stop_loss_price)
          : undefined,
        take_profit_price: parsed.data.take_profit_price
          ? Number(parsed.data.take_profit_price)
          : undefined,
        stop_order_ticket: parsed.data.stop_order_ticket,
        take_order_ticket: parsed.data.take_order_ticket,
        protection_mode: parsed.data.protection_mode,
        protection_status: parsed.data.protection_status,
        error_code: parsed.data.error_code,
        error_message: parsed.data.error_message,
        reported_at: parsed.data.reported_at,
      },
      { tradeMode: hb?.tradeMode ?? TradeMode.DEMO }
    );

    if (!result.ok) {
      return problemJson(
        400,
        result.code,
        "Proteção rejeitada",
        "message" in result && result.message
          ? result.message
          : "Proteção rejeitada."
      );
    }

    return eaJson({
      ok: true,
      report_id: result.reportId,
      protection_status: result.protectionStatus,
    });
  },
  { rateLimit: "executions" }
);
