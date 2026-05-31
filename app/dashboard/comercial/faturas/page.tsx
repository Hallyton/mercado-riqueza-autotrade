import Link from "next/link";
import { requireAppRole } from "@/lib/auth/session";
import { listInvoicesForUser } from "@/lib/billing/invoice-service";

export default async function FaturasPage() {
  const session = await requireAppRole("CLIENT");
  const invoices = await listInvoicesForUser(session.user.id);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/comercial" className="text-sm text-gold hover:underline">
        ← Portal comercial
      </Link>
      <h1 className="text-2xl font-bold">Faturas</h1>
      <p className="text-sm text-muted-foreground">
        Histórico de cobrança — pagamento não libera conta real automaticamente.
      </p>
      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma fatura.</p>
      ) : (
        <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
          {invoices.map((inv) => (
            <li key={inv.id} className="flex justify-between gap-4 p-4 text-sm">
              <div>
                <p className="font-medium">{inv.statusLabel}</p>
                <p className="text-muted-foreground">
                  {(inv.amountCents / 100).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </p>
              </div>
              <Link href={`/dashboard/comercial/faturas/${inv.id}`} className="text-gold hover:underline">
                Ver
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
