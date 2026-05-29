"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type RealTradingLicenseOption = {
  licenseId: string;
  userId: string;
  clientEmail: string;
  mt5Label: string | null;
};

export function RealTradingApprovalForm({
  licenses,
}: {
  licenses: RealTradingLicenseOption[];
}) {
  const router = useRouter();
  const [licenseId, setLicenseId] = useState(licenses[0]?.licenseId ?? "");
  const [accountLogin, setAccountLogin] = useState("");
  const [accountServer, setAccountServer] = useState("");
  const [symbol, setSymbol] = useState("WDOM26");
  const [magicNumber, setMagicNumber] = useState("910001");
  const [maxContracts, setMaxContracts] = useState("1");
  const [minFreeMargin, setMinFreeMargin] = useState("");
  const [marginBuffer, setMarginBuffer] = useState("10");
  const [approveImmediately, setApproveImmediately] = useState(true);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selected = licenses.find((l) => l.licenseId === licenseId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      setMessage("Selecione uma licença.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/real-trading/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selected.userId,
          license_id: selected.licenseId,
          account_login: accountLogin.trim(),
          account_server: accountServer.trim(),
          symbol: symbol.trim(),
          magic_number: Number(magicNumber),
          max_contracts: Number(maxContracts),
          min_free_margin: minFreeMargin.trim()
            ? Number(minFreeMargin)
            : undefined,
          margin_buffer_percent: Number(marginBuffer),
          approve_immediately: approveImmediately,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Falha ao criar aprovação.");
        return;
      }
      router.push("/admin/real-trading/approvals");
      router.refresh();
    } catch {
      setMessage("Erro de rede ao criar aprovação.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4">
      <label className="block text-sm">
        <span className="text-muted-foreground">Licença</span>
        <select
          className="mt-1 w-full rounded-md border border-white/10 bg-background px-3 py-2"
          value={licenseId}
          onChange={(e) => setLicenseId(e.target.value)}
        >
          {licenses.map((l) => (
            <option key={l.licenseId} value={l.licenseId}>
              {l.clientEmail} — {l.mt5Label ?? l.licenseId.slice(0, 8)}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-muted-foreground">Login MT5</span>
          <input
            className="mt-1 w-full rounded-md border border-white/10 bg-background px-3 py-2"
            value={accountLogin}
            onChange={(e) => setAccountLogin(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Servidor MT5</span>
          <input
            className="mt-1 w-full rounded-md border border-white/10 bg-background px-3 py-2"
            value={accountServer}
            onChange={(e) => setAccountServer(e.target.value)}
            required
          />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-muted-foreground">Símbolo</span>
          <input
            className="mt-1 w-full rounded-md border border-white/10 bg-background px-3 py-2"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">MagicNumber</span>
          <input
            className="mt-1 w-full rounded-md border border-white/10 bg-background px-3 py-2"
            value={magicNumber}
            onChange={(e) => setMagicNumber(e.target.value)}
            required
          />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="text-muted-foreground">Max contratos</span>
          <input
            type="number"
            min={1}
            className="mt-1 w-full rounded-md border border-white/10 bg-background px-3 py-2"
            value={maxContracts}
            onChange={(e) => setMaxContracts(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Margem livre mín.</span>
          <input
            className="mt-1 w-full rounded-md border border-white/10 bg-background px-3 py-2"
            value={minFreeMargin}
            onChange={(e) => setMinFreeMargin(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Buffer margem %</span>
          <input
            className="mt-1 w-full rounded-md border border-white/10 bg-background px-3 py-2"
            value={marginBuffer}
            onChange={(e) => setMarginBuffer(e.target.value)}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={approveImmediately}
          onChange={(e) => setApproveImmediately(e.target.checked)}
        />
        Aprovar imediatamente (allowReal)
      </label>
      <label className="block text-sm">
        <span className="text-muted-foreground">Notas admin</span>
        <textarea
          className="mt-1 w-full rounded-md border border-white/10 bg-background px-3 py-2"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      {message && <p className="text-sm text-amber-400">{message}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
      >
        {busy ? "Salvando…" : "Criar aprovação"}
      </button>
    </form>
  );
}
