import { NextResponse } from "next/server";
import { z } from "zod";
import {
  DailyFinancialRiskAdminError,
  listDailyFinancialRiskLimits,
  listDailyRiskExistingConfigViews,
  upsertDailyFinancialRiskLimitValidated,
} from "@/lib/admin/daily-financial-risk-admin";
import { listDailyRiskEligibleLicenses } from "@/lib/admin/daily-risk-eligible-licenses";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";

const upsertSchema = z.object({
  license_id: z.string().min(1),
  account_login: z.string().min(1),
  account_server: z.string().min(1),
  symbol: z.string().min(1),
  strategy_code: z.string().optional(),
  enabled: z.boolean(),
  daily_loss_limit_brl: z.number().positive(),
  include_open_pnl: z.boolean().default(true),
  reset_timezone: z.string().optional(),
  reset_at_time: z.string().optional(),
});

export async function GET(request: Request) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const url = new URL(request.url);
  const licenseId =
    url.searchParams.get("licenseId") ??
    url.searchParams.get("license_id") ??
    undefined;

  if (url.searchParams.get("eligible") === "true") {
    const licenses = await listDailyRiskEligibleLicenses();
    return NextResponse.json({ licenses });
  }

  const items = await listDailyFinancialRiskLimits(licenseId);
  const views = await listDailyRiskExistingConfigViews(licenseId);
  return NextResponse.json({ items, views });
}

export async function POST(request: Request) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "INVALID_JSON", message: "JSON inválido" },
      { status: 400 }
    );
  }

  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "DAILY_LIMIT_INVALID",
        message: "Payload inválido.",
        detail: parsed.error.message,
      },
      { status: 400 }
    );
  }

  try {
    const result = await upsertDailyFinancialRiskLimitValidated({
      licenseId: parsed.data.license_id,
      accountLogin: parsed.data.account_login,
      accountServer: parsed.data.account_server,
      symbol: parsed.data.symbol,
      strategyCode: parsed.data.strategy_code,
      enabled: parsed.data.enabled,
      dailyLossLimitBrl: parsed.data.daily_loss_limit_brl,
      includeOpenPnL: parsed.data.include_open_pnl,
      resetTimezone: parsed.data.reset_timezone,
      resetAtTime: parsed.data.reset_at_time,
      actorId: authResult.session!.user!.id!,
      ipAddress: clientIp(request),
    });

    return NextResponse.json({
      ok: true,
      created: result.created,
      item: result.item,
      previousLimitCents: result.previousLimitCents,
    });
  } catch (error) {
    if (error instanceof DailyFinancialRiskAdminError) {
      return NextResponse.json(error.toPayload(), { status: error.status });
    }
    console.error("[admin/real-trading/daily-risk]", error);
    return NextResponse.json(
      { ok: false, code: "UNKNOWN_ERROR", message: "Falha ao salvar stop diário." },
      { status: 500 }
    );
  }
}
