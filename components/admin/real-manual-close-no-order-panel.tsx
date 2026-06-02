"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CLOSE_NO_ORDER_CONFIRM_PHRASE,
  CLOSE_NO_ORDER_REASON_CODE,
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!eligibility.canShowClosePanel) {
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/real-trading/instructions/${instructionId}/close-no-order`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reasonCode: CLOSE_NO_ORDER_REASON_CODE,
            operatorNote,
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
        Instruction encerrada sem ordem apregoada. Nenhuma posição aberta e nenhuma
        exposição de risco registrada.
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
        Encerra a tentativa REAL_MANUAL quando a ordem não foi apregoada e não há
        posição ou ordem pendente no broker. Proteção passará para sem posição / não
        aplicável — não será marcada como falha nem confirmada.
      </p>

      {eligibility.blockReason && !eligibility.canSubmitClose && (
        <p className="text-sm text-amber-300">{eligibility.blockReason}</p>
      )}

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
          className="mt-1 w-full rounded border border-white/10 bg-background px-2 py-1.5 font-mono text-xs"
          data-testid="close-no-order-confirm"
        />
      </label>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <button
        type="submit"
        disabled={busy || !eligibility.canSubmitClose}
        className="rounded bg-gold px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
        data-testid="close-no-order-submit"
      >
        {busy ? "Encerrando…" : "Encerrar sem ordem apregoada"}
      </button>
    </form>
  );
}
