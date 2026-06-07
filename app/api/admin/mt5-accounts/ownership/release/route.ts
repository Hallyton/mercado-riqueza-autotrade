import { NextResponse } from "next/server";
import {
  Mt5AccountOwnershipError,
  mt5OwnershipReleaseSchema,
  releaseMt5AccountOwnership,
} from "@/lib/admin/mt5-account-ownership";
import { canManageMt5AccountOwnership } from "@/lib/admin/permissions";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";

export async function POST(request: Request) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  if (!canManageMt5AccountOwnership(authResult.role ?? "")) {
    return NextResponse.json(
      { ok: false, code: "FORBIDDEN", message: "Permissão insuficiente." },
      { status: 403 }
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = mt5OwnershipReleaseSchema.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: "VALIDATION_ERROR", message: parsed.error.message },
      { status: 400 }
    );
  }

  try {
    const result = await releaseMt5AccountOwnership({
      ...parsed.data,
      actorId: authResult.session!.user!.id!,
      ipAddress: clientIp(request),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof Mt5AccountOwnershipError) {
      return NextResponse.json(
        { ok: false, code: error.code, message: error.message, detail: error.detail },
        { status: error.status }
      );
    }
    console.error("[admin/mt5-accounts/ownership/release]", error);
    return NextResponse.json(
      { ok: false, message: "Falha ao liberar conta MT5." },
      { status: 500 }
    );
  }
}
