"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { REAL_TRADING_APPROVAL_CONFIRM_PHRASE } from "@/lib/admin/real-trading-approval";
import type {
  ApprovalCreateErrorPayload,
  ApprovalCreateSuccessPayload,
} from "@/lib/admin/real-trading-approval-create";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type RealTradingLicenseOption = {
  licenseId: string;
  userId: string;
  clientEmail: string;
  mt5Label: string | null;
};

type FormPayload = {
  user_id: string;
  license_id: string;
  account_login: string;
  account_server: string;
  symbol: string;
  magic_number: number;
  max_contracts: number;
  min_free_margin: number;
  margin_buffer_percent: number;
  notes?: string;
  admin_confirmation: string;
};

function redactPayloadForDisplay(payload: FormPayload): Record<string, unknown> {
  return {
    license_id: payload.license_id,
    account_login: payload.account_login.replace(/.(?=.{4})/g, "*"),
    account_server: payload.account_server,
    symbol: payload.symbol,
    magic_number: payload.magic_number,
    max_contracts: payload.max_contracts,
    min_free_margin: payload.min_free_margin,
    margin_buffer_percent: payload.margin_buffer_percent,
    notes: payload.notes ? "[presente]" : undefined,
    admin_confirmation: "[REDACTED]",
  };
}

export function RealTradingApprovalForm({
  licenses,
}: {
  licenses: RealTradingLicenseOption[];
}) {
  const router = useRouter();
  const [licenseId, setLicenseId] = useState(licenses[0]?.licenseId ?? "");
  const [accountLogin, setAccountLogin] = useState("");
  const [accountServer, setAccountServer] = useState("");
  const [symbol, setSymbol] = useState("WDON26");
  const [magicNumber, setMagicNumber] = useState("910001");
  const [maxContracts, setMaxContracts] = useState("1");
  const [minFreeMargin, setMinFreeMargin] = useState("");
  const [marginBuffer, setMarginBuffer] = useState("15");
  const [notes, setNotes] = useState("");
  const [adminConfirmation, setAdminConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<ApprovalCreateErrorPayload | null>(null);
  const [success, setSuccess] = useState<ApprovalCreateSuccessPayload | null>(null);
  const [lastPayload, setLastPayload] = useState<Record<string, unknown> | null>(
    null
  );

  const selected = licenses.find((l) => l.licenseId === licenseId);

  function buildPayload(): FormPayload | null {
    if (!selected) return null;
    const minMargin = Number(minFreeMargin);
    return {
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
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setClientError(null);
    setApiError(null);
    setSuccess(null);

    if (!selected) {
      setClientError("Selecione uma licença.");
      return;
    }
    if (adminConfirmation.trim() !== REAL_TRADING_APPROVAL_CONFIRM_PHRASE) {
      setClientError(
        `Confirmação obrigatória: digite exatamente "${REAL_TRADING_APPROVAL_CONFIRM_PHRASE}".`
      );
      return;
    }
    const payload = buildPayload();
    if (!payload) return;

    const minMargin = payload.min_free_margin;
    if (!Number.isFinite(minMargin) || minMargin <= 0) {
      setClientError("Margem livre mínima deve ser maior que zero.");
      return;
    }

    setLastPayload(redactPayloadForDisplay(payload));
    setBusy(true);

    try {
      const res = await fetch("/api/admin/real-trading/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as
        | ApprovalCreateSuccessPayload
        | ApprovalCreateErrorPayload;

      if (!res.ok || !("ok" in data) || data.ok === false) {
        const err = data as ApprovalCreateErrorPayload;
        setApiError({
          ...err,
          submittedPayload: err.submittedPayload ?? lastPayload ?? undefined,
        });
        return;
      }

      setSuccess(data as ApprovalCreateSuccessPayload);
    } catch {
      setClientError("Erro de rede ao criar aprovação.");
    } finally {
      setBusy(false);
    }
  }

  function copyDiagnostics() {
    if (!apiError) return;
    const text = JSON.stringify(apiError, null, 2);
    void navigator.clipboard.writeText(text);
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
        Esta aprovação não envia ordem. Ela apenas permite que o preflight avalie a
        sessão real. A ordem continua dependendo de dispatch manual, margem, snapshot,
        EA online e proteção SL/TP.
      </div>

      {success && (
        <Card className="border-emerald-500/40 bg-emerald-500/5 p-5">
          <CardTitle className="text-base text-emerald-200">
            Aprovação criada com sucesso
          </CardTitle>
          <CardDescription className="mt-2 text-sm text-emerald-100/90">
            Status: {success.status} · RequestId:{" "}
            <span className="font-mono text-xs">{success.requestId}</span>
          </CardDescription>
          <div className="mt-4 flex flex-wrap gap-2">
            {success.links?.approval && (
              <Link
                href={success.links.approval}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-gold px-5 text-sm font-semibold text-black"
              >
                Abrir aprovação criada
              </Link>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/admin/real-trading/approvals")}
            >
              Voltar à lista
            </Button>
          </div>
        </Card>
      )}

      {apiError && (
        <Card className="border-red-500/40 bg-red-500/5 p-5">
          <CardTitle className="text-base text-red-200">
            Falha ao criar aprovação
          </CardTitle>
          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Código</dt>
              <dd className="font-mono">{apiError.code}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Mensagem</dt>
              <dd>{apiError.message}</dd>
            </div>
            {apiError.detail && (
              <div>
                <dt className="text-muted-foreground">Detalhe</dt>
                <dd>{apiError.detail}</dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">RequestId</dt>
              <dd className="font-mono text-xs">{apiError.requestId}</dd>
            </div>
            {apiError.actionHint && (
              <div>
                <dt className="text-muted-foreground">Ação recomendada</dt>
                <dd>{apiError.actionHint}</dd>
              </div>
            )}
            {apiError.fieldErrors && (
              <div>
                <dt className="text-muted-foreground">Campos</dt>
                <dd>
                  <ul className="mt-1 list-inside list-disc font-mono text-xs">
                    {Object.entries(apiError.fieldErrors).map(([k, v]) => (
                      <li key={k}>
                        {k}: {v}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
            {(apiError.submittedPayload || lastPayload) && (
              <div>
                <dt className="text-muted-foreground">Payload enviado (redigido)</dt>
                <dd>
                  <pre className="mt-1 overflow-x-auto rounded border border-white/10 bg-black/30 p-2 text-xs">
                    {JSON.stringify(apiError.submittedPayload ?? lastPayload, null, 2)}
                  </pre>
                </dd>
              </div>
            )}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            {apiError.links?.existingApproval && (
              <Link
                href={apiError.links.existingApproval}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-gold px-5 text-sm font-semibold text-black"
              >
                Abrir aprovação existente
              </Link>
            )}
            <Button type="button" variant="outline" onClick={copyDiagnostics}>
              Copiar diagnóstico
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setApiError(null);
                setClientError(null);
              }}
            >
              Tentar novamente
            </Button>
          </div>
        </Card>
      )}

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
      {clientError && <p className="text-sm text-amber-400">{clientError}</p>}
      <button
        type="submit"
        disabled={busy || Boolean(success)}
        className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
      >
        {busy ? "Criando aprovação…" : "Criar aprovação APPROVED"}
      </button>
    </form>
  );
}
