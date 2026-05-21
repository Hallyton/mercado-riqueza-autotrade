import type { ClientDashboardData } from "@/lib/dashboard/types";
import { DayStatusBanner } from "./day-status-banner";
import { StatusOverview } from "./status-overview";
import { PositionsAndOrders } from "./positions-orders";
import { PnlSummary } from "./pnl-summary";
import { EquityChart } from "./equity-chart";
import { BenchmarkChart } from "./benchmark-chart";
import { OperationalHistory } from "./operational-history";

export function ClientDashboard({ data }: { data: ClientDashboardData }) {
  return (
    <div className="space-y-8 pb-12">
      <DayStatusBanner
        status={data.dayStatus}
        message={data.dayStatusMessage}
      />

      <StatusOverview data={data} />

      <PnlSummary data={data} />

      <PositionsAndOrders data={data} />

      <section className="grid gap-6 xl:grid-cols-1">
        <EquityChart points={data.equityCurve} />
        <BenchmarkChart points={data.benchmark} />
      </section>

      <OperationalHistory data={data} />

      <p className="text-center text-xs text-muted-foreground">
        Rentabilidade passada não garante resultados futuros. Este painel exibe
        apenas status e resultados — a lógica operacional permanece no servidor.
      </p>
    </div>
  );
}
