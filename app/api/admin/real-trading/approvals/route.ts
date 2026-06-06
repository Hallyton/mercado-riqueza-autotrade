import { NextResponse } from "next/server";
import {
  ApprovalCreateSuccessPayload,
  createRealTradingApprovalSchema,
  createRealTradingApprovalTraced,
  mapApprovalCreateZodError,
  RealTradingApprovalCreateError,
} from "@/lib/admin/real-trading-approval-create";
import {
  listRealTradingApprovals,
} from "@/lib/admin/real-trading-approval";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";
import { randomUUID } from "node:crypto";

export async function GET(request: Request) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const url = new URL(request.url);
  const licenseId = url.searchParams.get("licenseId") ?? undefined;
  const requestIdFilter = url.searchParams.get("requestId") ?? undefined;
  const accountLogin = url.searchParams.get("accountLogin") ?? undefined;
  const symbol = url.searchParams.get("symbol") ?? undefined;
  const magicParam = url.searchParams.get("magicNumber");
  const magicNumber = magicParam ? Number(magicParam) : undefined;

  const items = await listRealTradingApprovals({
    take: 100,
    licenseId,
    accountLogin,
    symbol,
    magicNumber: Number.isFinite(magicNumber) ? magicNumber : undefined,
    requestId: requestIdFilter,
  });

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const requestId = randomUUID();

  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) {
    const status = authResult.error.status;
    const code =
      status === 401 ? "ADMIN_SESSION_REQUIRED" : "ADMIN_PERMISSION_DENIED";
    return NextResponse.json(
      {
        ok: false,
        requestId,
        code,
        message:
          status === 401
            ? "Sessão admin necessária."
            : "Permissão insuficiente para criar aprovação REAL.",
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
        code: "VALIDATION_ERROR",
        message: "JSON inválido no corpo da requisição.",
        actionHint: "Verifique o payload enviado pelo formulário.",
      },
      { status: 400 }
    );
  }

  const parsed = createRealTradingApprovalSchema.safeParse(body);
  if (!parsed.success) {
    const err = mapApprovalCreateZodError(parsed.error, requestId, body);
    return NextResponse.json(err.toPayload(), { status: err.status });
  }

  try {
    const { approval, requestId: traceId } = await createRealTradingApprovalTraced({
      ...parsed.data,
      actorId: authResult.session!.user!.id!,
      ipAddress: clientIp(request),
      requestId,
    });

    const payload: ApprovalCreateSuccessPayload = {
      ok: true,
      requestId: traceId,
      approvalId: approval.id,
      status: approval.status,
      links: {
        approval: `/admin/real-trading/approvals/${approval.id}`,
      },
    };

    return NextResponse.json(payload);
  } catch (e) {
    if (e instanceof RealTradingApprovalCreateError) {
      return NextResponse.json(e.toPayload(), { status: e.status });
    }

    console.error("[real_trading.approval.create_failed]", {
      requestId,
      code: "UNKNOWN_APPROVAL_CREATE_ERROR",
    });

    return NextResponse.json(
      {
        ok: false,
        requestId,
        code: "UNKNOWN_APPROVAL_CREATE_ERROR",
        message: "Falha inesperada ao criar aprovação.",
        actionHint: "Tente novamente e informe o requestId ao suporte.",
      },
      { status: 500 }
    );
  }
}
