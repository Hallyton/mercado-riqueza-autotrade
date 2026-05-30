"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { REAL_TRADING_APPROVAL_CONFIRM_PHRASE } from "@/lib/admin/real-trading-approval";

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
  const [marginBuffer, setMarginBuffer] = useState("15");
  const [notes, setNotes] = useState("");
  const [adminConfirmation, setAdminConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selected = licenses.find((l) => l.licenseId === licenseId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      setMessage("Selecione uma licença.");
      return;
    }
    if (adminConfirmation.trim() !== REAL_TRADING_APPROVAL_CONFIRM_PHRASE) {
      setMessage(
        `Confirmação obrigatória: digite exatamente "${REAL_TRADING_APPROVAL_CONFIRM_PHRASE}".`
      );
      return;
    }
    const minMargin = Number(minFreeMargin);
    if (!Number.isFinite(minMargin) || minMargin <= 0) {
      setMessage("Margem livre mínima deve ser maior que zero.");
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
          min_free_margin: minMargin,
          margin_buffer_percent: Number(marginBuffer),
          notes: notes.trim() || undefined,
          admin_confirmation: REAL_TRADING_APPROVAL_CONFIRM_PHRASE,
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
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
        Esta aprovação não envia ordem. Ela apenas permite que o preflight avalie a
        sessão real. A ordem continua dependendo de dispatch manual, margem, snapshot,
        EA online e proteção SL/TP.
      </div>

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
          <span className="text-muted-foreground">MagicNumber (910001–910999)</span>
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
            max={100}
            className="mt-1 w-full rounded-md border border-white/10 bg-background px-3 py-2"
            value={maxContracts}
            onChange={(e) => setMaxContracts(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Margem livre mín. *</span>
          <input
            type="number"
            min={0.01}
            step="any"
            className="mt-1 w-full rounded-md border border-white/10 bg-background px-3 py-2"
            value={minFreeMargin}
            onChange={(e) => setMinFreeMargin(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Buffer margem %</span>
          <input
            type="number"
            min={0}
            max={100}
            className="mt-1 w-full rounded-md border border-white/10 bg-background px-3 py-2"
            value={marginBuffer}
            onChange={(e) => setMarginBuffer(e.target.value)}
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-muted-foreground">Notas admin</span>
        <textarea
          className="mt-1 w-full rounded-md border border-white/10 bg-background px-3 py-2"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="text-muted-foreground">
          Confirmação obrigatória — digite:{" "}
          <span className="font-mono text-gold">{REAL_TRADING_APPROVAL_CONFIRM_PHRASE}</span>
        </span>
        <input
          className="mt-1 w-full rounded-md border border-gold/30 bg-background px-3 py-2 font-mono"
          value={adminConfirmation}
          onChange={(e) => setAdminConfirmation(e.target.value)}
          autoComplete="off"
          required
        />
      </label>
      {message && <p className="text-sm text-amber-400">{message}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
      >
        {busy ? "Salvando…" : "Criar aprovação APPROVED"}
      </button>
    </form>
  );
}
