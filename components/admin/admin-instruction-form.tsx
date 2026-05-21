"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type LicenseDispatchOption = {
  id: string;
  clientEmail: string;
  status: string;
  mt5Label: string | null;
};

export function AdminInstructionForm({
  licenses,
}: {
  licenses: LicenseDispatchOption[];
}) {
  const router = useRouter();
  const [licenseId, setLicenseId] = useState(licenses[0]?.id ?? "");
  const [source, setSource] = useState<"TEST" | "HOMOLOGATION">("TEST");
  const [symbol, setSymbol] = useState("PETR4");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [purpose, setPurpose] = useState<"ENTRY" | "EXIT" | "ADJUSTMENT">("ENTRY");
  const [orderType, setOrderType] = useState<
    "MARKET" | "LIMIT" | "STOP" | "STOP_LIMIT"
  >("MARKET");
  const [quantity, setQuantity] = useState("100");
  const [expiresIn, setExpiresIn] = useState("60");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!licenseId) {
      setMessage("Selecione uma licença.");
      return;
    }
    setBusy(true);
    setMessage(null);

    const body: Record<string, unknown> = {
      license_id: licenseId,
      source,
      symbol: symbol.trim().toUpperCase(),
      side,
      purpose,
      order_type: orderType,
      quantity: Number(quantity),
      expires_in_minutes: Number(expiresIn),
    };
    if (stopLoss.trim()) body.stop_loss = Number(stopLoss);
    if (takeProfit.trim()) body.take_profit = Number(takeProfit);
    if (note.trim()) body.note = note.trim();

    const res = await fetch("/api/admin/instructions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setMessage(data.error ?? data.title ?? "Falha ao despachar instrução");
      return;
    }

    setMessage(
      `Instrução ${data.instructionId?.slice(0, 8) ?? ""} criada (${data.source}). O EA pode buscá-la em GET /api/v1/ea/instructions.`
    );
    router.refresh();
  }

  if (licenses.length === 0) {
    return (
      <p className="text-sm text-amber-400">
        Nenhuma licença disponível para despacho. Cadastre cliente e vincule MT5
        antes de homologar.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="text-muted-foreground">Licença alvo</span>
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-background px-3 py-2 text-sm"
            value={licenseId}
            onChange={(e) => setLicenseId(e.target.value)}
          >
            {licenses.map((l) => (
              <option key={l.id} value={l.id}>
                {l.clientEmail} · {l.status}
                {l.mt5Label ? ` · MT5 ${l.mt5Label}` : " · sem MT5"}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-muted-foreground">Origem (fila interna)</span>
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-background px-3 py-2 text-sm"
            value={source}
            onChange={(e) =>
              setSource(e.target.value as "TEST" | "HOMOLOGATION")
            }
          >
            <option value="TEST">TEST</option>
            <option value="HOMOLOGATION">HOMOLOGATION</option>
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-muted-foreground">Ativo</span>
          <input
            className="mt-1 w-full rounded-lg border border-white/10 bg-background px-3 py-2 text-sm uppercase"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            required
            maxLength={32}
          />
        </label>

        <label className="block text-sm">
          <span className="text-muted-foreground">Lado</span>
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-background px-3 py-2 text-sm"
            value={side}
            onChange={(e) => setSide(e.target.value as "BUY" | "SELL")}
          >
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-muted-foreground">Propósito</span>
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-background px-3 py-2 text-sm"
            value={purpose}
            onChange={(e) =>
              setPurpose(e.target.value as "ENTRY" | "EXIT" | "ADJUSTMENT")
            }
          >
            <option value="ENTRY">ENTRY</option>
            <option value="EXIT">EXIT</option>
            <option value="ADJUSTMENT">ADJUSTMENT</option>
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-muted-foreground">Tipo de ordem</span>
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-background px-3 py-2 text-sm"
            value={orderType}
            onChange={(e) =>
              setOrderType(
                e.target.value as "MARKET" | "LIMIT" | "STOP" | "STOP_LIMIT"
              )
            }
          >
            <option value="MARKET">MARKET</option>
            <option value="LIMIT">LIMIT</option>
            <option value="STOP">STOP</option>
            <option value="STOP_LIMIT">STOP_LIMIT</option>
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-muted-foreground">Quantidade</span>
          <input
            type="number"
            min="0.0001"
            step="any"
            className="mt-1 w-full rounded-lg border border-white/10 bg-background px-3 py-2 text-sm"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </label>

        <label className="block text-sm">
          <span className="text-muted-foreground">Expira em (min)</span>
          <input
            type="number"
            min={5}
            max={1440}
            className="mt-1 w-full rounded-lg border border-white/10 bg-background px-3 py-2 text-sm"
            value={expiresIn}
            onChange={(e) => setExpiresIn(e.target.value)}
            required
          />
        </label>

        <label className="block text-sm">
          <span className="text-muted-foreground">Stop loss (opcional)</span>
          <input
            type="number"
            step="any"
            className="mt-1 w-full rounded-lg border border-white/10 bg-background px-3 py-2 text-sm"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
          />
        </label>

        <label className="block text-sm">
          <span className="text-muted-foreground">Take profit (opcional)</span>
          <input
            type="number"
            step="any"
            className="mt-1 w-full rounded-lg border border-white/10 bg-background px-3 py-2 text-sm"
            value={takeProfit}
            onChange={(e) => setTakeProfit(e.target.value)}
          />
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="text-muted-foreground">Nota interna (opcional)</span>
          <input
            className="mt-1 w-full rounded-lg border border-white/10 bg-background px-3 py-2 text-sm"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="Homologação EA v1 — não visível ao cliente"
          />
        </label>
      </div>

      <p className="text-xs text-muted-foreground">
        Fila privada de teste/homologação. O cliente vê apenas ordens armadas
        (ativo, lado, volume) — sem origem TEST/HOMOLOGATION nem parâmetros de
        setup.
      </p>

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold/90 disabled:opacity-50"
      >
        {busy ? "Despachando…" : "Despachar instrução"}
      </button>

      {message && (
        <p
          className={`text-sm ${message.includes("criada") ? "text-emerald-400" : "text-red-400"}`}
        >
          {message}
        </p>
      )}
    </form>
  );
}
