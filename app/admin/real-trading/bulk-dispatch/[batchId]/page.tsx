import Link from "next/link";
import { notFound } from "next/navigation";
import { getBulkDispatchBatchLiveTracking } from "@/lib/admin/bulk-dispatch-live-tracking";
import { BulkDispatchBatchTracker } from "@/components/admin/bulk-dispatch-batch-tracker";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function fmtDate(d: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(typeof d === "string" ? new Date(d) : d);
}

export default async function AdminBulkDispatchBatchPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const tracking = await getBulkDispatchBatchLiveTracking(batchId);
  if (!tracking) notFound();

  return (
    <div className="space-y-6">
      <Card className="border-gold/20 p-6">
        <CardHeader className="p-0">
          <CardTitle>Acompanhamento batch {tracking.batch.id}</CardTitle>
          <CardDescription className="mt-2">
            Modo {tracking.batch.operationalMode} · Status {tracking.batch.status} · Criado{" "}
            {fmtDate(tracking.batch.createdAt)} · Expira {fmtDate(tracking.batch.expiresAt)}
          </CardDescription>
        </CardHeader>
      </Card>

      <BulkDispatchBatchTracker batchId={batchId} initial={tracking} />

      <Link href="/admin/real-trading/bulk-dispatch" className="text-gold hover:underline text-sm">
        ← Voltar ao disparo em lote
      </Link>
    </div>
  );
}
