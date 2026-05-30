import { NextResponse } from "next/server";
import { TradeMode } from "@prisma/client";
import {
  configureLicenseExpectedMode,
  licenseExpectedModeSchema,
} from "@/lib/admin/license-expected-mode";
import { LicenseDeviceAdminError } from "@/lib/admin/license-devices";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";

type RouteContext = { params: Promise<{ licenseId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const { licenseId } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = licenseExpectedModeSchema.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  try {
    const result = await configureLicenseExpectedMode({
      licenseId,
      actorId: authResult.session!.user!.id!,
      adminConfirmation: parsed.data.admin_confirmation,
      expectedTradeMode: parsed.data.expected_trade_mode as TradeMode,
      expectedAccountLogin: parsed.data.expected_account_login,
      expectedAccountServer: parsed.data.expected_account_server,
      expectedSymbol: parsed.data.expected_symbol,
      expectedMagicNumber: parsed.data.expected_magic_number,
      ipAddress: clientIp(request),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof LicenseDeviceAdminError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status }
      );
    }
    return NextResponse.json(
      { error: "Falha ao configurar modo esperado" },
      { status: 500 }
    );
  }
}
