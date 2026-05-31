import { NextResponse } from "next/server";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";
import { BillingError, markInvoicePending } from "@/lib/billing/invoice-service";

type RouteContext = { params: Promise<{ invoiceId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const { invoiceId } = await context.params;

  try {
    await markInvoicePending({
      invoiceId,
      actorId: authResult.session!.user!.id!,
      ipAddress: clientIp(request),
    });
    return NextResponse.json({ ok: true, invoiceId });
  } catch (e) {
    if (e instanceof BillingError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Falha ao marcar fatura pendente." }, { status: 500 });
  }
}
