"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const CONFIRM_MESSAGE =
  "Esta ação criará instruções para os clientes elegíveis. Em produção, isso poderá gerar execução pelos EAs conectados. Confirme apenas se o sinal estiver correto.\n\nEm homologação, mantenha os EAs em DebugMode=true.\n\nDeseja continuar?";

export type DispatchResultSummary = {
  status: string;
  instructionsCreated: number;
  skipped: number;
  failed: number;
  idempotent: boolean;
  candidatesCount?: number;
  noEligibleLicenses?: boolean;
};

export function MasterSignalDispatchButton({
  masterSignalId,
  disabled,
  disabledReason,
}: {
  masterSignalId: string;
  disabled: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<DispatchResultSummary | null>(null);

  async function onDispatch() {
    if (!confirmed) {
      setMessage("Marque a confirmação antes de disparar.");
      return;
    }
    if (!window.confirm(CONFIRM_MESSAGE)) {
      return;
    }

    setBusy(true);
    setMessage(null);
    setResult(null);

    try {
      const res = await fetch(
        `/api/admin/master-signals/${encodeURIComponent(masterSignalId)}/dispatch`,
        { method: "POST" }
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        status?: string;
        instructionsCreated?: number;
        skipped?: number;
        failed?: number;
        idempotent?: boolean;
        candidatesCount?: number;
        noEligibleLicenses?: boolean;
      };

      if (!res.ok) {
        setMessage(data.error ?? `Erro HTTP ${res.status}`);
        return;
      }

      setResult({
        status: data.status ?? "—",
        instructionsCreated: data.instructionsCreated ?? 0,
        skipped: data.skipped ?? 0,
        failed: data.failed ?? 0,
        idempotent: Boolean(data.idempotent),
        candidatesCount: data.candidatesCount,
        noEligibleLicenses: data.noEligibleLicenses,
      });
      router.refresh();
    } catch {
      setMessage("Falha de rede ao disparar o sinal.");
    } finally {
      setBusy(false);
    }
  }

  if (disabled) {
    return (
      <p className="text-sm text-muted-foreground">
        {disabledReason ??
          "Disparo disponível apenas para sinais com status VALIDATED."}
      </p>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-gold/20 bg-gold/5 p-4">
      <p className="text-sm text-amber-200/90">
        Esta ação pode gerar instruções para EAs conectados. Em homologação,
        mantenha os EAs em <span className="font-mono">DebugMode=true</span>.
      </p>
      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>
          Confirmo que desejo disparar este sinal para clientes elegíveis e que
          revisei símbolo, lado, perfil e finalidade.
        </span>
      </label>
      <button
        type="button"
        disabled={busy || !confirmed}
        onClick={onDispatch}
        className="rounded-md border border-gold/40 bg-gold/15 px-4 py-2 text-sm font-medium text-gold transition hover:bg-gold/25 disabled:opacity-50"
      >
        {busy ? "Disparando…" : "Disparar para clientes"}
      </button>
      {message && <p className="text-sm text-red-400">{message}</p>}
      {result && (
        <div className="rounded border border-white/10 bg-black/30 p-3 text-sm">
          <p>
            <span className="text-muted-foreground">Status final:</span>{" "}
            <span className="font-medium text-foreground">{result.status}</span>
            {result.idempotent && (
              <span className="ml-2 text-xs text-muted-foreground">
                (idempotente)
              </span>
            )}
          </p>
          <p className="mt-1">
            Instruções criadas: {result.instructionsCreated} · Ignoradas:{" "}
            {result.skipped} · Falhas: {result.failed}
            {result.candidatesCount != null && (
              <> · Candidatos: {result.candidatesCount}</>
            )}
          </p>
          {result.noEligibleLicenses && (
            <p className="mt-2 text-amber-400">
              Nenhuma licença elegível — sinal permaneceu validado sem instruções.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
