import { NextResponse } from "next/server";
import { z } from "zod";
import { pauseLicenseNewEntries } from "@/lib/admin/commands";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";

const bodySchema = z.object({
  pause: z.boolean(),
  reason: z.string().max(500).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ licenseId: string }> }
) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const { licenseId } = await params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const license = await pauseLicenseNewEntries({
    licenseId,
    actorId: authResult.session!.user!.id!,
    pause: parsed.data.pause,
    ipAddress: clientIp(request),
    reason: parsed.data.reason,
  });

  return NextResponse.json({
    ok: true,
    licenseId: license.id,
    haltNewEntries: license.haltNewEntries,
  });
}
