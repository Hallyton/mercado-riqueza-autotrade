import { NextResponse } from "next/server";
import { z } from "zod";
import {
  listDailyFinancialRiskLimits,
  upsertDailyFinancialRiskLimit,
} from "@/lib/admin/daily-financial-risk-admin";
import { requireAdminApiSession } from "@/lib/auth/admin-api";

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
  const licenseId = url.searchParams.get("license_id") ?? undefined;
  const rows = await listDailyFinancialRiskLimits(licenseId);
  return NextResponse.json({ items: rows });
}

export async function POST(request: Request) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const row = await upsertDailyFinancialRiskLimit({
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
  });

  return NextResponse.json({ item: row });
}
