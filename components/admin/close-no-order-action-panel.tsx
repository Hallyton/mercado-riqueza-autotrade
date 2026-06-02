"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  CLOSE_NO_ORDER_CONFIRM_PHRASE,
  CLOSE_NO_ORDER_REASON_CODE,
  type CloseNoOrderEligibility,
  type OperatorAttestation,
} from "@/lib/admin/real-manual-close-no-order";

const DEFAULT_NOTE =
  "Ordem LIMIT não foi apregoada no MT5 por falha/rejeição da bolsa. Nenhuma ordem pendente, nenhuma posição aberta e nenhuma exposição de risco.";

export type CloseNoOrderActionPanelProps = {
  instructionId: string;
  source: string | null;
  status: string;
  executionStatus: string | null;
  protectionStatus: string | null;
  canCloseNoOrder: boolean;
  eligibility: CloseNoOrderEligibility;
  reasonCode?: string;
  defaultOperatorNote?: string;
};

export function CloseNoOrderActionPanel({
  instructionId,
  canCloseNoOrder,
  eligibility,
  defaultOperatorNote = DEFAULT_NOTE,
}: CloseNoOrderActionPanelProps) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [operatorNote, setOperatorNote] = useState(defaultOperatorNote);
  const [confirm, setConfirm] = useState("");
  const [attestNoPending, setAttestNoPending] = useState(false);
  const [attestNoPosition, setAttestNoPosition] = useState(false);
  const [attestNoRisk, setAttestNoRisk] = useState(false);
  const [attestNewPreflight, setAttestNewPreflight] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code?: string; detail?: string } | null>(null);
  const [success, setSuccess] = useState(false);

  const attestationComplete = useMemo(
    () => attestNoPending && attestNoPosition && attestNoRisk && attestNewPreflight,
    [attestNoPending, attestNoPosition, attestNoRisk, attestNewPreflight]
  );

  const canSubmit = useMemo(
    () =>
      attestationComplete &&
      operatorNote.trim().length >= 10 &&
      confirm.trim() === CLOSE_NO_ORDER_CONFIRM_PHRASE,
    [attestationComplete, operatorNote, confirm]
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || busy) return;

    setBusy(true);
    setError(null);
    const operatorAttestation: OperatorAttestation = {
      noPendingOrder: true,
      noOpenPosition: true,
      noRiskExposure: true,
      requiresNewPreflight: true,
    };

    try {
      const res = await fetch(
        `/api/admin/real-trading/instructions/${instructionId}/close-no-order`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reasonCode: CLOSE_NO_ORDER_REASON_CODE,
            operatorNote,
            operatorAttestation,
            adminConfirmation: confirm,
          }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        message?: string;
      };
      if (!res.ok) {
        setError({
          code: data.code ?? "CLOSE_NO_ORDER_FAILED",
          detail: data.error ?? data.message ?? "Falha ao encerrar instruction.",
        });
        return;
      }
      setSuccess(true);
      setFormOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div
        className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 p-4 text-sm text-emerald-200"
        data-testid="close-no-order-success"
      >
        Instruction encerrada sem ordem apregoada. Nenhuma ordem pendente, nenhuma posição
        aberta e nenhuma exposição de risco foram atestadas pelo operador.
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="close-no-order-action-panel">
      <p className="text-sm text-muted-foreground">
        Use esta ação somente quando o operador confirmou no MT5 que a ordem não foi
        apregoada, não existe ordem pendente, não existe posição aberta e não há exposição
        de risco.
      </p>

      {eligibility.heartbeatWarning && (
        <p
          className="rounded border border-amber-500/40 bg-amber-950/20 p-3 text-sm text-amber-200"
          data-testid="close-no-order-heartbeat-warning"
        >
          {eligibility.heartbeatWarning}
        </p>
      )}

      {!canCloseNoOrder && eligibility.blockReason && (
        <p className="text-sm text-amber-300" data-testid="close-no-order-block-reason">
          {eligibility.blockReason}
        </p>
      )}

      {error && (
        <div
          className="rounded border border-red-500/40 bg-red-950/20 p-3 text-sm text-red-200"
          data-testid="close-no-order-error"
        >
          <p className="font-medium">{error.code ?? "ERRO"}</p>
          <p className="mt-1">{error.detail}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Verifique confirmação textual, atestações e elegibilidade da instruction.
          </p>
        </div>
      )}

      {canCloseNoOrder && !formOpen && (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="rounded bg-gold px-4 py-2 text-sm font-medium text-black"
          data-testid="close-no-order-open-button"
        >
          Encerrar sem ordem apregoada
        </button>
      )}

      {canCloseNoOrder && formOpen && (
        <form onSubmit={onSubmit} className="space-y-4" data-testid="close-no-order-form">
          <fieldset className="space-y-2 rounded border border-white/10 bg-black/20 p-3 text-sm">
            <legend className="px-1 text-muted-foreground">
              Atestação operacional (obrigatória)
            </legend>
            <label className="flex gap-2 items-start">
              <input
                type="checkbox"
                checked={attestNoPending}
                onChange={(e) => setAttestNoPending(e.target.checked)}
                data-testid="attest-no-pending-order"
              />
              <span>
                Verifiquei no MT5 que não há ordem pendente ativa para esta instruction.
              </span>
            </label>
            <label className="flex gap-2 items-start">
              <input
                type="checkbox"
                checked={attestNoPosition}
                onChange={(e) => setAttestNoPosition(e.target.checked)}
                data-testid="attest-no-open-position"
              />
              <span>Verifiquei no MT5 que não há posição aberta para esta instruction.</span>
            </label>
            <label className="flex gap-2 items-start">
              <input
                type="checkbox"
                checked={attestNoRisk}
                onChange={(e) => setAttestNoRisk(e.target.checked)}
                data-testid="attest-no-risk-exposure"
              />
              <span>Confirmo que não há exposição de risco associada a esta tentativa.</span>
            </label>
            <label className="flex gap-2 items-start">
              <input
                type="checkbox"
                checked={attestNewPreflight}
                onChange={(e) => setAttestNewPreflight(e.target.checked)}
                data-testid="attest-requires-new-preflight"
              />
              <span>
                Entendo que uma nova tentativa exigirá novo preflight PASSED.
              </span>
            </label>
          </fieldset>

          <label className="block text-sm">
            <span className="text-muted-foreground">Reason code</span>
            <input
              readOnly
              value={CLOSE_NO_ORDER_REASON_CODE}
              data-testid="close-no-order-reason"
              className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-xs"
            />
          </label>

          <label className="block text-sm">
            <span className="text-muted-foreground">Nota operacional</span>
            <textarea
              value={operatorNote}
              onChange={(e) => setOperatorNote(e.target.value)}
              rows={3}
              required
              className="mt-1 w-full rounded border border-white/10 bg-background px-2 py-1.5 text-sm"
              data-testid="close-no-order-note"
            />
          </label>

          <label className="block text-sm">
            <span className="text-muted-foreground">
              Confirmação (digite exatamente): {CLOSE_NO_ORDER_CONFIRM_PHRASE}
            </span>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="mt-1 w-full rounded border border-white/10 bg-background px-2 py-1.5 font-mono text-xs"
              data-testid="close-no-order-confirm"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy || !canSubmit}
              className="rounded bg-gold px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
              data-testid="close-no-order-submit"
            >
              {busy ? "Encerrando instruction…" : "Confirmar encerramento"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setFormOpen(false)}
              className="rounded border border-white/20 px-3 py-1.5 text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
