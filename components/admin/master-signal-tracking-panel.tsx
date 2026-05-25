import type {
  MasterSignalTracking,
  MasterSignalTrackingRow,
} from "@/lib/master-signals/admin";

const CONSOLIDATED_LABELS: Record<string, string> = {
  NOT_DISPATCHED: "Não disparado",
  REJECTED_NO_ELIGIBLE_LICENSES: "Rejeitado — sem licenças elegíveis",
  DISPATCHED_PENDING: "Disparado — pendente EA",
  PARTIALLY_EXECUTED: "Parcialmente executado",
  EXECUTED: "Executado",
  FAILED: "Falhou",
  EXPIRED: "Expirado",
};

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function TrackingTableRow({ row }: { row: MasterSignalTrackingRow }) {
  const err =
    row.instruction?.executions[0]?.errorMessage ??
    row.dispatchReason ??
    row.hint;

  return (
    <tr className="border-b border-white/5 hover:bg-white/[0.02]">
      <td className="px-4 py-3">
        <p className="font-medium">{row.license.clientEmail}</p>
        <p className="text-xs text-muted-foreground">
          {row.license.clientName ?? "—"}
        </p>
      </td>
      <td className="px-4 py-3 font-mono text-xs">{row.license.licenseId}</td>
      <td className="px-4 py-3 text-xs">{row.license.mt5Label ?? "—"}</td>
      <td className="px-4 py-3">{row.dispatchStatus ?? "—"}</td>
      <td className="px-4 py-3">
        {row.instruction?.currentStatus ?? "—"}
      </td>
      <td className="px-4 py-3">{row.executionStatus ?? "—"}</td>
      <td className="px-4 py-3">{row.instruction?.source ?? "—"}</td>
      <td className="px-4 py-3">
        {row.instruction?.quantity ?? "—"}
      </td>
      <td className="px-4 py-3 text-xs">{fmtDate(row.updatedAt)}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{err ?? "—"}</td>
    </tr>
  );
}

export function MasterSignalTrackingPanel({
  tracking,
}: {
  tracking: MasterSignalTracking;
}) {
  const { summary, consolidatedStatus, notDispatchedYet, rows, skipped } = tracking;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Status consolidado:</span>
        <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-medium text-gold">
          {CONSOLIDATED_LABELS[consolidatedStatus] ?? consolidatedStatus}
        </span>
        <span className="text-xs text-muted-foreground">({consolidatedStatus})</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="Elegíveis" value={summary.eligibleCount} />
        <SummaryCard label="Ignorados" value={summary.skippedCount} />
        <SummaryCard label="Instructions" value={summary.instructionCount} />
        <SummaryCard label="Executadas" value={summary.executedCount} />
        <SummaryCard label="Pendentes" value={summary.pendingCount} />
        <SummaryCard label="Falhas" value={summary.failedCount} />
      </div>

      {summary.candidatesCount != null && (
        <p className="text-xs text-muted-foreground">
          Candidatos avaliados: {summary.candidatesCount}
          {summary.expiredCount > 0 && (
            <> · Expiradas: {summary.expiredCount}</>
          )}
          {summary.rejectedCount > 0 && (
            <> · Rejeitadas: {summary.rejectedCount}</>
          )}
        </p>
      )}

      {notDispatchedYet && (
        <p className="rounded border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200/90">
          Este sinal ainda não foi disparado.
        </p>
      )}

      {consolidatedStatus === "REJECTED_NO_ELIGIBLE_LICENSES" && (
        <p className="rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          Nenhuma licença elegível. O sinal foi rejeitado para dispatch e
          nenhuma instruction foi criada.
        </p>
      )}

      {skipped.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Licenças ignoradas ({skipped.length})
          </p>
          <ul className="space-y-1 text-sm">
            {skipped.map((s) => (
              <li key={s.licenseId} className="font-mono text-xs text-muted-foreground">
                {s.licenseId} · <span className="text-foreground">{s.code}</span> — {s.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Licença</th>
                <th className="px-4 py-3">MT5</th>
                <th className="px-4 py-3">Dispatch</th>
                <th className="px-4 py-3">Instruction</th>
                <th className="px-4 py-3">Execution</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Qtd</th>
                <th className="px-4 py-3">Atualizado</th>
                <th className="px-4 py-3">Motivo / erro</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <TrackingTableRow key={row.dispatchId ?? row.license.licenseId} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !notDispatchedYet && (
          <p className="text-sm text-muted-foreground">
            Nenhum registro de dispatch por licença.
          </p>
        )
      )}
    </div>
  );
}
