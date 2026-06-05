import { NextResponse } from "next/server";
import { z } from "zod";
import {
  publishStrategyConfig,
  StrategyRuntimeConfigError,
} from "@/lib/admin/strategy-runtime-config";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";

type RouteContext = { params: Promise<{ licenseId: string }> };

const bodySchema = z.object({
  notes: z.string().max(2000).optional().nullable(),
  allow_without_daily_stop: z.boolean().optional(),
});

export async function POST(request: Request, context: RouteContext) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const { licenseId } = await context.params;
  const json = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Corpo inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await publishStrategyConfig({
      licenseId,
      notes: parsed.data.notes,
      allowWithoutDailyStop: parsed.data.allow_without_daily_stop,
      actorId: authResult.session!.user!.id!,
      ipAddress: clientIp(request),
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof StrategyRuntimeConfigError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status }
      );
    }
    return NextResponse.json(
      { error: "Falha ao publicar configuração" },
      { status: 500 }
    );
  }
}
