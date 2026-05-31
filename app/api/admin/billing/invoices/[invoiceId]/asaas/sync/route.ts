import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";
import { recordAdminAction } from "@/lib/admin/record-action";
import { ASAAS_CONFIRMATION_PHRASES } from "@/lib/billing/asaas-config";
import { syncAsaasPaymentForInvoice } from "@/lib/billing/asaas-invoice-service";
import { BillingError } from "@/lib/billing/errors";
import { AsaasClientError } from "@/lib/billing/asaas-client";

type RouteContext = { params: Promise<{ invoiceId: string }> };

const bodySchema = z.object({
  confirmationPhrase: z.string().optional(),
});

export async function POST(request: Request, context: RouteContext) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const { invoiceId } = await context.params;
  const json = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  if (parsed.data.confirmationPhrase?.trim() !== ASAAS_CONFIRMATION_PHRASES.SYNC) {
    return NextResponse.json(
      {
        error: `Confirmação obrigatória: digite exatamente "${ASAAS_CONFIRMATION_PHRASES.SYNC}".`,
        code: "CONFIRMATION_REQUIRED",
      },
      { status: 400 }
    );
  }

  try {
    const invoice = await syncAsaasPaymentForInvoice(
      invoiceId,
      authResult.session!.user!.id!
    );
    await recordAdminAction({
      actorId: authResult.session!.user!.id!,
      action: "billing.asaas_sync",
      targetType: "invoice",
      targetId: invoiceId,
      metadata: { status: invoice.status },
      ipAddress: clientIp(request),
    });
    return NextResponse.json({ ok: true, invoiceId: invoice.id, status: invoice.status });
  } catch (e) {
    if (e instanceof BillingError || e instanceof AsaasClientError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Falha ao sincronizar Asaas." }, { status: 500 });
  }
}
