import { NextResponse } from "next/server";
import { z } from "zod";
import {
  saveStrategyConfigDraft,
  StrategyRuntimeConfigError,
} from "@/lib/admin/strategy-runtime-config";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";

type RouteContext = { params: Promise<{ licenseId: string }> };

const bodySchema = z.object({
  config: z.unknown(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function POST(request: Request, context: RouteContext) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const { licenseId } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Corpo inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const draft = await saveStrategyConfigDraft({
      licenseId,
      config: parsed.data.config,
      notes: parsed.data.notes,
      actorId: authResult.session!.user!.id!,
      ipAddress: clientIp(request),
    });
    return NextResponse.json({ draft });
  } catch (e) {
    if (e instanceof StrategyRuntimeConfigError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status }
      );
    }
    return NextResponse.json(
      { error: "Falha ao salvar rascunho" },
      { status: 500 }
    );
  }
}
