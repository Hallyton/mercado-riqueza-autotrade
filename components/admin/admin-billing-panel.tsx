"use client";

import { useState } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type AdminInvoice = {
  id: string;
  subscriptionId: string;
  status: string;
  statusLabel: string;
  amountCents: number;
  currency: string;
  description: string | null;
  providerLabel: string;
  dueAt: string | null;
  paidAt: string | null;
};

export function AdminBillingPanel({
  userId,
  subscriptionId,
  initialInvoices,
}: {
  userId: string;
  subscriptionId: string;
  initialInvoices: AdminInvoice[];
}) {
  const [invoices, setInvoices] = useState(initialInvoices);
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmPaidId, setConfirmPaidId] = useState<string | null>(null);
  const [confirmPhrase, setConfirmPhrase] = useState("");

  async function refresh() {
    const res = await fetch(
      `/api/admin/billing/invoices?userId=${encodeURIComponent(userId)}`
    );
    if (res.ok) {
      const data = (await res.json()) as { invoices: AdminInvoice[] };
      setInvoices(data.invoices);
    }
  }

  async function createInvoice() {
    setLoading("create");
    setMessage(null);
    const res = await fetch("/api/admin/billing/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId }),
    });
    setLoading(null);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setMessage(data.error ?? "Falha ao criar fatura.");
      return;
    }
    setMessage("Fatura criada.");
    await refresh();
  }

  async function markPaid(invoiceId: string) {
    setLoading(`paid:${invoiceId}`);
    setMessage(null);
    const res = await fetch(`/api/admin/billing/invoices/${invoiceId}/mark-paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmationPhrase: confirmPhrase }),
    });
    setLoading(null);
    setConfirmPaidId(null);
    setConfirmPhrase("");
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setMessage(data.error ?? "Falha ao marcar paga.");
      return;
    }
    setMessage("Fatura marcada como paga.");
    await refresh();
    window.location.reload();
  }

  function formatMoney(cents: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
      cents / 100
    );
  }

  return (
    <Card className="p-6">
      <CardHeader className="p-0 pb-4">
        <CardTitle>Faturas e billing</CardTitle>
        <CardDescription>
          Gestão manual — confirmação textual para ações críticas. Sem exposição de secrets.
        </CardDescription>
      </CardHeader>

      {message && <p className="mb-4 text-sm text-gold">{message}</p>}

      <Button
        type="button"
        variant="outline"
        disabled={loading === "create"}
        onClick={createInvoice}
        className="mb-4"
      >
        Criar fatura manual
      </Button>

      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma fatura.</p>
      ) : (
        <ul className="space-y-4">
          {invoices.map((inv) => (
            <li key={inv.id} className="rounded border border-white/10 p-4 text-sm space-y-2">
              <p className="font-medium">
                {formatMoney(inv.amountCents)} · {inv.statusLabel}
              </p>
              <p className="text-xs text-muted-foreground">
                {inv.providerLabel} · Assinatura {inv.subscriptionId.slice(0, 8)}…
              </p>
              {inv.status !== "PAID" && inv.status !== "CANCELLED" && (
                <div className="space-y-2">
                  {confirmPaidId === inv.id ? (
                    <>
                      <input
                        type="text"
                        value={confirmPhrase}
                        onChange={(e) => setConfirmPhrase(e.target.value)}
                        placeholder='Digite: MARCAR FATURA PAGA'
                        className="w-full rounded border border-white/20 bg-transparent px-3 py-2 text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={loading === `paid:${inv.id}`}
                        onClick={() => markPaid(inv.id)}
                      >
                        Confirmar pagamento
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setConfirmPaidId(inv.id)}
                    >
                      Marcar fatura paga
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
