import Link from "next/link";
import { notFound } from "next/navigation";
import { getRealManualBulkDispatchBatchDetail } from "@/lib/admin/real-manual-bulk-dispatch";
import { formatManagementPlanListSummary, parseManagementPlanFromJson } from "@/lib/admin/real-manual-management-plan";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

export default async function AdminBulkDispatchBatchPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const batch = await getRealManualBulkDispatchBatchDetail(batchId);
  if (!batch) notFound();

  const planSummary = formatManagementPlanListSummary(
    parseManagementPlanFromJson(batch.managementPlan)
  );

  const dispatched = batch.items.filter((i) => i.status === "DISPATCHED");
  const blocked = batch.items.filter((i) => i.status === "BLOCKED");
  const skipped = batch.items.filter((i) =>
    ["SKIPPED", "BLOCKED_AT_EXECUTE"].includes(i.status)
  );
  const failed = batch.items.filter((i) => i.status === "FAILED");

  return (
    <div className="space-y-6">
      <Card className="border-gold/20 p-6">
        <CardHeader className="p-0">
          <CardTitle>Batch {batch.id}</CardTitle>
          <CardDescription className="mt-2">
            Status: {batch.status} · Criado em {fmtDate(batch.createdAt)} · Expira{" "}
            {fmtDate(batch.expiresAt)}
          </CardDescription>
        </CardHeader>
      </Card>

      <section className="rounded-lg border border-white/10 p-4 text-sm space-y-2">
        <h2 className="font-semibold text-gold">Parâmetros da ordem</h2>
        <p>
          {batch.symbol} · {batch.side} · {batch.orderType} · contratos{" "}
          {batch.requestedContracts}
          {batch.orderPrice != null ? ` · preço ${Number(batch.orderPrice)}` : ""}
        </p>
        <p className="font-mono text-xs">Gestão: {planSummary}</p>
        <p className="text-muted-foreground">
          Elegíveis: {batch.eligibleCount} · Bloqueados: {batch.blockedCount} · Total:{" "}
          {batch.totalCandidates}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Instructions criadas</h2>
        <ul className="space-y-1 text-sm font-mono">
          {batch.instructions.map((inst) => (
            <li key={inst.id}>
              <Link
                href={`/admin/real-trading/instructions/${inst.id}`}
                className="text-gold hover:underline"
              >
                {inst.id}
              </Link>{" "}
              — {inst.licenseId} — {inst.currentStatus}
            </li>
          ))}
          {batch.instructions.length === 0 && (
            <li className="text-muted-foreground">Nenhuma instruction vinculada.</li>
          )}
        </ul>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded border border-white/10 p-4">
          <h3 className="mb-2 font-medium text-emerald-300">Dispatched ({dispatched.length})</h3>
          <ul className="space-y-1 text-xs">
            {dispatched.map((i) => (
              <li key={i.id} className="font-mono">
                {i.licenseId} · preflight {i.preflightId ?? "—"} · instruction{" "}
                {i.instructionId ?? "—"}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded border border-white/10 p-4">
          <h3 className="mb-2 font-medium text-amber-200">Bloqueados ({blocked.length})</h3>
          <ul className="space-y-1 text-xs">
            {blocked.map((i) => (
              <li key={i.id}>
                {i.licenseId} · {i.reasonCode} — {i.actionHint}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded border border-white/10 p-4">
          <h3 className="mb-2 font-medium">Skipped ({skipped.length})</h3>
          <ul className="space-y-1 text-xs">
            {skipped.map((i) => (
              <li key={i.id}>
                {i.licenseId} · {i.status} · {i.reasonCode ?? "—"}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded border border-white/10 p-4">
          <h3 className="mb-2 font-medium text-red-300">Failed ({failed.length})</h3>
          <ul className="space-y-1 text-xs">
            {failed.map((i) => (
              <li key={i.id}>
                {i.licenseId} · {i.reasonCode} — {i.reasonDetail}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Link href="/admin/real-trading/bulk-dispatch" className="text-gold hover:underline text-sm">
        ← Voltar ao disparo em lote
      </Link>
    </div>
  );
}
