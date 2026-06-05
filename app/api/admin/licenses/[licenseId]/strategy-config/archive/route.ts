import { NextResponse } from "next/server";
import {
  archiveStrategyConfigDraft,
  StrategyRuntimeConfigError,
} from "@/lib/admin/strategy-runtime-config";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";

type RouteContext = { params: Promise<{ licenseId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const { licenseId } = await context.params;
  try {
    const archived = await archiveStrategyConfigDraft({
      licenseId,
      actorId: authResult.session!.user!.id!,
      ipAddress: clientIp(request),
    });
    return NextResponse.json({ archived });
  } catch (e) {
    if (e instanceof StrategyRuntimeConfigError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status }
      );
    }
    return NextResponse.json(
      { error: "Falha ao arquivar rascunho" },
      { status: 500 }
    );
  }
}
