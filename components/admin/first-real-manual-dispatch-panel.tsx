"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FIRST_REAL_DISPATCH_CONFIRM_PHRASE } from "@/lib/admin/real-manual-dispatch";

type PreflightOption = {
  id: string;
  createdAt: string;
  licenseId: string;
  accountLogin: string;
  accountServer: string;
  symbol: string;
  magicNumber: number;
  requestedContracts: number;
  reasonCode: string | null;
};

const ORDER_TYPE_HELP = {
  MARKET: "Ordem a mercado sera enviada sem preco limite/stop.",
  LIMIT: "Preco de apregoamento da ordem LIMIT.",
  STOP: "Preco de disparo/apregoamento da ordem STOP.",
} as const;

export function FirstRealManualDispatchPanel({
  preflights,
}: {
  preflights: PreflightOption[];
}) {
  const router = useRouter();
  const [preflightId, setPreflightId] = useState(preflights[0]?.id ?? "");
  const selected = useMemo(
    () => preflights.find((p) => p.id === preflightId) ?? null,
    [preflightId, preflights]
  );

  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT" | "STOP">("MARKET");
  const [orderPrice, setOrderPrice] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (preflights.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum dry-run PASSED recente disponivel para dispatch real manual.
      </p>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (confirm.trim() !== FIRST_REAL_DISPATCH_CONFIRM_PHRASE) {
      setMessage(`Digite exatamente: ${FIRST_REAL_DISPATCH_CONFIRM_PHRASE}`);
      return;
    }

    const payload: Record<string, unknown> = {
      preflightId: selected.id,
      licenseId: selected.licenseId,
      accountLogin: selected.accountLogin,
      accountServer: selected.accountServer,
      symbol: selected.symbol,
      side,
      orderType,
      requestedContracts: 1,
      magicNumber: selected.magicNumber,
      adminConfirmation: confirm.trim(),
    };
    if (orderType !== "MARKET") {
      const n = Number(orderPrice);
      if (!Number.isFinite(n) || n <= 0) {
        setMessage("Informe um preco de apregoamento valido.");
        return;
      }
      payload.orderPrice = n;
    } else if (orderPrice.trim()) {
      setMessage("Ordem MARKET nao deve conter preco de apregoamento.");
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/real-trading/dispatch-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? "Falha ao criar instruction REAL.");
        return;
      }
      setMessage(
        `Instruction ${data.instructionId?.slice(0, 10)}... criada com source REAL_MANUAL.`
      );
      setConfirm("");
      setOrderPrice("");
      router.refresh();
    } catch {
      setMessage("Erro de rede.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-gold/30 bg-gold/5 p-5">
      <div>
        <h3 className="text-base font-semibold">Criar instruction REAL manual</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Dry-run PASSED nao envia ordem. Esta acao cria uma instruction REAL que podera
          ser buscada pelo EA.
        </p>
      </div>

      <label className="block text-sm">
        <span className="text-muted-foreground">Preflight DRY_RUN PASSED recente</span>
        <select
          className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 text-sm font-mono"
          value={preflightId}
          onChange={(e) => setPreflightId(e.target.value)}
        >
          {preflights.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id.slice(0, 10)}... | {p.symbol} | {p.accountLogin}@{p.accountServer}
            </option>
          ))}
        </select>
      </label>

      {selected && (
        <dl className="grid gap-2 text-xs sm:grid-cols-2">
          <div><dt className="text-muted-foreground">License</dt><dd className="font-mono">{selected.licenseId}</dd></div>
          <div><dt className="text-muted-foreground">Conta</dt><dd className="font-mono">{selected.accountLogin}</dd></div>
          <div><dt className="text-muted-foreground">Servidor</dt><dd className="font-mono">{selected.accountServer}</dd></div>
          <div><dt className="text-muted-foreground">Simbolo</dt><dd className="font-mono">{selected.symbol}</dd></div>
          <div><dt className="text-muted-foreground">Magic</dt><dd className="font-mono">{selected.magicNumber}</dd></div>
          <div><dt className="text-muted-foreground">Contratos</dt><dd className="font-mono">1</dd></div>
        </dl>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-muted-foreground">Lado</span>
          <select
            className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2"
            value={side}
            onChange={(e) => setSide(e.target.value as "BUY" | "SELL")}
          >
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Tipo de ordem</span>
          <select
            className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2"
            value={orderType}
            onChange={(e) => setOrderType(e.target.value as "MARKET" | "LIMIT" | "STOP")}
          >
            <option value="MARKET">MARKET - A mercado</option>
            <option value="LIMIT">LIMIT - Limitada</option>
            <option value="STOP">STOP - Stop</option>
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="text-muted-foreground">Preco de apregoamento</span>
        <input
          className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono"
          value={orderPrice}
          onChange={(e) => setOrderPrice(e.target.value)}
          placeholder="Ex.: 5650.5"
          disabled={orderType === "MARKET"}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {ORDER_TYPE_HELP[orderType]} Obrigatorio para LIMIT ou STOP.
        </p>
      </label>

      <label className="block text-sm">
        <span className="text-muted-foreground">
          Confirmacao: <span className="font-mono text-gold">{FIRST_REAL_DISPATCH_CONFIRM_PHRASE}</span>
        </span>
        <input
          className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>

      <p className="text-xs text-amber-300">
        Esta acao cria uma instruction REAL que podera ser buscada pelo EA. Nao envia ordem diretamente.
      </p>

      <button
        type="submit"
        disabled={busy}
        className="rounded bg-gold px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
      >
        {busy ? "Criando..." : "Criar instruction REAL manual"}
      </button>
      {message && <p className="text-sm text-amber-200">{message}</p>}
    </form>
  );
}
