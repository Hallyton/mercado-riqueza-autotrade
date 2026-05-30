import { NextResponse } from "next/server";
import {
  applyRealTradingApprovalAction,
  getRealTradingApprovalById,
  RealTradingApprovalError,
  updateRealTradingApprovalActionSchema,
} from "@/lib/admin/real-trading-approval";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";

type RouteContext = { params: Promise<{ approvalId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const { approvalId } = await context.params;
  const approval = await getRealTradingApprovalById(approvalId);
  if (!approval) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ approval });
}

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const { approvalId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateRealTradingApprovalActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.message },
      { status: 400 }
    );
  }

  try {
    const approval = await applyRealTradingApprovalAction(approvalId, {
      action: parsed.data.action,
      adminConfirmation: parsed.data.admin_confirmation,
      actorId: authResult.session!.user!.id!,
      ipAddress: clientIp(request),
    });
    return NextResponse.json({ ok: true, approval });
  } catch (e) {
    if (e instanceof RealTradingApprovalError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status }
      );
    }
    console.error("[admin/real-trading/approvals/[id]]", e);
    return NextResponse.json({ error: "Falha na ação" }, { status: 500 });
  }
}
