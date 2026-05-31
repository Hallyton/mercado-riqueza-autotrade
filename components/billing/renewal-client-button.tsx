"use client";

import { useState } from "react";

export function RenewalClientButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/me/billing/invoices/request", { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setMessage(data.error ?? "Falha ao solicitar fatura.");
      return;
    }
    setMessage("Fatura solicitada. Aguarde confirmação administrativa.");
    window.location.reload();
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex h-9 items-center rounded-lg border border-gold/40 px-4 text-sm font-medium text-gold hover:bg-gold/10 disabled:opacity-50"
      >
        {loading ? "Solicitando…" : "Solicitar pagamento / renovar"}
      </button>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
