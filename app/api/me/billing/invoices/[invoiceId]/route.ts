import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { BillingError, getInvoiceForUser } from "@/lib/billing/invoice-service";

type RouteContext = { params: Promise<{ invoiceId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || session?.user?.appRole !== "CLIENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { invoiceId } = await context.params;

  try {
    const invoice = await getInvoiceForUser(userId, invoiceId);
    return NextResponse.json({ ok: true, invoice });
  } catch (e) {
    if (e instanceof BillingError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Fatura não encontrada." }, { status: 404 });
  }
}
