import { NextResponse } from "next/server";
import { TradeMode } from "@prisma/client";
import { LicenseDeviceAdminError } from "@/lib/admin/license-devices";
import {
  bindLicenseMt5Account,
  licenseMt5AccountSchema,
} from "@/lib/admin/license-mt5-account";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";

type RouteContext = { params: Promise<{ licenseId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const { licenseId } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = licenseMt5AccountSchema.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  try {
    const result = await bindLicenseMt5Account({
      licenseId,
      actorId: authResult.session!.user!.id!,
      adminConfirmation: parsed.data.admin_confirmation,
      accountLogin: parsed.data.account_login,
      accountServer: parsed.data.account_server,
      expectedTradeMode: parsed.data.expected_trade_mode as TradeMode,
      expectedSymbol: parsed.data.expected_symbol,
      expectedMagicNumber: parsed.data.expected_magic_number,
      ipAddress: clientIp(request),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof LicenseDeviceAdminError) {
      return NextResponse.json(
        {
          error: e.message,
          code: e.code,
          detail: e.detail ?? null,
          actionHint:
            typeof e.detail?.actionHint === "string" ? e.detail.actionHint : null,
          traceLink:
            typeof e.detail?.traceLink === "string" ? e.detail.traceLink : null,
        },
        { status: e.status }
      );
    }
    console.error("[admin/licenses/mt5-account]", e);
    return NextResponse.json(
      { error: "Falha ao vincular conta MT5" },
      { status: 500 }
    );
  }
}
