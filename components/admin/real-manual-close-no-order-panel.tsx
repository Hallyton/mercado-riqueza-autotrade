"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  CLOSE_NO_ORDER_CONFIRM_PHRASE,
  CLOSE_NO_ORDER_REASON_CODE,
  type OperatorAttestation,
} from "@/lib/admin/real-manual-close-no-order";
import type { CloseNoOrderEligibility } from "@/lib/admin/real-trading-instructions";

const DEFAULT_NOTE =
  "Ordem LIMIT não foi apregoada no MT5 por falha/rejeição da bolsa. Nenhuma ordem pendente, nenhuma posição aberta e nenhuma exposição de risco.";

export function RealManualCloseNoOrderPanel({
  instructionId,
  eligibility,
}: {
  instructionId: string;
  eligibility: CloseNoOrderEligibility;
}) {
  const router = useRouter();
  const [operatorNote, setOperatorNote] = useState(DEFAULT_NOTE);
  const [confirm, setConfirm] = useState("");
  const [attestNoPending, setAttestNoPending] = useState(false);
  const [attestNoPosition, setAttestNoPosition] = useState(false);
  const [attestNoRisk, setAttestNoRisk] = useState(false);
  const [attestNewPreflight, setAttestNewPreflight] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  if (!eligibility.canShowClosePanel) {
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Falha ao encerrar instruction.");
        return;
      }
      setSuccess(true);
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
        Instruction encerrada sem ordem apregoada. Nenhuma posição aberta, nenhuma ordem
        pendente e nenhuma exposição de risco foram atestadas pelo operador.
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4"
      data-testid="close-no-order-form"
    >
      <p className="text-sm text-muted-foreground">
        Encerra a tentativa REAL_MANUAL quando a ordem não foi apregoada. Proteção passará
        para <span className="font-mono">SKIPPED_NO_POSITION</span> — não será marcada como
        falha nem confirmada. Nova tentativa exige preflight PASSED.
      </p>

      {eligibility.heartbeatWarning && (
        <p className="text-sm text-amber-300" data-testid="close-no-order-heartbeat-warning">
          {eligibility.heartbeatWarning}
        </p>
      )}

      <fieldset className="space-y-2 rounded border border-white/10 bg-black/20 p-3 text-sm">
        <legend className="px-1 text-muted-foreground">Atestação operacional (obrigatória)</legend>
        <label className="flex gap-2 items-start">
          <input
            type="checkbox"
            checked={attestNoPending}
            onChange={(e) => setAttestNoPending(e.target.checked)}
            data-testid="attest-no-pending-order"
          />
          <span>Verifiquei no MT5 que não há ordem pendente ativa para esta instruction.</span>
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
            Entendo que esta ação encerrará a instruction como ordem não apregoada e exigirá
            novo preflight para nova tentativa.
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

      {error && <p className="text-sm text-red-300">{error}</p>}

      <button
        type="submit"
        disabled={busy || !canSubmit}
        className="rounded bg-gold px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
        data-testid="close-no-order-submit"
      >
        {busy ? "Encerrando…" : "Encerrar sem ordem apregoada"}
      </button>
    </form>
  );
}
