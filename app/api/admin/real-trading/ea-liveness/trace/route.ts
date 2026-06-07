import { NextResponse } from "next/server";
import { buildEaLivenessTraceView } from "@/lib/admin/ea-liveness-trace";
import { requireAdminApiSession } from "@/lib/auth/admin-api";

export async function GET(request: Request) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const url = new URL(request.url);
  const licenseId =
    url.searchParams.get("licenseId") ??
    url.searchParams.get("license_id") ??
    "";
  if (!licenseId) {
    return NextResponse.json(
      {
        ok: false,
        code: "LICENSE_ID_REQUIRED",
        message: "Informe licenseId.",
      },
      { status: 400 }
    );
  }

  const trace = await buildEaLivenessTraceView({
    licenseId,
    accountLogin: url.searchParams.get("accountLogin"),
    accountServer: url.searchParams.get("accountServer"),
    symbol: url.searchParams.get("symbol"),
    strategyCode: url.searchParams.get("strategyCode") ?? undefined,
  });

  if (!trace) {
    return NextResponse.json({
      ok: true,
      licenseId,
      diagnosisCode: "EA_LIVENESS_DEVICE_NOT_FOUND",
      computedStatus: "UNKNOWN",
    });
  }

  return NextResponse.json({ ok: true, ...trace });
}
