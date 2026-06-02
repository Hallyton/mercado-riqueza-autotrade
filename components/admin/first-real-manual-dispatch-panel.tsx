"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FIRST_REAL_DISPATCH_CONFIRM_PHRASE } from "@/lib/admin/real-manual-dispatch";
import {
  parseOptionalPositive,
  slTpDirectionHint,
  validateRealManualOrderFields,
} from "@/lib/admin/real-manual-dispatch-validation";

export type PreflightOption = {
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
  MARKET: "Ordem a mercado será enviada sem preço de apregoamento.",
  LIMIT: "Preço de apregoamento da ordem LIMIT.",
  STOP: "Preço de disparo/apregoamento da ordem STOP.",
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
  const [stopLossPrice, setStopLossPrice] = useState("");
  const [takeProfitPrice, setTakeProfitPrice] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (preflights.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/30 p-5 space-y-2">
        <h3 className="text-base font-semibold">Criar instruction REAL manual</h3>
        <p className="text-sm text-muted-foreground">
          Nenhum dry-run PASSED recente disponível para dispatch real manual.
        </p>
        <p className="text-sm text-amber-200/90">
          Execute um novo dry-run PASSED para liberar o formulário de instruction REAL
          manual. O dry-run não envia ordem.
        </p>
      </div>
    );
  }

  const entryHintPrice =
    orderType !== "MARKET" ? parseOptionalPositive(orderPrice) : undefined;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (confirm.trim() !== FIRST_REAL_DISPATCH_CONFIRM_PHRASE) {
      setMessage(`Digite exatamente: ${FIRST_REAL_DISPATCH_CONFIRM_PHRASE}`);
      return;
    }

    const parsedOrderPrice =
      orderType === "MARKET" ? undefined : parseOptionalPositive(orderPrice);
    const parsedStop = parseOptionalPositive(stopLossPrice);
    const parsedTake = parseOptionalPositive(takeProfitPrice);

    const validation = validateRealManualOrderFields({
      orderType,
      orderPrice: parsedOrderPrice ?? null,
      stopLossPrice: parsedStop ?? null,
      takeProfitPrice: parsedTake ?? null,
    });
    if (validation) {
      setMessage(validation.message);
      return;
    }

    const payload = {
      preflightId: selected.id,
      licenseId: selected.licenseId,
      accountLogin: selected.accountLogin,
      accountServer: selected.accountServer,
      symbol: selected.symbol,
      side,
      orderType,
      stopLossPrice: parsedStop,
      takeProfitPrice: parsedTake,
      requestedContracts: 1,
      magicNumber: selected.magicNumber,
      adminConfirmation: confirm.trim(),
      ...(parsedOrderPrice != null ? { orderPrice: parsedOrderPrice } : {}),
    };

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
      setStopLossPrice("");
      setTakeProfitPrice("");
      router.refresh();
    } catch {
      setMessage("Erro de rede.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border border-gold/30 bg-gold/5 p-5"
      data-testid="real-manual-dispatch-form"
    >
      <div>
        <h3 className="text-base font-semibold">Criar instruction REAL manual</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Disponível somente com dry-run PASSED recente (últimos 15 minutos). Esta ação
          cria uma instruction REAL que poderá ser buscada pelo EA — não envia ordem
          diretamente.
        </p>
      </div>

      <label className="block text-sm">
        <span className="text-muted-foreground">PreflightId (readonly)</span>
        <select
          className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 text-sm font-mono"
          value={preflightId}
          onChange={(e) => setPreflightId(e.target.value)}
        >
          {preflights.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id} | {p.symbol} | {p.accountLogin}@{p.accountServer}
            </option>
          ))}
        </select>
      </label>

      {selected && (
        <dl className="grid gap-2 text-xs sm:grid-cols-2 rounded border border-white/10 bg-black/20 p-3">
          <div>
            <dt className="text-muted-foreground">LicenseId</dt>
            <dd className="font-mono break-all">{selected.licenseId}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Conta MT5</dt>
            <dd className="font-mono">{selected.accountLogin}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Servidor</dt>
            <dd className="font-mono">{selected.accountServer}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Símbolo</dt>
            <dd className="font-mono">{selected.symbol}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">MagicNumber</dt>
            <dd className="font-mono">{selected.magicNumber}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Contratos</dt>
            <dd className="font-mono">1</dd>
          </div>
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
            onChange={(e) =>
              setOrderType(e.target.value as "MARKET" | "LIMIT" | "STOP")
            }
            data-testid="order-type-select"
          >
            <option value="MARKET">MARKET — A mercado</option>
            <option value="LIMIT">LIMIT — Limitada</option>
            <option value="STOP">STOP — Stop</option>
          </select>
        </label>
      </div>

      {orderType !== "MARKET" && (
        <label className="block text-sm" data-testid="order-price-field">
          <span className="text-muted-foreground">Preço de apregoamento</span>
          <input
            className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono"
            value={orderPrice}
            onChange={(e) => setOrderPrice(e.target.value)}
            placeholder="Ex.: 5650.5"
            required
          />
          <p className="mt-1 text-xs text-muted-foreground">{ORDER_TYPE_HELP[orderType]}</p>
        </label>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm" data-testid="stop-loss-field">
          <span className="text-muted-foreground">Stop Loss</span>
          <input
            className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono"
            value={stopLossPrice}
            onChange={(e) => setStopLossPrice(e.target.value)}
            placeholder="Ex.: 5643.5"
            required
          />
        </label>
        <label className="block text-sm" data-testid="take-profit-field">
          <span className="text-muted-foreground">Take Profit</span>
          <input
            className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono"
            value={takeProfitPrice}
            onChange={(e) => setTakeProfitPrice(e.target.value)}
            placeholder="Ex.: 5660.5"
            required
          />
        </label>
      </div>

      <p className="text-xs text-muted-foreground">{slTpDirectionHint(side, entryHintPrice)}</p>

      {(stopLossPrice || takeProfitPrice || orderPrice) && (
        <div className="rounded border border-gold/20 bg-black/30 p-3 text-xs space-y-1">
          <p className="font-semibold text-gold">Resumo antes da confirmação</p>
          <p>Tipo: {orderType} · Lado: {side}</p>
          {orderType !== "MARKET" && orderPrice && <p>Preço: {orderPrice}</p>}
          {stopLossPrice && <p>Stop Loss: {stopLossPrice}</p>}
          {takeProfitPrice && <p>Take Profit: {takeProfitPrice}</p>}
        </div>
      )}

      <label className="block text-sm">
        <span className="text-muted-foreground">
          Confirmação:{" "}
          <span className="font-mono text-gold">{FIRST_REAL_DISPATCH_CONFIRM_PHRASE}</span>
        </span>
        <input
          className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>

      <p className="text-xs text-amber-300">
        Use somente com MT5 aberto, EA online, mercado monitorado e proteção obrigatória.
      </p>

      <button
        type="submit"
        disabled={busy}
        className="rounded bg-gold px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
      >
        {busy ? "Criando…" : "Criar instruction REAL manual"}
      </button>
      {message && <p className="text-sm text-amber-200">{message}</p>}
    </form>
  );
}
