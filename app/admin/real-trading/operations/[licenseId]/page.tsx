import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRealTradingOperationDetailView } from "@/lib/admin/real-trading-operation-center";
import { OPERATIONAL_COMMAND_LABELS } from "@/lib/operations/operational-command-constants";

type PageProps = {
  params: Promise<{ licenseId: string }>;
};

function formatBrl(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2)}`;
}

type OperationCommandRow = Prisma.EAOperationalCommandGetPayload<{
  include: { requestedBy: { select: { email: true; name: true } } };
}>;

type HeartbeatRow = Prisma.EaHeartbeatGetPayload<Record<string, never>>;
type CanTradeDecisionRow = Prisma.AutonomousStrategyDecisionGetPayload<Record<string, never>>;

export default async function AdminRealTradingOperationDetailPage({ params }: PageProps) {
  const { licenseId } = await params;
  const detail = await getRealTradingOperationDetailView(licenseId);
  if (!detail) notFound();

  const { row, snapshot, device, commands, heartbeats, canTradeDecisions, control } =
    detail;
  const operationCommands = commands as OperationCommandRow[];
  const operationHeartbeats = heartbeats as HeartbeatRow[];
  const operationCanTradeDecisions = canTradeDecisions as CanTradeDecisionRow[];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/real-trading/operations"
          className="text-sm text-gold hover:underline"
        >
          ← Voltar ao centro de operações
        </Link>
      </div>

      <Card className="border-gold/20 p-6">
        <CardHeader className="p-0">
          <CardTitle>
            {row.userName ?? row.userEmail} — {row.symbol}
          </CardTitle>
          <CardDescription className="mt-2">
            Licença {licenseId} · {row.accountLogin}@{row.accountServer} · magic{" "}
            {row.magicNumber}
          </CardDescription>
        </CardHeader>
        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Liveness</dt>
            <dd>
              {row.livenessStatus} — {row.livenessMessage}
              <div className="text-xs text-muted-foreground">
                Atividade: {row.lastActivitySource ?? "—"}
                {row.lastActivityAgeSeconds != null
                  ? ` · há ${row.lastActivityAgeSeconds}s`
                  : ""}
              </div>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">EA</dt>
            <dd>{row.eaOnline ? "Comunicação recente" : "Sem comunicação recente"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Pausa admin</dt>
            <dd>{control?.paused || row.pausedByAdmin ? "Sim" : "Não"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Config hash</dt>
            <dd className="font-mono text-xs">{row.configHash ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">PnL dia (total / realizado / aberto)</dt>
            <dd>
              {formatBrl(snapshot?.totalPnlDayCents ?? 0)} /{" "}
              {formatBrl(snapshot?.realizedPnlDayCents ?? 0)} /{" "}
              {formatBrl(snapshot?.openPnlCents ?? 0)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">PnL mês</dt>
            <dd>{formatBrl(snapshot?.totalPnlMonthCents ?? 0)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Limite diário</dt>
            <dd>
              {formatBrl(snapshot?.dailyLimitCents ?? 0)} · usado{" "}
              {formatBrl(snapshot?.dailyUsedCents ?? 0)} · restante{" "}
              {formatBrl(snapshot?.dailyRemainingCents ?? 0)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Max contratos aprovado</dt>
            <dd>{row.maxContracts ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Contratos configurados / em uso</dt>
            <dd>
              {row.configuredContracts ?? "—"} / {row.contractsInUse ?? 0}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">PnL status</dt>
            <dd>{snapshot?.pnlStatus ?? row.pnlStatus ?? "—"}</dd>
          </div>
        </dl>
      </Card>

      <Card className="border-gold/20 p-5">
        <CardTitle className="text-base">Posição e pendentes</CardTitle>
        <pre className="mt-3 overflow-x-auto rounded bg-black/40 p-3 text-xs">
          {JSON.stringify(
            {
              position: snapshot
                ? {
                    hasOpenPosition: snapshot.hasOpenPosition,
                    side: snapshot.positionSide,
                    volume: snapshot.positionVolume,
                    avgPrice: snapshot.positionAveragePrice,
                    currentPrice: snapshot.positionCurrentPrice,
                    openPnlCents: snapshot.positionOpenPnlCents,
                  }
                : null,
              pendingOrders: snapshot?.pendingOrdersJson ?? [],
            },
            null,
            2
          )}
        </pre>
      </Card>

      <Card className="border-gold/20 p-5">
        <CardTitle className="text-base">Histórico de comandos</CardTitle>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 text-left text-muted-foreground">
                <th className="py-2 pr-2">Tipo</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Solicitado</th>
                <th className="py-2 pr-2">Resultado</th>
                <th className="py-2">Admin</th>
              </tr>
            </thead>
            <tbody>
              {operationCommands.map((cmd) => (
                <tr key={cmd.id} className="border-b border-white/5">
                  <td className="py-2 pr-2">
                    {OPERATIONAL_COMMAND_LABELS[cmd.commandType]}
                  </td>
                  <td className="py-2 pr-2">{cmd.status}</td>
                  <td className="py-2 pr-2">
                    {cmd.requestedAt.toLocaleString("pt-BR")}
                  </td>
                  <td className="py-2 pr-2">
                    {cmd.resultCode ?? "—"} {cmd.resultMessage ?? ""}
                  </td>
                  <td className="py-2">{cmd.requestedBy?.email ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="border-gold/20 p-5">
        <CardTitle className="text-base">Histórico HEALTH_CHECK</CardTitle>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 text-left text-muted-foreground">
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Solicitado</th>
                <th className="py-2 pr-2">ACK</th>
                <th className="py-2 pr-2">Executado</th>
                <th className="py-2">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {operationCommands
                .filter((cmd) => cmd.commandType === "HEALTH_CHECK")
                .map((cmd) => (
                  <tr key={cmd.id} className="border-b border-white/5">
                    <td className="py-2 pr-2">{cmd.status}</td>
                    <td className="py-2 pr-2">
                      {cmd.requestedAt.toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2 pr-2">
                      {cmd.ackedAt?.toLocaleString("pt-BR") ?? "—"}
                    </td>
                    <td className="py-2 pr-2">
                      {cmd.executedAt?.toLocaleString("pt-BR") ?? "—"}
                    </td>
                    <td className="py-2">
                      {cmd.resultCode ?? "—"} {cmd.resultMessage ?? ""}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {operationCommands.filter((cmd) => cmd.commandType === "HEALTH_CHECK").length === 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Nenhum health check registrado para esta licença.
            </p>
          )}
        </div>
      </Card>

      <Card className="border-gold/20 p-5">
        <ul className="mt-3 space-y-2 text-xs">
          {operationHeartbeats.map((hb) => (
            <li key={hb.id} className="rounded border border-white/10 p-2">
              {hb.receivedAt.toLocaleString("pt-BR")} — {hb.eaStatus ?? "—"}
            </li>
          ))}
          {operationHeartbeats.length === 0 && (
            <li className="text-muted-foreground">Nenhum heartbeat registrado.</li>
          )}
        </ul>
      </Card>

      <Card className="border-gold/20 p-5">
        <CardTitle className="text-base">Decisões can-trade recentes</CardTitle>
        <ul className="mt-3 space-y-2 text-xs">
          {operationCanTradeDecisions.map((d) => (
            <li key={d.id} className="rounded border border-white/10 p-2">
              {d.createdAt.toLocaleString("pt-BR")} — {d.decision} · {d.reasonCode} ·{" "}
              {d.side} {d.requestedContracts}
            </li>
          ))}
          {operationCanTradeDecisions.length === 0 && (
            <li className="text-muted-foreground">Nenhuma decisão registrada.</li>
          )}
        </ul>
      </Card>

      {device && (
        <Card className="border-gold/20 p-5">
          <CardTitle className="text-base">Device / heartbeat</CardTitle>
          <p className="mt-2 text-xs text-muted-foreground">
            Device {device.deviceId} · último seen{" "}
            {device.lastSeenAt?.toLocaleString("pt-BR") ?? "—"}
          </p>
        </Card>
      )}
    </div>
  );
}
