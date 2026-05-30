import { NextResponse } from "next/server";
import { z } from "zod";
import {
  adminUserConfirmationSchema,
  deactivateAdminUser,
  UserAdminError,
} from "@/lib/admin/users";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";

const bodySchema = adminUserConfirmationSchema.extend({
  reason: z.string().max(500).optional(),
});

type RouteContext = { params: Promise<{ userId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const { userId } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  try {
    const result = await deactivateAdminUser({
      userId,
      actorId: authResult.session!.user!.id!,
      adminConfirmation: parsed.data.admin_confirmation,
      reason: parsed.data.reason,
      ipAddress: clientIp(request),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof UserAdminError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status }
      );
    }
    return NextResponse.json(
      { error: "Falha ao inativar usuário" },
      { status: 500 }
    );
  }
}
