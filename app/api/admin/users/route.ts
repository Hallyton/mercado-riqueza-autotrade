import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { createAdminUser, UserAdminError } from "@/lib/admin/users";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";

const bodySchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  role: z.nativeEnum(UserRole),
  temporary_password: z.string().min(12).max(128).optional(),
  generate_password: z.boolean().optional(),
  must_change_password: z.boolean().optional(),
  plan_slug: z.string().min(1).optional(),
  create_subscription: z.boolean().optional(),
});

export async function POST(request: Request) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

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
    const result = await createAdminUser({
      actorId: authResult.session!.user!.id!,
      ipAddress: clientIp(request),
      email: parsed.data.email,
      name: parsed.data.name,
      role: parsed.data.role,
      temporaryPassword: parsed.data.temporary_password,
      generatePassword: parsed.data.generate_password,
      mustChangePassword: parsed.data.must_change_password,
      planSlug: parsed.data.plan_slug,
      createSubscription: parsed.data.create_subscription,
      createLicense: parsed.data.create_subscription,
    });

    return NextResponse.json({
      ok: true,
      user: result.user,
      temporary_password: result.temporaryPassword,
      subscription_id: result.subscriptionId,
    });
  } catch (e) {
    if (e instanceof UserAdminError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status }
      );
    }
    return NextResponse.json(
      { error: "Falha ao criar usuário" },
      { status: 500 }
    );
  }
}
