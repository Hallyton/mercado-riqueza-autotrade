import type { AdminOperationsDashboard } from "@/lib/admin/overview";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminActionsPanel } from "./admin-actions-panel";
import {
  LicenseStatusBadge,
} from "@/components/subscription/status-badge";
import type { LicenseStatus } from "@prisma/client";

function fmtMoney(n: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

function DataTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="px-4 py-6 text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-muted-foreground">
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr
              key={i}
              className="border-b border-white/5 hover:bg-white/[0.02]"
            >
              {cells.map((cell, j) => (
                <td key={j} className="px-4 py-3">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminOperationsDashboard({
  data,
  adminRole,
  canEmergency,
}: {
  data: AdminOperationsDashboard;
  adminRole: string;
  canEmergency: boolean;
}) {
  const { kpis } = data;

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gold">
          Visão geral
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total de clientes" value={kpis.totalClients} />
          <StatCard
            label="Clientes ativos"
            value={kpis.activeClients}
            valueClassName="text-emerald-400"
          />
          <StatCard
            label="Inadimplentes"
            value={kpis.delinquentClients}
            valueClassName="text-amber-400"
          />
          <StatCard
            label="Resultado agregado"
            value={fmtMoney(kpis.aggregatePnl)}
            hint={`Últimos ${7} dias (realizado)`}
            valueClassName="text-gold"
          />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="EAs online" value={kpis.easOnline} />
          <StatCard label="EAs offline" value={kpis.easOffline} />
          <StatCard label="Clientes posicionados" value={kpis.clientsPositioned} />
          <StatCard
            label="Ordens armadas"
            value={kpis.clientsWithArmedOrders}
            hint="Pendentes no EA ou fila LIMIT/STOP"
          />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Slippage médio"
            value={
              kpis.avgSlippage != null
                ? kpis.avgSlippage.toFixed(4)
                : "—"
            }
            hint="Execuções FILLED no período"
          />
          <StatCard
            label="Latência média"
            value={
              kpis.avgLatencyMs != null ? `${kpis.avgLatencyMs} ms` : "—"
            }
            hint="Criação da instrução → execução"
          />
        </div>
      </section>

      <AdminActionsPanel
        licenses={data.licensesForActions}
        canEmergency={canEmergency}
        adminRole={adminRole}
      />

      <Card className="overflow-hidden p-0">
        <CardHeader className="p-6 pb-0">
          <CardTitle>Últimos sinais</CardTitle>
          <CardDescription>Instruções emitidas pelo servidor (sem parâmetros de estratégia)</CardDescription>
        </CardHeader>
        <DataTable
          headers={[
            "Cliente",
            "Ativo",
            "Lado",
            "Propósito",
            "Origem",
            "Status",
            "Quando",
          ]}
          empty="Nenhum sinal recente."
          rows={data.recentSignals.map((s) => [
            <span key="e" className="font-mono text-xs">{s.clientEmail}</span>,
            s.symbol,
            s.side,
            s.purpose,
            s.source ? (
              <span className="text-xs text-gold">{s.source}</span>
            ) : (
              "—"
            ),
            s.status,
            fmtDate(s.createdAt),
          ])}
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden p-0">
          <CardHeader className="p-6 pb-0">
            <CardTitle>Execuções por cliente</CardTitle>
            <CardDescription>Volume no período</CardDescription>
          </CardHeader>
          <DataTable
            headers={["Cliente", "Execuções", "Preenchidas"]}
            empty="Sem execuções no período."
            rows={data.executionsByClient.map((r) => [
              r.email,
              String(r.executionCount),
              String(r.filledCount),
            ])}
          />
        </Card>

        <Card className="overflow-hidden p-0">
          <CardHeader className="p-6 pb-0">
            <CardTitle>Resultado por cliente</CardTitle>
            <CardDescription>P&amp;L realizado agregado</CardDescription>
          </CardHeader>
          <DataTable
            headers={["Cliente", "P&amp;L", "Dias"]}
            empty="Sem P&amp;L no período."
            rows={data.resultsByClient.map((r) => [
              r.email,
              <span
                key="p"
                className={
                  r.realizedPnl >= 0 ? "text-emerald-400" : "text-red-400"
                }
              >
                {fmtMoney(r.realizedPnl)}
              </span>,
              String(r.tradeDays),
            ])}
          />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden p-0">
          <CardHeader className="p-6 pb-0">
            <CardTitle>Ordens rejeitadas</CardTitle>
          </CardHeader>
          <DataTable
            headers={["Cliente", "Ativo", "Motivo", "Quando"]}
            empty="Nenhuma rejeição recente."
            rows={data.rejectedOrders.map((r) => [
              r.clientEmail,
              r.symbol,
              r.message ?? "—",
              fmtDate(r.at),
            ])}
          />
        </Card>

        <Card className="overflow-hidden p-0">
          <CardHeader className="p-6 pb-0">
            <CardTitle>Ordens ignoradas</CardTitle>
            <CardDescription>Motivo reportado pelo EA</CardDescription>
          </CardHeader>
          <DataTable
            headers={["Cliente", "Ativo", "Motivo", "Quando"]}
            empty="Nenhuma ordem ignorada recente."
            rows={data.ignoredOrders.map((r) => [
              r.clientEmail,
              r.symbol,
              r.reason ?? "—",
              fmtDate(r.at),
            ])}
          />
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <CardHeader className="p-6 pb-0">
          <CardTitle>Status de licenças</CardTitle>
          <CardDescription>EA, MT5 e bloqueio de entradas</CardDescription>
        </CardHeader>
        <DataTable
          headers={["Cliente", "Licença", "MT5", "EA", "Entradas"]}
          empty="Nenhuma licença."
          rows={data.licenseStatuses.map((l) => [
            l.clientEmail,
            <LicenseStatusBadge
              key="st"
              status={l.status as LicenseStatus}
            />,
            l.mt5 ?? "—",
            l.eaOnline ? (
              <span className="text-emerald-400">Online</span>
            ) : (
              <span className="text-muted-foreground">Offline</span>
            ),
            l.haltNewEntries ? "Pausadas" : "Ativas",
          ])}
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden p-0">
          <CardHeader className="p-6 pb-0">
            <CardTitle>Logs de erro (EA)</CardTitle>
          </CardHeader>
          <DataTable
            headers={["Cliente", "Código", "Mensagem", "Quando"]}
            empty="Sem erros reportados."
            rows={data.errorLogs.map((e) => [
              e.clientEmail,
              e.errorCode ?? "—",
              <span key="m" className="line-clamp-2 max-w-xs text-xs">
                {e.errorMessage}
              </span>,
              fmtDate(e.at),
            ])}
          />
        </Card>

        <Card className="overflow-hidden p-0">
          <CardHeader className="p-6 pb-0">
            <CardTitle>Eventos de billing</CardTitle>
            <CardDescription>Webhooks recebidos</CardDescription>
          </CardHeader>
          <DataTable
            headers={["Gateway", "Tipo", "Processado", "Quando"]}
            empty="Sem eventos."
            rows={data.billingEvents.map((w) => [
              w.gateway,
              w.eventType,
              w.processed ? "Sim" : "Não",
              fmtDate(w.at),
            ])}
          />
        </Card>
      </div>
    </div>
  );
}
