import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { BillingError, requestRenewalInvoice } from "@/lib/billing/invoice-service";

export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || session?.user?.appRole !== "CLIENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const invoice = await requestRenewalInvoice(userId);
    return NextResponse.json({ ok: true, invoiceId: invoice.id, status: invoice.status });
  } catch (e) {
    if (e instanceof BillingError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Falha ao solicitar fatura." }, { status: 500 });
  }
}
