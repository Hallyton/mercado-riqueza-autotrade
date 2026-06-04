"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { LIVE_MARKET_OPERATIONAL_MODE } from "@/lib/admin/live-market-operational-mode";

type TrackingPayload = {
  batch: {
    id: string;
    status: string;
    operationalMode: string;
    symbol: string;
    side: string;
    orderType: string;
    orderPrice: number | null;
    requestedContracts: number;
    managementPlanSummary: string;
    eligibleCount: number;
    blockedCount: number;
    totalCandidates: number;
    expiresAt: string;
    createdAt: string;
    createdBy: string;
  };
  summary: {
    dispatched: number;
    blocked: number;
    blockedAtExecute: number;
    skipped: number;
    failed: number;
  };
  instructionTracking: Array<{
    instructionId: string;
    licenseId: string;
    clientEmail: string;
    currentStatus: string;
    orderType: string;
    managementPlanSummary: string;
    latestExecution: {
      id: string;
      status: string;
      brokerTicket: string | null;
    } | null;
    latestProtection: {
      protectionStatus: string;
    } | null;
    managementEvents: Array<{ event: string; at: string }>;
    heartbeat: { eaStatus: string; tradeMode: string; receivedAt: string } | null;
    detailUrl: string;
  }>;
  items: Array<{
    id: string;
    licenseId: string;
    status: string;
    reasonCode: string | null;
    actionHint: string | null;
    instructionId: string | null;
  }>;
};

export function BulkDispatchBatchTracker({
  batchId,
  initial,
}: {
  batchId: string;
  initial: TrackingPayload;
}) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/real-trading/bulk-dispatch/${batchId}/tracking`
      );
      const json = await res.json();
      if (res.ok) setData(json);
    } finally {
      setBusy(false);
    }
  }, [batchId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={refresh}
          disabled={busy}
          className="rounded border border-gold/40 px-3 py-1.5 text-sm text-gold disabled:opacity-50"
        >
          {busy ? "Atualizando…" : "Atualizar acompanhamento"}
        </button>
        <Link
          href={`/admin/real-trading/instructions?batchId=${encodeURIComponent(batchId)}`}
          className="text-sm text-gold hover:underline"
        >
          Ver instructions do batch
        </Link>
        <Link href="/admin/real-trading/protection" className="text-sm text-gold hover:underline">
          Painel de proteção
        </Link>
      </div>

      <section className="rounded-lg border border-white/10 p-4 text-sm space-y-2">
        <h2 className="font-semibold text-gold">Parâmetros · {data.batch.operationalMode}</h2>
        <p>
          {data.batch.symbol} · {data.batch.side} · {data.batch.orderType} · contratos{" "}
          {data.batch.requestedContracts}
          {data.batch.orderPrice != null ? ` · preço ${data.batch.orderPrice}` : ""}
        </p>
        <p className="font-mono text-xs">Gestão: {data.batch.managementPlanSummary}</p>
        <p className="text-muted-foreground">
          Status batch: {data.batch.status} · Modo: {LIVE_MARKET_OPERATIONAL_MODE} · Criado por{" "}
          {data.batch.createdBy}
        </p>
        <p className="text-muted-foreground">
          Dispatched: {data.summary.dispatched} · Bloqueados: {data.summary.blocked} ·
          BlockedAtExecute: {data.summary.blockedAtExecute} · Skipped: {data.summary.skipped} ·
          Failed: {data.summary.failed}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Acompanhamento ao vivo das instructions</h2>
        <div className="overflow-x-auto rounded border border-white/10">
          <table className="w-full min-w-[1000px] text-left text-xs">
            <thead className="bg-white/5">
              <tr>
                <th className="px-2 py-2">Instruction</th>
                <th className="px-2 py-2">Cliente</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">EA</th>
                <th className="px-2 py-2">Execução</th>
                <th className="px-2 py-2">Proteção</th>
                <th className="px-2 py-2">Gestão</th>
                <th className="px-2 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.instructionTracking.map((row) => (
                <tr key={row.instructionId} className="border-t border-white/5">
                  <td className="px-2 py-2 font-mono">
                    <Link href={row.detailUrl} className="text-gold hover:underline">
                      {row.instructionId}
                    </Link>
                  </td>
                  <td className="px-2 py-2">{row.clientEmail}</td>
                  <td className="px-2 py-2">{row.currentStatus}</td>
                  <td className="px-2 py-2">
                    {row.heartbeat
                      ? `${row.heartbeat.eaStatus} / ${row.heartbeat.tradeMode}`
                      : "—"}
                  </td>
                  <td className="px-2 py-2">
                    {row.latestExecution
                      ? `${row.latestExecution.status}${row.latestExecution.brokerTicket ? ` #${row.latestExecution.brokerTicket}` : ""}`
                      : "—"}
                  </td>
                  <td className="px-2 py-2">
                    {row.latestProtection?.protectionStatus ?? "—"}
                  </td>
                  <td className="px-2 py-2">{row.managementPlanSummary}</td>
                  <td className="px-2 py-2">
                    <Link href={row.detailUrl} className="text-gold hover:underline">
                      Detalhe
                    </Link>
                  </td>
                </tr>
              ))}
              {data.instructionTracking.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-2 py-4 text-muted-foreground">
                    Nenhuma instruction vinculada a este batch ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
