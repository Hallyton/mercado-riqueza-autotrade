import { NextResponse } from "next/server";
import { z } from "zod";
import { blockClient } from "@/lib/admin/commands";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";

const bodySchema = z.object({
  reason: z.string().max(500).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const { userId } = await params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  await blockClient({
    userId,
    actorId: authResult.session!.user!.id!,
    ipAddress: clientIp(request),
    reason: parsed.data.reason,
  });

  return NextResponse.json({ ok: true, userId });
}
