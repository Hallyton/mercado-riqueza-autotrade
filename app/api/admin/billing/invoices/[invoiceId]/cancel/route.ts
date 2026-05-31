import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";
import { BillingError, cancelInvoice } from "@/lib/billing/invoice-service";

type RouteContext = { params: Promise<{ invoiceId: string }> };

const bodySchema = z.object({
  confirmationPhrase: z.literal("CANCELAR FATURA"),
});

export async function POST(request: Request, context: RouteContext) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const { invoiceId } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Confirmação obrigatória: "CANCELAR FATURA".' },
      { status: 400 }
    );
  }

  try {
    await cancelInvoice({
      invoiceId,
      actorId: authResult.session!.user!.id!,
      confirmationPhrase: parsed.data.confirmationPhrase,
      ipAddress: clientIp(request),
    });
    return NextResponse.json({ ok: true, invoiceId });
  } catch (e) {
    if (e instanceof BillingError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Falha ao cancelar fatura." }, { status: 500 });
  }
}
