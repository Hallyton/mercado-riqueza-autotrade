import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  applyRealTradingApprovalAction,
  getRealTradingApprovalById,
  RealTradingApprovalError,
  updateRealTradingApprovalActionSchema,
} from "@/lib/admin/real-trading-approval";
import {
  isRealTradingApprovalLimitPatchBody,
  mapApprovalLimitUpdateZodError,
  RealTradingApprovalLimitUpdateError,
  updateRealTradingApprovalLimits,
  updateRealTradingApprovalLimitsSchema,
} from "@/lib/admin/real-trading-approval-limit-update";
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
  const requestId = randomUUID();
  const { approvalId } = await context.params;

  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) {
    const status = authResult.error.status;
    return NextResponse.json(
      {
        ok: false,
        requestId,
        code:
          status === 401 ? "ADMIN_SESSION_REQUIRED" : "ADMIN_PERMISSION_DENIED",
        message:
          status === 401
            ? "Sessão admin necessária."
            : "Permissão insuficiente.",
        actionHint: "Faça login como administrador autorizado.",
      },
      { status }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        requestId,
        code: "UNKNOWN_APPROVAL_UPDATE_ERROR",
        message: "JSON inválido.",
      },
      { status: 400 }
    );
  }

  if (isRealTradingApprovalLimitPatchBody(body)) {
    const parsed = updateRealTradingApprovalLimitsSchema.safeParse(body);
    if (!parsed.success) {
      const err = mapApprovalLimitUpdateZodError(parsed.error, requestId);
      return NextResponse.json(err.toPayload(), { status: err.status });
    }

    try {
      const result = await updateRealTradingApprovalLimits(approvalId, {
        ...parsed.data,
        actorId: authResult.session!.user!.id!,
        ipAddress: clientIp(request),
        requestId,
      });

      return NextResponse.json({
        ok: true,
        requestId: result.requestId,
        approvalId: result.approval.id,
        previous: {
          maxContracts: result.previous.maxContracts,
          marginFreeMin: result.previous.marginFreeMin,
          marginBufferPercent: result.previous.marginBufferPercent,
        },
        current: {
          maxContracts: result.current.maxContracts,
          marginFreeMin: result.current.marginFreeMin,
          marginBufferPercent: result.current.marginBufferPercent,
        },
      });
    } catch (e) {
      if (e instanceof RealTradingApprovalLimitUpdateError) {
        return NextResponse.json(e.toPayload(), { status: e.status });
      }
      console.error("[real_trading.approval.limit_update_failed]", {
        requestId,
        approvalId,
      });
      return NextResponse.json(
        {
          ok: false,
          requestId,
          code: "UNKNOWN_APPROVAL_UPDATE_ERROR",
          message: "Falha inesperada ao atualizar limite operacional.",
        },
        { status: 500 }
      );
    }
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
