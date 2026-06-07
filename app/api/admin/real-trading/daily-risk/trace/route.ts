import { NextResponse } from "next/server";
import { buildDailyRiskFullTraceView } from "@/lib/admin/daily-risk-state-trace";
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

  const trace = await buildDailyRiskFullTraceView({
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
      diagnosis: "DAILY_RISK_STATE_MISSING",
      diagnosisCode: "DAILY_RISK_STATE_MISSING",
      riskLimit: null,
      exactState: null,
      nearbyRiskStates: [],
      latestReports: [],
      latestDailyRiskState: null,
      latestDailyRiskStateAgeSeconds: null,
      staleThresholdSeconds: null,
      reportTrace: null,
      latestOperationSnapshot: null,
      latestHeartbeat: null,
    });
  }

  return NextResponse.json({
    ok: true,
    licenseId,
    expectedKey: trace.expectedKey,
    expectedKeyLabel: trace.expectedKeyLabel,
    riskLimit: trace.riskLimit,
    exactState: trace.exactState,
    nearbyRiskStates: trace.nearbyStates,
    latestReports: trace.latestReports,
    diagnosisCode: trace.diagnosisCode,
    received: trace.received,
    latestDailyRiskState: trace.latestDailyRiskState,
    latestDailyRiskStateAgeSeconds: trace.latestDailyRiskStateAgeSeconds,
    staleThresholdSeconds: trace.staleThresholdSeconds,
    reportTrace: trace.reportTrace,
    latestOperationSnapshot: trace.latestOperationSnapshot,
    latestHeartbeat: trace.latestHeartbeat,
    diagnosis: trace.diagnosis,
  });
}
