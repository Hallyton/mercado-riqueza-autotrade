"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DryRunResult = {
  dryRun: boolean;
  status: string;
  passed: boolean;
  reasonCode?: string;
  reason?: string;
  preflightId?: string;
  readyForManualInstruction?: string | null;
  flags?: {
    marginOk: boolean;
    eaOnline: boolean;
    snapshotOk: boolean;
    realApprovalOk: boolean;
    protectionPreviousOk: boolean;
    deviceOk: boolean;
    accountOk: boolean;
    licenseOk: boolean;
    subscriptionOk: boolean;
    paymentOk: boolean;
  };
  checks?: { key: string; ok: boolean; detail?: string }[];
};

function flagLabel(ok: boolean) {
  return ok ? "OK" : "Falha";
}

export function PreflightDryRunPanel({
  defaultLicenseId = "",
  defaultAccountLogin = "",
  defaultAccountServer = "",
  defaultSymbol = "",
  defaultMagicNumber = "",
}: {
  defaultLicenseId?: string;
  defaultAccountLogin?: string;
  defaultAccountServer?: string;
  defaultSymbol?: string;
  defaultMagicNumber?: string;
}) {
  const router = useRouter();
  const [licenseId, setLicenseId] = useState(defaultLicenseId);
  const [accountLogin, setAccountLogin] = useState(defaultAccountLogin);
  const [accountServer, setAccountServer] = useState(defaultAccountServer);
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [magicNumber, setMagicNumber] = useState(defaultMagicNumber);
  const [requestedContracts, setRequestedContracts] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DryRunResult | null>(null);

  async function onRun() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/real-trading/preflight-dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseId: licenseId.trim(),
          accountLogin: accountLogin.trim(),
          accountServer: accountServer.trim(),
          symbol: symbol.trim(),
          magicNumber: Number.parseInt(magicNumber.trim(), 10),
          requestedContracts: Number.parseInt(requestedContracts.trim(), 10) || 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Falha no dry-run.");
        return;
      }
      setResult(data as DryRunResult);
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setBusy(false);
    }
  }

  const statusClass =
    result?.status === "PASSED"
      ? "text-emerald-400"
      : result?.status === "BLOCKED"
        ? "text-amber-400"
        : "text-red-300";

  return (
    <div className="rounded-lg border border-gold/30 bg-gold/5 p-5 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">
          Preflight dry-run (conta real)
        </h3>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Valida o gate REAL sem criar instruction entregue ao EA e sem enviar
          ordem. O resultado é registrado como{" "}
          <span className="font-mono text-gold">DRY_RUN</span> na tabela abaixo.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 text-sm">
        <label className="block sm:col-span-2">
          <span className="text-muted-foreground">License ID</span>
          <input
            className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono text-xs"
            value={licenseId}
            onChange={(e) => setLicenseId(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-muted-foreground">Conta MT5</span>
          <input
            className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono"
            value={accountLogin}
            onChange={(e) => setAccountLogin(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-muted-foreground">Servidor</span>
          <input
            className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono"
            value={accountServer}
            onChange={(e) => setAccountServer(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-muted-foreground">Símbolo</span>
          <input
            className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-muted-foreground">MagicNumber</span>
          <input
            className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono"
            value={magicNumber}
            onChange={(e) => setMagicNumber(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-muted-foreground">Contratos</span>
          <input
            className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono"
            value={requestedContracts}
            onChange={(e) => setRequestedContracts(e.target.value)}
          />
        </label>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={onRun}
        className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
      >
        {busy ? "Executando…" : "Executar preflight dry-run"}
      </button>

      {error && <p className="text-sm text-red-300">{error}</p>}

      {result && (
        <div className="rounded-lg border border-white/10 bg-black/40 p-4 space-y-3 text-sm">
          <p>
            Status:{" "}
            <span className={`font-mono font-semibold ${statusClass}`}>
              {result.status}
            </span>
            {result.dryRun && (
              <span className="ml-2 rounded bg-white/10 px-2 py-0.5 text-xs font-mono">
                DRY_RUN
              </span>
            )}
          </p>
          <p className="font-mono text-xs break-all">
            reasonCode: {result.reasonCode ?? "—"}
          </p>
          <p className="text-muted-foreground">{result.reason ?? "—"}</p>
          {result.passed && (
            <p className="text-emerald-300 font-medium">
              REAL_TRADING_ALLOWED_BY_CONTROLLED_GATE — critérios OK no dry-run.
            </p>
          )}
          {result.readyForManualInstruction && (
            <p className="text-amber-200/90">{result.readyForManualInstruction}</p>
          )}
          {result.flags && (
            <dl className="grid gap-2 sm:grid-cols-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Margem</dt>
                <dd>{flagLabel(result.flags.marginOk)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">EA online</dt>
                <dd>{flagLabel(result.flags.eaOnline)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Snapshot PRE_MARKET</dt>
                <dd>{flagLabel(result.flags.snapshotOk)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Approval</dt>
                <dd>{flagLabel(result.flags.realApprovalOk)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Proteção anterior</dt>
                <dd>{flagLabel(result.flags.protectionPreviousOk)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Device</dt>
                <dd>{flagLabel(result.flags.deviceOk)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Conta licença</dt>
                <dd>{flagLabel(result.flags.accountOk)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Assinatura</dt>
                <dd>{flagLabel(result.flags.subscriptionOk)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Pagamento</dt>
                <dd>{flagLabel(result.flags.paymentOk)}</dd>
              </div>
            </dl>
          )}
          <p className="text-xs text-muted-foreground">
            Nenhuma instruction foi criada. Nenhuma ordem foi enviada.
          </p>
        </div>
      )}
    </div>
  );
}
