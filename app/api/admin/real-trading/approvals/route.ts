import { NextResponse } from "next/server";
import {
  createRealTradingApproval,
  createRealTradingApprovalSchema,
  listRealTradingApprovals,
  RealTradingApprovalError,
} from "@/lib/admin/real-trading-approval";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";

export async function GET() {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const items = await listRealTradingApprovals(100);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createRealTradingApprovalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.message },
      { status: 400 }
    );
  }

  try {
    const approval = await createRealTradingApproval({
      ...parsed.data,
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
    console.error("[admin/real-trading/approvals]", e);
    return NextResponse.json({ error: "Falha ao criar aprovação" }, { status: 500 });
  }
}
