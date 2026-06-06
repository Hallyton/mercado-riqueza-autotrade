"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  REAL_TRADING_APPROVAL_LIMIT_EDIT_PHRASE,
} from "@/lib/admin/real-trading-approval-limit-constants";

export type ApprovalLimitEditView = {
  approvalId: string;
  licenseId: string;
  accountLogin: string;
  accountServer: string;
  symbol: string;
  magicNumber: number;
  status: string;
  allowReal: boolean;
  maxContracts: number;
  minFreeMargin: number;
  marginBufferPercent: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  editable: boolean;
  strategyConfigHref: string;
};

type LimitUpdateSuccess = {
  ok: true;
  requestId: string;
  approvalId: string;
  previous: {
    maxContracts: number;
    marginFreeMin: number;
    marginBufferPercent: number;
  };
  current: {
    maxContracts: number;
    marginFreeMin: number;
    marginBufferPercent: number;
  };
};

type LimitUpdateError = {
  ok: false;
  requestId: string;
  code: string;
  message: string;
  detail?: string;
  actionHint?: string;
  fieldErrors?: Record<string, string>;
};

export function RealTradingApprovalLimitEditPanel({
  approval,
}: {
  approval: ApprovalLimitEditView;
}) {
  const router = useRouter();
  const [maxContracts, setMaxContracts] = useState(String(approval.maxContracts));
  const [minFreeMargin, setMinFreeMargin] = useState(String(approval.minFreeMargin));
  const [marginBuffer, setMarginBuffer] = useState(
    String(approval.marginBufferPercent)
  );
  const [adminNotes, setAdminNotes] = useState(approval.notes ?? "");
  const [adminConfirmation, setAdminConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [success, setSuccess] = useState<LimitUpdateSuccess | null>(null);
  const [error, setError] = useState<LimitUpdateError | null>(null);

  const increasingContracts = useMemo(() => {
    const next = Number(maxContracts);
    return Number.isFinite(next) && next > approval.maxContracts;
  }, [maxContracts, approval.maxContracts]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(
        `/api/admin/real-trading/approvals/${approval.approvalId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            max_contracts: Number(maxContracts),
            min_free_margin: Number(minFreeMargin),
            margin_buffer_percent: Number(marginBuffer),
            admin_notes: adminNotes.trim() || undefined,
            admin_confirmation: adminConfirmation.trim(),
          }),
        }
      );
      const data = (await res.json()) as LimitUpdateSuccess | LimitUpdateError;

      if (!res.ok || !("ok" in data) || data.ok === false) {
        setError(data as LimitUpdateError);
        return;
      }

      setSuccess(data);
      setShowForm(false);
      router.refresh();
    } catch {
      setError({
        ok: false,
        requestId: "network-error",
        code: "UNKNOWN_APPROVAL_UPDATE_ERROR",
        message: "Erro de rede ao atualizar limite operacional.",
        actionHint: "Verifique conexão e tente novamente.",
      });
    } finally {
      setBusy(false);
    }
  }

  function copyDiagnostics() {
    if (!error) return;
    void navigator.clipboard.writeText(JSON.stringify(error, null, 2));
  }

  return (
    <Card className="border-gold/20 p-6">
      <CardHeader className="p-0">
        <CardTitle>Limite operacional</CardTitle>
        <CardDescription className="mt-1">
          Trava da aprovação REAL — editável sem revogar/recriar. Campos de
          identidade (conta, símbolo, magic) são readonly.
        </CardDescription>
      </CardHeader>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">maxContracts</dt>
          <dd className="font-medium">{approval.maxContracts}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Margem livre mínima</dt>
          <dd>{approval.minFreeMargin}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Buffer margem %</dt>
          <dd>{approval.marginBufferPercent}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            {approval.status} · allowReal {approval.allowReal ? "sim" : "não"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Licença</dt>
          <dd className="font-mono text-xs">{approval.licenseId}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Conta / Servidor</dt>
          <dd className="font-mono text-xs">
            {approval.accountLogin} @ {approval.accountServer}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Símbolo / Magic</dt>
          <dd>
            {approval.symbol} / {approval.magicNumber}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Criado / Atualizado</dt>
          <dd className="text-xs">
            {new Date(approval.createdAt).toLocaleString("pt-BR")} ·{" "}
            {new Date(approval.updatedAt).toLocaleString("pt-BR")}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {approval.editable && !showForm && (
          <Button type="button" onClick={() => setShowForm(true)}>
            Editar limite operacional
          </Button>
        )}
        <Link
          href={approval.strategyConfigHref}
          className="inline-flex h-11 items-center justify-center rounded-lg border border-gold/40 px-5 text-sm font-semibold text-gold hover:border-gold hover:bg-gold/10"
        >
          Abrir strategy-config da licença
        </Link>
      </div>

      {success && (
        <Card className="mt-4 border-emerald-500/40 bg-emerald-500/5 p-4">
          <p className="text-sm font-medium text-emerald-200">
            Limite operacional atualizado com sucesso.
          </p>
          <p className="mt-2 text-xs text-emerald-100/80">
            maxContracts: {success.previous.maxContracts} →{" "}
            {success.current.maxContracts} · RequestId:{" "}
            <span className="font-mono">{success.requestId}</span>
          </p>
        </Card>
      )}

      {error && (
        <Card className="mt-4 border-red-500/40 bg-red-500/5 p-4">
          <p className="text-sm font-medium text-red-200">
            Falha ao atualizar limite
          </p>
          <dl className="mt-2 space-y-1 text-xs">
            <div>
              <dt className="text-muted-foreground">Código</dt>
              <dd className="font-mono">{error.code}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Mensagem</dt>
              <dd>{error.message}</dd>
            </div>
            {error.detail && (
              <div>
                <dt className="text-muted-foreground">Detalhe</dt>
                <dd>{error.detail}</dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">RequestId</dt>
              <dd className="font-mono">{error.requestId}</dd>
            </div>
            {error.actionHint && (
              <div>
                <dt className="text-muted-foreground">Ação</dt>
                <dd>{error.actionHint}</dd>
              </div>
            )}
          </dl>
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="outline" onClick={copyDiagnostics}>
              Copiar diagnóstico
            </Button>
            <Button type="button" variant="ghost" onClick={() => setError(null)}>
              Tentar novamente
            </Button>
          </div>
        </Card>
      )}

      {showForm && approval.editable && (
        <form onSubmit={onSubmit} className="mt-6 space-y-4 border-t border-white/10 pt-6">
          <dl className="grid gap-2 rounded-lg border border-white/10 bg-black/20 p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Licença (readonly)</dt>
              <dd className="font-mono text-xs">{approval.licenseId}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status (readonly)</dt>
              <dd>{approval.status}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Conta (readonly)</dt>
              <dd className="font-mono text-xs">{approval.accountLogin}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Servidor (readonly)</dt>
              <dd>{approval.accountServer}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Símbolo (readonly)</dt>
              <dd>{approval.symbol}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Magic (readonly)</dt>
              <dd>{approval.magicNumber}</dd>
            </div>
          </dl>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="text-muted-foreground">maxContracts *</span>
              <input
                type="number"
                min={1}
                max={100}
                className="mt-1 w-full rounded-md border border-white/10 bg-background px-3 py-2"
                value={maxContracts}
                onChange={(e) => setMaxContracts(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Margem livre mín. *</span>
              <input
                type="number"
                min={0}
                step="any"
                className="mt-1 w-full rounded-md border border-white/10 bg-background px-3 py-2"
                value={minFreeMargin}
                onChange={(e) => setMinFreeMargin(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Buffer margem % *</span>
              <input
                type="number"
                min={0}
                max={100}
                className="mt-1 w-full rounded-md border border-white/10 bg-background px-3 py-2"
                value={marginBuffer}
                onChange={(e) => setMarginBuffer(e.target.value)}
                required
              />
            </label>
          </div>

          {increasingContracts && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Você está aumentando o limite operacional real desta licença. Esta
              alteração pode permitir que estratégias operem com maior exposição.
              Confirme apenas se o cliente possui saldo, margem e stop financeiro
              diário compatíveis.
            </p>
          )}

          <label className="block text-sm">
            <span className="text-muted-foreground">Notas admin</span>
            <textarea
              className="mt-1 w-full rounded-md border border-white/10 bg-background px-3 py-2"
              rows={2}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
            />
          </label>

          <label className="block text-sm">
            <span className="text-muted-foreground">
              Confirmação — digite:{" "}
              <span className="font-mono text-gold">
                {REAL_TRADING_APPROVAL_LIMIT_EDIT_PHRASE}
              </span>
            </span>
            <input
              className="mt-1 w-full rounded-md border border-gold/30 bg-background px-3 py-2 font-mono"
              value={adminConfirmation}
              onChange={(e) => setAdminConfirmation(e.target.value)}
              autoComplete="off"
              required
            />
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              {busy ? "Salvando…" : "Salvar limite operacional"}
            </button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setShowForm(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
