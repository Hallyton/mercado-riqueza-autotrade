import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { updateAdminUser, UserAdminError } from "@/lib/admin/users";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";

const bodySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().optional(),
  role: z.nativeEnum(UserRole).optional(),
});

type RouteContext = { params: Promise<{ userId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const { userId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  try {
    const user = await updateAdminUser({
      userId,
      actorId: authResult.session!.user!.id!,
      data: parsed.data,
      ipAddress: clientIp(request),
    });
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    if (e instanceof UserAdminError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status }
      );
    }
    return NextResponse.json(
      { error: "Falha ao atualizar usuário" },
      { status: 500 }
    );
  }
}
