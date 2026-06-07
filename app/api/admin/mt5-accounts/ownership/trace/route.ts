import { NextResponse } from "next/server";
import {
  maskOwnershipTraceForApi,
  Mt5AccountOwnershipError,
  normalizeMt5OwnershipCredentials,
  traceMt5AccountOwnership,
} from "@/lib/admin/mt5-account-ownership";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";

export async function GET(request: Request) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const url = new URL(request.url);
  const accountLogin =
    url.searchParams.get("accountLogin") ??
    url.searchParams.get("account_login") ??
    "";
  const accountServer =
    url.searchParams.get("accountServer") ??
    url.searchParams.get("account_server") ??
    "";

  try {
    const { accountLogin: login, accountServer: server } =
      normalizeMt5OwnershipCredentials(accountLogin, accountServer);

    const trace = await traceMt5AccountOwnership({
      accountLogin: login,
      accountServer: server,
      actorId: authResult.session!.user!.id!,
      ipAddress: clientIp(request),
    });

    return NextResponse.json({
      ok: true,
      ...maskOwnershipTraceForApi(trace),
    });
  } catch (error) {
    if (error instanceof Mt5AccountOwnershipError) {
      return NextResponse.json(
        { ok: false, code: error.code, message: error.message, detail: error.detail },
        { status: error.status }
      );
    }
    console.error("[admin/mt5-accounts/ownership/trace]", error);
    return NextResponse.json(
      { ok: false, message: "Falha ao diagnosticar conta MT5." },
      { status: 500 }
    );
  }
}
