import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAppRole } from "@/lib/auth/session";
import { getInvoiceForUser } from "@/lib/billing/invoice-service";

type PageProps = { params: Promise<{ invoiceId: string }> };

export default async function FaturaDetailPage({ params }: PageProps) {
  const session = await requireAppRole("CLIENT");
  const { invoiceId } = await params;

  let invoice;
  try {
    invoice = await getInvoiceForUser(session.user.id, invoiceId);
  } catch {
    notFound();
  }

  const money = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: invoice.currency,
  }).format(invoice.amountCents / 100);

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href="/dashboard/comercial/faturas" className="text-sm text-gold hover:underline">
        ← Faturas
      </Link>
      <h1 className="text-2xl font-bold">Fatura</h1>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Valor</dt>
          <dd className="font-medium text-gold">{money}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd>{invoice.statusLabel}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Vencimento</dt>
          <dd>{invoice.dueAt ? new Date(invoice.dueAt).toLocaleDateString("pt-BR") : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Provedor</dt>
          <dd>{invoice.providerLabel}</dd>
        </div>
      </dl>
      {invoice.description && (
        <p className="text-sm text-muted-foreground">{invoice.description}</p>
      )}
      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        Pagamento confirmado ativa assinatura comercial, mas não substitui aprovação operacional
        para conta real (RealTradingApproval, PRE_MARKET, preflight e proteção).
      </p>
      {invoice.checkoutUrl ? (
        <Link
          href={invoice.checkoutUrl}
          className="inline-flex h-10 items-center rounded-lg bg-gold px-5 text-sm font-semibold text-black"
        >
          Abrir pagamento
        </Link>
      ) : (
        <p className="text-sm text-muted-foreground">
          Aguardando confirmação administrativa do pagamento.
        </p>
      )}
    </div>
  );
}
