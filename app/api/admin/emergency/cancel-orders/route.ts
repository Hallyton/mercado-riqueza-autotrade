import { NextResponse } from "next/server";
import { z } from "zod";
import { emergencyCancelPendingOrders } from "@/lib/admin/commands";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";

const bodySchema = z.object({
  licenseId: z.string().optional(),
  reason: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const authResult = await requireAdminApiSession({ emergency: true });
  if ("error" in authResult && authResult.error) return authResult.error;

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const result = await emergencyCancelPendingOrders({
    licenseId: parsed.data.licenseId,
    actorId: authResult.session!.user!.id!,
    ipAddress: clientIp(request),
    reason: parsed.data.reason,
  });

  return NextResponse.json({ ok: true, ...result });
}
