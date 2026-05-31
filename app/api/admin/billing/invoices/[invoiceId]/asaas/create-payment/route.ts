import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";
import { recordAdminAction } from "@/lib/admin/record-action";
import { ASAAS_CONFIRMATION_PHRASES } from "@/lib/billing/asaas-config";
import { provisionAsaasPaymentForInvoice } from "@/lib/billing/asaas-invoice-service";
import { BillingError } from "@/lib/billing/errors";
import { AsaasClientError } from "@/lib/billing/asaas-client";

type RouteContext = { params: Promise<{ invoiceId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const { invoiceId } = await context.params;

  try {
    const invoice = await provisionAsaasPaymentForInvoice(invoiceId);
    await recordAdminAction({
      actorId: authResult.session!.user!.id!,
      action: "billing.asaas_create_payment",
      targetType: "invoice",
      targetId: invoiceId,
      metadata: { providerInvoiceId: invoice.providerInvoiceId },
      ipAddress: clientIp(_request),
    });
    return NextResponse.json({ ok: true, invoiceId: invoice.id, status: invoice.status });
  } catch (e) {
    if (e instanceof BillingError || e instanceof AsaasClientError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Falha ao criar cobrança Asaas." }, { status: 500 });
  }
}
