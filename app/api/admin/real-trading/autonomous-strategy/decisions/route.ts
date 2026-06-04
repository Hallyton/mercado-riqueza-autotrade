import { NextResponse } from "next/server";
import { listAutonomousStrategyDecisions } from "@/lib/admin/daily-financial-risk-admin";
import { requireAdminApiSession } from "@/lib/auth/admin-api";

export async function GET(request: Request) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const url = new URL(request.url);
  const licenseId = url.searchParams.get("license_id") ?? undefined;
  const items = await listAutonomousStrategyDecisions({ licenseId, limit: 150 });
  return NextResponse.json({ items });
}
