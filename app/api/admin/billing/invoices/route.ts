import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";
import {
  BillingError,
  listInvoicesAdmin,
  serializeAdminInvoice,
} from "@/lib/billing/invoice-service";

const querySchema = z.object({
  userId: z.string().optional(),
  subscriptionId: z.string().optional(),
});

export async function GET(request: Request) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    userId: url.searchParams.get("userId") ?? undefined,
    subscriptionId: url.searchParams.get("subscriptionId") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  const invoices = await listInvoicesAdmin(parsed.data);
  return NextResponse.json({
    ok: true,
    invoices: invoices.map(serializeAdminInvoice),
  });
}

export async function POST(request: Request) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const bodySchema = z.object({
    subscriptionId: z.string().min(1),
    amountCents: z.number().int().positive().optional(),
    description: z.string().max(500).optional(),
  });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  try {
    const { adminCreateManualInvoice } = await import("@/lib/billing/invoice-service");
    const invoice = await adminCreateManualInvoice({
      subscriptionId: parsed.data.subscriptionId,
      actorId: authResult.session!.user!.id!,
      amountCents: parsed.data.amountCents,
      description: parsed.data.description,
      ipAddress: clientIp(request),
    });
    return NextResponse.json({ ok: true, invoiceId: invoice.id });
  } catch (e) {
    if (e instanceof BillingError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Falha ao criar fatura." }, { status: 500 });
  }
}
