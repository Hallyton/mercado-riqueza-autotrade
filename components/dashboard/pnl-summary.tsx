import { StatCard } from "@/components/dashboard/stat-card";
import type { ClientDashboardData } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

function pnlColor(value: number | null) {
  if (value == null) return "text-foreground";
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-red-400";
  return "text-foreground";
}

export function PnlSummary({ data }: { data: ClientDashboardData }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2">
      <StatCard
        label="Resultado do dia"
        value={data.pnl.dayLabel}
        valueClassName={cn("text-gold", pnlColor(data.pnl.day))}
        hint="P&L realizado consolidado (conta vinculada)"
      />
      <StatCard
        label="Resultado do mês"
        value={data.pnl.monthLabel}
        valueClassName={cn(pnlColor(data.pnl.month))}
        hint="Acumulado no mês corrente"
      />
    </section>
  );
}
