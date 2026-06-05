import { NextResponse } from "next/server";
import {
  getStrategyConfigAdminView,
  StrategyRuntimeConfigError,
} from "@/lib/admin/strategy-runtime-config";
import { requireAdminApiSession } from "@/lib/auth/admin-api";

type RouteContext = { params: Promise<{ licenseId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const { licenseId } = await context.params;
  try {
    const view = await getStrategyConfigAdminView(licenseId);
    return NextResponse.json(view);
  } catch (e) {
    if (e instanceof StrategyRuntimeConfigError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status }
      );
    }
    return NextResponse.json(
      { error: "Falha ao carregar configuração da estratégia" },
      { status: 500 }
    );
  }
}
