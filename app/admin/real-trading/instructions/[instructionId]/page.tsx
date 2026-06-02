import Link from "next/link";
import { notFound } from "next/navigation";
import { getRealTradingInstructionAdminDetail } from "@/lib/admin/real-trading-instructions";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

function fmtPrice(value: { toString(): string } | null | undefined) {
  if (value == null) return "—";
  return Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 6 });
}

export default async function AdminRealTradingInstructionDetailPage({
  params,
}: {
  params: Promise<{ instructionId: string }>;
}) {
  const { instructionId } = await params;
  const detail = await getRealTradingInstructionAdminDetail(instructionId);
  if (!detail) notFound();

  const { instruction, preflightId, eaHeartbeat, redactedPayload } = detail;

  return (
    <div className="space-y-6">
      <p>
        <Link
          href="/admin/real-trading/instructions"
          className="text-sm text-gold hover:underline"
        >
          ← Voltar para instruções reais
        </Link>
      </p>

      <Card className="border-gold/20 p-6">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="font-mono text-sm break-all">{instruction.id}</CardTitle>
          <CardDescription>
            Source {instruction.source} · Status {instruction.currentStatus} · Cliente{" "}
            {instruction.license.user.email}
          </CardDescription>
        </CardHeader>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">PreflightId</dt>
            <dd className="font-mono text-xs break-all">{preflightId ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">EA</dt>
            <dd>
              {eaHeartbeat?.eaStatus ?? "—"} ({eaHeartbeat?.tradeMode ?? "—"}) ·{" "}
              {eaHeartbeat ? fmtDate(eaHeartbeat.receivedAt) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Operação</dt>
            <dd>
              {instruction.symbol} · {instruction.side} · {instruction.orderType} ·{" "}
              {Number(instruction.quantity)} contrato(s)
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Preços</dt>
            <dd>
              Apregoamento {fmtPrice(instruction.orderPrice)} · SL {fmtPrice(instruction.stopLoss)} · TP{" "}
              {fmtPrice(instruction.takeProfit)}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          <Link href="/admin/real-trading/protection" className="text-gold hover:underline">
            Abrir Proteção SL/TP
          </Link>
        </p>
      </Card>

      <Card className="p-6">
        <CardHeader className="p-0 pb-3">
          <CardTitle className="text-base">Payload operacional (redigido)</CardTitle>
        </CardHeader>
        <pre className="overflow-x-auto rounded border border-white/10 bg-black/30 p-3 text-xs">
          {JSON.stringify(redactedPayload, null, 2)}
        </pre>
      </Card>

      <Card className="p-6">
        <CardHeader className="p-0 pb-3">
          <CardTitle className="text-base">Histórico de status</CardTitle>
        </CardHeader>
        <div className="space-y-2 text-sm">
          {detail.statusHistory.map((log, i) => (
            <div key={i} className="rounded border border-white/10 bg-black/20 p-3">
              <p className="font-medium">{log.status}</p>
              <p className="text-xs text-muted-foreground">{fmtDate(log.createdAt)}</p>
              {log.message && <p className="mt-1 text-xs">{log.message}</p>}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <CardHeader className="p-0 pb-3">
          <CardTitle className="text-base">Execuções</CardTitle>
        </CardHeader>
        {detail.executions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma execução reportada pelo EA.</p>
        ) : (
          <div className="space-y-2 text-sm">
            {detail.executions.map((ex) => (
              <div key={ex.id} className="rounded border border-white/10 p-3">
                <p>
                  {ex.status} · {ex.executedAt ? fmtDate(ex.executedAt) : "—"} · ticket{" "}
                  {ex.brokerTicket ?? "—"}
                </p>
                <p className="font-mono text-xs text-muted-foreground">executionId: {ex.id}</p>
                {ex.errorMessage && (
                  <p className="mt-1 text-xs text-red-300">{ex.errorMessage}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <CardHeader className="p-0 pb-3">
          <CardTitle className="text-base">Relatórios de proteção</CardTitle>
        </CardHeader>
        {detail.protectionReports.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum relatório de proteção.</p>
        ) : (
          <div className="space-y-2 text-sm">
            {detail.protectionReports.map((r) => (
              <div key={r.id} className="rounded border border-white/10 p-3">
                <p>
                  {r.protectionStatus} · SL {r.stopLossPresent ? "Sim" : "Não"} · TP{" "}
                  {r.takeProfitPresent ? "Sim" : "Não"}
                </p>
                <p className="text-xs text-muted-foreground">{fmtDate(r.reportedAt)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
