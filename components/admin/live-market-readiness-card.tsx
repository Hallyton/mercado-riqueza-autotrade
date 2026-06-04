"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LIVE_MARKET_OPERATIONAL_MODE } from "@/lib/admin/live-market-operational-mode";
import type { LiveMarketReadinessSnapshot } from "@/lib/admin/live-market-readiness";

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={ok ? "text-emerald-300" : "text-red-300"}>
      {label}: {ok ? "OK" : "BLOQUEADO"}
    </span>
  );
}

export function LiveMarketReadinessCard({
  previewBatchId,
  previewExpiresAt,
  eligibleCount,
  blockedCount,
  selectedCount,
}: {
  previewBatchId: string | null;
  previewExpiresAt: string | null;
  eligibleCount: number | null;
  blockedCount: number | null;
  selectedCount: number;
}) {
  const [snapshot, setSnapshot] = useState<LiveMarketReadinessSnapshot | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/real-trading/bulk-dispatch/readiness")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setSnapshot(data);
      })
      .catch(() => setError("Falha ao carregar prontidão."));
  }, [previewBatchId]);

  return (
    <section className="rounded-lg border border-gold/30 bg-gold/5 p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gold">
          Mercado ao vivo — Checklist final
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta tela cria instructions REAL_MANUAL para clientes elegíveis selecionados.
          O backend não envia ordem diretamente ao broker; quem executa é o EA de cada
          cliente.
        </p>
      </div>

      <div className="rounded border border-white/10 bg-black/30 px-4 py-3 text-sm">
        <p className="font-medium text-gold">
          Modo operacional do envio: {LIVE_MARKET_OPERATIONAL_MODE}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Source sempre REAL_MANUAL — sem TEST ou HOMOLOGATION neste fluxo.
        </p>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      {snapshot && (
        <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Flag ok={snapshot.enableRealTrading} label="ENABLE_REAL_TRADING" />
          <Flag ok={!snapshot.enableAutoDispatch} label="ENABLE_AUTO_DISPATCH desligado" />
          <p>Candidatos: {snapshot.totalCandidates}</p>
          <p>Elegíveis (último preview): {eligibleCount ?? snapshot.lastPreviewEligibleCount ?? "—"}</p>
          <p>Bloqueados (último preview): {blockedCount ?? snapshot.lastPreviewBlockedCount ?? "—"}</p>
          <p>Selecionados agora: {selectedCount}</p>
          <p>Devices ACTIVE + REAL: {snapshot.devicesActiveReal}</p>
          <p>EAs online: {snapshot.easOnline}</p>
          <p>PRE_MARKET válidos hoje: {snapshot.preMarketValidToday}</p>
          <p>Approvals válidos: {snapshot.approvalsValid}</p>
          <p>Protection bloqueante: {snapshot.protectionBlockingCount}</p>
          <p>Instructions REAL abertas: {snapshot.openRealInstructions}</p>
          <p className="sm:col-span-2 lg:col-span-3 text-xs text-muted-foreground">
            Último preview:{" "}
            {previewBatchId ?? snapshot.lastPreviewBatchId ? (
              <Link
                href={`/admin/real-trading/bulk-dispatch/${previewBatchId ?? snapshot.lastPreviewBatchId}`}
                className="font-mono text-gold hover:underline"
              >
                {previewBatchId ?? snapshot.lastPreviewBatchId}
              </Link>
            ) : (
              "—"
            )}
            {" · "}
            Expira: {previewExpiresAt ?? snapshot.lastPreviewExpiresAt ?? "—"}
          </p>
          <p className="sm:col-span-2 lg:col-span-3 text-xs text-amber-200/90">
            {snapshot.eaRealOrderSendConfigNote}
          </p>
        </div>
      )}
    </section>
  );
}
