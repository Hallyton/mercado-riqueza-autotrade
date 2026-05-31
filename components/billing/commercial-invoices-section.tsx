import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RenewalClientButton } from "@/components/billing/renewal-client-button";
import { invoiceIsPaid } from "@/lib/billing/invoice-client-copy";
import type { ClientInvoiceView } from "@/lib/billing/types";

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function formatDt(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(iso));
}

export function CommercialInvoicesSection({
  invoices,
  currentInvoice,
}: {
  invoices: ClientInvoiceView[];
  currentInvoice: ClientInvoiceView | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Faturas e pagamento</CardTitle>
        <CardDescription>
          Histórico de cobrança — modo manual/sandbox nesta fase. Pagamento confirmado não
          libera conta real automaticamente.
        </CardDescription>
      </CardHeader>

      {currentInvoice ? (
        <div className="mx-6 mb-4 rounded-lg border border-gold/30 bg-gold/5 p-4 text-sm space-y-2">
          <p className="font-medium text-gold">Fatura atual</p>
          <p>
            Valor: {formatMoney(currentInvoice.amountCents, currentInvoice.currency)} · Status:{" "}
            {currentInvoice.statusLabel}
          </p>
          <p className="text-muted-foreground">
            Vencimento: {formatDt(currentInvoice.dueAt)} · Método: {currentInvoice.methodLabel}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href={`/dashboard/comercial/faturas/${currentInvoice.id}`}
              className="text-gold hover:underline"
            >
              Ver fatura
            </Link>
            {currentInvoice.checkoutUrl && !invoiceIsPaid(currentInvoice.status) ? (
              <Link href={currentInvoice.checkoutUrl} className="text-gold hover:underline">
                Abrir pagamento
              </Link>
            ) : invoiceIsPaid(currentInvoice.status) ? (
              <span className="text-gold">Pagamento confirmado</span>
            ) : (
              <span className="text-muted-foreground">
                Aguardando confirmação de pagamento
              </span>
            )}
          </div>
        </div>
      ) : (
        <p className="px-6 pb-4 text-sm text-muted-foreground">
          Nenhuma fatura emitida. Solicite renovação abaixo ou aguarde geração automática.
        </p>
      )}

      {invoices.length > 0 && (
        <ul className="divide-y divide-white/5 px-6 pb-4 text-sm">
          {invoices.map((inv) => (
            <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-medium">{formatMoney(inv.amountCents, inv.currency)}</p>
                <p className="text-xs text-muted-foreground">
                  {inv.statusLabel} · {formatDt(inv.createdAt)}
                </p>
              </div>
              <Link
                href={`/dashboard/comercial/faturas/${inv.id}`}
                className="text-gold hover:underline text-xs"
              >
                Detalhes
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-white/10 px-6 py-4">
        <RenewalClientButton />
      </div>
    </Card>
  );
}
