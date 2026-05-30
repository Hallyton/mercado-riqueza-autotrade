import { NextResponse } from "next/server";
import { adminCreateLicenseForSubscription } from "@/lib/commercial/admin-subscription";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";

type RouteContext = { params: Promise<{ subscriptionId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const { subscriptionId } = await context.params;

  const result = await adminCreateLicenseForSubscription(
    subscriptionId,
    authResult.session!.user!.id!,
    clientIp(request)
  );

  return NextResponse.json({ ok: true, ...result });
}
