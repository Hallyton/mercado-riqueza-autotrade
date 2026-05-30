import { NextResponse } from "next/server";
import { z } from "zod";
import {
  adminUserConfirmationSchema,
  resetAdminUserPassword,
  UserAdminError,
} from "@/lib/admin/users";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";

const bodySchema = adminUserConfirmationSchema.extend({
  temporary_password: z.string().min(12).max(128).optional(),
  generate_password: z.boolean().optional(),
  must_change_password: z.boolean().optional(),
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
    const result = await resetAdminUserPassword({
      userId,
      actorId: authResult.session!.user!.id!,
      adminConfirmation: parsed.data.admin_confirmation,
      temporaryPassword: parsed.data.temporary_password,
      generatePassword: parsed.data.generate_password,
      mustChangePassword: parsed.data.must_change_password,
      ipAddress: clientIp(request),
    });
    return NextResponse.json({
      ok: true,
      user_id: result.userId,
      temporary_password: result.temporaryPassword,
    });
  } catch (e) {
    if (e instanceof UserAdminError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status }
      );
    }
    return NextResponse.json(
      { error: "Falha ao resetar senha" },
      { status: 500 }
    );
  }
}
