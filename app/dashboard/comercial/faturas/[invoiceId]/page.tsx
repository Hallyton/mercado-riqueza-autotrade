import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceStatus } from "@prisma/client";
import { requireAppRole } from "@/lib/auth/session";
import { getInvoiceForUser } from "@/lib/billing/invoice-service";
import {
  getInvoiceStatusClientMessage,
  INVOICE_REAL_ACCOUNT_DISCLAIMER,
  invoiceHasPendingPaymentCopy,
  invoiceIsPaid,
} from "@/lib/billing/invoice-client-copy";

type PageProps = { params: Promise<{ invoiceId: string }> };

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(iso));
}

function formatPeriod(start: string | null, end: string | null) {
  if (!start && !end) return "—";
  return `${formatDate(start)} — ${formatDate(end)}`;
}

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

  const statusMessage = getInvoiceStatusClientMessage(invoice.status);
  const showCheckout =
    invoice.checkoutUrl &&
    !invoiceIsPaid(invoice.status) &&
    invoice.status !== InvoiceStatus.CANCELLED &&
    invoice.status !== InvoiceStatus.VOID;

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href="/dashboard/comercial/faturas" className="text-sm text-gold hover:underline">
        ← Faturas
      </Link>
      <h1 className="text-2xl font-bold">Fatura</h1>

      <p
        className={
          invoiceIsPaid(invoice.status)
            ? "text-sm font-medium text-gold"
            : "text-sm text-muted-foreground"
        }
      >
        {statusMessage}
      </p>

      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Valor</dt>
          <dd className="font-medium text-gold">{money}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd>{invoice.statusLabel}</dd>
        </div>
        {invoiceIsPaid(invoice.status) && (
          <div>
            <dt className="text-muted-foreground">Pago em</dt>
            <dd>{formatDate(invoice.paidAt)}</dd>
          </div>
        )}
        <div>
          <dt className="text-muted-foreground">Vencimento</dt>
          <dd>{formatDate(invoice.dueAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Período</dt>
          <dd>{formatPeriod(invoice.periodStart, invoice.periodEnd)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Método</dt>
          <dd>{invoice.methodLabel}</dd>
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
        {INVOICE_REAL_ACCOUNT_DISCLAIMER}
      </p>

      {showCheckout && (
        <Link
          href={invoice.checkoutUrl!}
          className="inline-flex h-10 items-center rounded-lg bg-gold px-5 text-sm font-semibold text-black"
        >
          Abrir pagamento
        </Link>
      )}

      {invoiceHasPendingPaymentCopy(invoice.status) && !invoice.checkoutUrl && (
        <p className="text-sm text-muted-foreground">{statusMessage}</p>
      )}
    </div>
  );
}
