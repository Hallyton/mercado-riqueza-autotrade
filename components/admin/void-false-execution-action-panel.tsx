"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  VOID_FALSE_EXECUTION_CONFIRM_PHRASE,
  VOID_FALSE_EXECUTION_REASON_CODE,
  type VoidFalseExecutionAttestation,
  type VoidFalseExecutionEligibility,
} from "@/lib/admin/real-manual-void-false-execution";

const DEFAULT_NOTE =
  "Retorno de execução preenchida foi falso positivo por falha/rejeição interna da B3/bolsa/broker. Verificado no MT5: nenhuma ordem pendente, nenhuma posição aberta e nenhuma exposição de risco.";

export function VoidFalseExecutionActionPanel({
  instructionId,
  canVoidFalseExecution,
  eligibility,
}: {
  instructionId: string;
  canVoidFalseExecution: boolean;
  eligibility: VoidFalseExecutionEligibility;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [operatorNote, setOperatorNote] = useState(DEFAULT_NOTE);
  const [confirm, setConfirm] = useState("");
  const [checkedMt5, setCheckedMt5] = useState(false);
  const [attestNoPending, setAttestNoPending] = useState(false);
  const [attestNoPosition, setAttestNoPosition] = useState(false);
  const [attestNoRisk, setAttestNoRisk] = useState(false);
  const [attestFalsePositive, setAttestFalsePositive] = useState(false);
  const [attestNewPreflight, setAttestNewPreflight] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code?: string; detail?: string } | null>(null);
  const [success, setSuccess] = useState(false);

  const attestationComplete = useMemo(
    () =>
      checkedMt5 &&
      attestNoPending &&
      attestNoPosition &&
      attestNoRisk &&
      attestFalsePositive &&
      attestNewPreflight,
    [
      checkedMt5,
      attestNoPending,
      attestNoPosition,
      attestNoRisk,
      attestFalsePositive,
      attestNewPreflight,
    ]
  );

  const canSubmit = useMemo(
    () =>
      attestationComplete &&
      operatorNote.trim().length >= 10 &&
      confirm.trim() === VOID_FALSE_EXECUTION_CONFIRM_PHRASE,
    [attestationComplete, operatorNote, confirm]
  );

  if (!canVoidFalseExecution && !eligibility.blockReason) {
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || busy) return;

    setBusy(true);
    setError(null);
    const operatorAttestation: VoidFalseExecutionAttestation = {
      checkedMt5: true,
      noPendingOrder: true,
      noOpenPosition: true,
      noRiskExposure: true,
      brokerExecutionWasFalsePositive: true,
      requiresNewPreflight: true,
    };

    try {
      const res = await fetch(
        `/api/admin/real-trading/instructions/${instructionId}/void-false-execution`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reasonCode: VOID_FALSE_EXECUTION_REASON_CODE,
            operatorNote,
            operatorAttestation,
            adminConfirmation: confirm,
          }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
      };
      if (!res.ok) {
        setError({
          code: data.code ?? "VOID_FALSE_EXECUTION_FAILED",
          detail: data.error ?? "Falha ao anular instruction.",
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
        data-testid="void-false-execution-success"
      >
        Instruction anulada por falso positivo de execução. Nenhuma ordem pendente,
        nenhuma posição aberta e nenhuma exposição de risco foram atestadas pelo
        operador.
      </div>
    );
  }

  return (
    <div
      className="space-y-4 rounded-lg border border-red-500/30 bg-red-950/10 p-4"
      data-testid="void-false-execution-panel"
    >
      <p className="text-sm text-muted-foreground">
        Use esta ação somente quando o sistema recebeu retorno de execução preenchida,
        mas o operador confirmou no MT5 que a ordem não foi apregoada, não há ordem
        pendente, não há posição aberta e não há exposição de risco.
      </p>

      {!canVoidFalseExecution && eligibility.blockReason && (
        <p className="text-sm text-amber-300">{eligibility.blockReason}</p>
      )}

      {eligibility.heartbeatWarning && (
        <p className="text-sm text-amber-200">{eligibility.heartbeatWarning}</p>
      )}

      {error && (
        <div
          className="rounded border border-red-500/40 bg-red-950/20 p-3 text-sm text-red-200"
          data-testid="void-false-execution-error"
        >
          <p className="font-medium">{error.code}</p>
          <p className="mt-1">{error.detail}</p>
        </div>
      )}

      {canVoidFalseExecution && !formOpen && (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="rounded border border-red-400/50 bg-red-950/30 px-4 py-2 text-sm font-medium text-red-100"
          data-testid="void-false-execution-open-button"
        >
          Anular falso positivo de execução
        </button>
      )}

      {canVoidFalseExecution && formOpen && (
        <form onSubmit={onSubmit} className="space-y-4" data-testid="void-false-execution-form">
          <fieldset className="space-y-2 text-sm">
            <legend className="text-muted-foreground">Atestação operacional</legend>
            <label className="flex gap-2 items-start">
              <input
                type="checkbox"
                checked={checkedMt5}
                onChange={(e) => setCheckedMt5(e.target.checked)}
                data-testid="attest-checked-mt5"
              />
              <span>Verifiquei no MT5 a aba Negociação.</span>
            </label>
            <label className="flex gap-2 items-start">
              <input
                type="checkbox"
                checked={attestNoPending}
                onChange={(e) => setAttestNoPending(e.target.checked)}
                data-testid="attest-void-no-pending"
              />
              <span>Verifiquei que não há ordem pendente ativa.</span>
            </label>
            <label className="flex gap-2 items-start">
              <input
                type="checkbox"
                checked={attestNoPosition}
                onChange={(e) => setAttestNoPosition(e.target.checked)}
                data-testid="attest-void-no-position"
              />
              <span>Verifiquei que não há posição aberta.</span>
            </label>
            <label className="flex gap-2 items-start">
              <input
                type="checkbox"
                checked={attestNoRisk}
                onChange={(e) => setAttestNoRisk(e.target.checked)}
                data-testid="attest-void-no-risk"
              />
              <span>Confirmo que não há exposição de risco.</span>
            </label>
            <label className="flex gap-2 items-start">
              <input
                type="checkbox"
                checked={attestFalsePositive}
                onChange={(e) => setAttestFalsePositive(e.target.checked)}
                data-testid="attest-broker-false-positive"
              />
              <span>
                Confirmo que o retorno de execução foi falso positivo da bolsa/broker.
              </span>
            </label>
            <label className="flex gap-2 items-start">
              <input
                type="checkbox"
                checked={attestNewPreflight}
                onChange={(e) => setAttestNewPreflight(e.target.checked)}
                data-testid="attest-void-new-preflight"
              />
              <span>Entendo que uma nova tentativa exigirá novo preflight PASSED.</span>
            </label>
          </fieldset>

          <label className="block text-sm">
            <span className="text-muted-foreground">Reason code</span>
            <input
              readOnly
              value={VOID_FALSE_EXECUTION_REASON_CODE}
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
            />
          </label>

          <label className="block text-sm">
            <span className="text-muted-foreground">
              Confirmação: {VOID_FALSE_EXECUTION_CONFIRM_PHRASE}
            </span>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="mt-1 w-full rounded border border-white/10 bg-background px-2 py-1.5 font-mono text-xs"
              data-testid="void-false-execution-confirm"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy || !canSubmit}
              className="rounded bg-gold px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
              data-testid="void-false-execution-submit"
            >
              {busy ? "Anulando falso positivo de execução…" : "Confirmar anulação"}
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
