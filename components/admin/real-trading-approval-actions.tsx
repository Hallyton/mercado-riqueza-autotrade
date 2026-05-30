"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { REAL_TRADING_APPROVAL_ACTION_PHRASES } from "@/lib/admin/real-trading-approval";

type ActionKey = keyof typeof REAL_TRADING_APPROVAL_ACTION_PHRASES;

export function RealTradingApprovalActions({ approvalId }: { approvalId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<ActionKey | null>(null);
  const [confirmations, setConfirmations] = useState<Record<ActionKey, string>>({
    suspend: "",
    revoke: "",
    block: "",
  });
  const [message, setMessage] = useState<string | null>(null);

  async function runAction(action: ActionKey) {
    setBusy(action);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/real-trading/approvals/${approvalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          admin_confirmation: confirmations[action],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Falha na ação.");
        return;
      }
      router.refresh();
    } catch {
      setMessage("Erro de rede.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {(Object.keys(REAL_TRADING_APPROVAL_ACTION_PHRASES) as ActionKey[]).map(
        (action) => (
          <div
            key={action}
            className="rounded-lg border border-white/10 p-4 space-y-2"
          >
            <p className="text-sm font-medium capitalize">{action}</p>
            <p className="text-xs text-muted-foreground">
              Digite: <span className="font-mono text-gold">{REAL_TRADING_APPROVAL_ACTION_PHRASES[action]}</span>
            </p>
            <input
              className="w-full rounded-md border border-white/10 bg-background px-3 py-2 text-sm"
              value={confirmations[action]}
              onChange={(e) =>
                setConfirmations((prev) => ({
                  ...prev,
                  [action]: e.target.value,
                }))
              }
            />
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => runAction(action)}
              className="rounded-md border border-red-500/40 px-3 py-1.5 text-sm text-red-200 hover:bg-red-500/10 disabled:opacity-50"
            >
              {busy === action ? "Processando…" : action}
            </button>
          </div>
        )
      )}
      {message && <p className="text-sm text-amber-400">{message}</p>}
    </div>
  );
}
