import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { BillingError, listInvoicesForUser } from "@/lib/billing/invoice-service";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || session?.user?.appRole !== "CLIENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const invoices = await listInvoicesForUser(userId);
    return NextResponse.json({ ok: true, invoices });
  } catch (e) {
    if (e instanceof BillingError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Falha ao listar faturas." }, { status: 500 });
  }
}
