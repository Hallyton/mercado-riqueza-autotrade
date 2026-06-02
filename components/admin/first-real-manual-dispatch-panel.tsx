"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FIRST_REAL_DISPATCH_CONFIRM_PHRASE } from "@/lib/admin/real-manual-dispatch";
import {
  createDefaultManagementPlan,
  type RealManualManagementPlan,
} from "@/lib/admin/real-manual-management-plan";
import {
  parseOptionalPositive,
  validateRealManualOrderFields,
} from "@/lib/admin/real-manual-dispatch-validation";
import {
  ManagementPlanFormState,
  ManagementPlanSummary,
  RealManualManagementPlanFields,
  validateManagementPlanForm,
} from "@/components/admin/real-manual-management-plan-fields";

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
  const [managementPlan, setManagementPlan] = useState<ManagementPlanFormState>(
    createDefaultManagementPlan()
  );
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    instructionId: string;
    status?: string;
    alreadyExists?: boolean;
  } | null>(null);

  const requestedContracts = selected?.requestedContracts ?? 1;

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

    const planError = validateManagementPlanForm({
      plan: managementPlan,
      requestedContracts,
      side,
      entryPrice: parsedOrderPrice,
    });
    if (planError) {
      setMessage(planError);
      return;
    }

    const planForSubmit: RealManualManagementPlan = {
      ...managementPlan,
      initialStopLoss: managementPlan.initialStopLoss,
    };

    const stopLossPrice = planForSubmit.initialStopLoss;
    const takeProfitPrice =
      (planForSubmit.takes[0].enabled && planForSubmit.takes[0].price) ||
      (planForSubmit.takes[1].enabled && planForSubmit.takes[1].price) ||
      stopLossPrice;

    const validation = validateRealManualOrderFields({
      orderType,
      orderPrice: parsedOrderPrice ?? null,
      stopLossPrice,
      takeProfitPrice: takeProfitPrice as number,
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
      managementPlan: planForSubmit,
      requestedContracts,
      magicNumber: selected.magicNumber,
      adminConfirmation: confirm.trim(),
      ...(parsedOrderPrice != null ? { orderPrice: parsedOrderPrice } : {}),
    };

    setBusy(true);
    setMessage(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/real-trading/dispatch-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (
          data.code === "REAL_MANUAL_ALREADY_DISPATCHED" &&
          data.existingInstructionId
        ) {
          setSuccess({
            instructionId: data.existingInstructionId,
            status: data.existingStatus,
            alreadyExists: true,
          });
          setMessage("Instruction REAL_MANUAL já existe para este preflight.");
          return;
        }
        setMessage(data.error ?? "Falha ao criar instruction REAL.");
        return;
      }
      setSuccess({
        instructionId: data.instructionId,
        status: data.status,
      });
      setMessage(null);
      setConfirm("");
      setOrderPrice("");
      setManagementPlan(createDefaultManagementPlan());
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
            <dd className="font-mono">{requestedContracts}</dd>
          </div>
        </dl>
      )}

      <section className="space-y-3">
        <h4 className="text-sm font-semibold">Ordem de entrada</h4>
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
            <p className="mt-1 text-xs text-muted-foreground">
              {ORDER_TYPE_HELP[orderType]}
            </p>
          </label>
        )}
      </section>

      <RealManualManagementPlanFields
        plan={managementPlan}
        onChange={setManagementPlan}
        side={side}
        entryPrice={entryHintPrice}
        requestedContracts={requestedContracts}
      />

      <ManagementPlanSummary
        plan={managementPlan}
        side={side}
        orderType={orderType}
        orderPrice={orderPrice}
        requestedContracts={requestedContracts}
      />

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
      {message && (
        <p className="text-sm text-amber-200" data-testid="dispatch-error-message">
          {message}
        </p>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 p-4 text-sm space-y-2">
          <p className="font-medium text-emerald-300">
            {success.alreadyExists
              ? "REAL_MANUAL_ALREADY_DISPATCHED"
              : "Instruction REAL_MANUAL criada com sucesso"}
          </p>
          <p className="font-mono text-xs break-all">InstructionId: {success.instructionId}</p>
          <p>Source: REAL_MANUAL · Status: {success.status ?? "RECEIVED"}</p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href={`/admin/real-trading/instructions/${success.instructionId}`}
              className="text-gold hover:underline"
            >
              Abrir em Conta real / Instruções reais
            </Link>
            <Link href="/admin/real-trading/protection" className="text-gold hover:underline">
              Abrir Proteção SL/TP
            </Link>
          </div>
        </div>
      )}
    </form>
  );
}
