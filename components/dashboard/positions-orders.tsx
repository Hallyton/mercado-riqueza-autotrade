import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBrl } from "@/lib/format";
import type { ClientDashboardData } from "@/lib/dashboard/types";

export function PositionsAndOrders({ data }: { data: ClientDashboardData }) {
  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Posição atual</CardTitle>
          <CardDescription>
            Snapshot da conta — resultado, não configuração de entrada
          </CardDescription>
        </CardHeader>
        {data.positions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma posição aberta no momento.
          </p>
        ) : (
          <ul className="space-y-3">
            {data.positions.map((pos) => (
              <li
                key={pos.symbol}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-black/30 px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-foreground">{pos.symbol}</p>
                  <p className="text-xs text-muted-foreground">
                    {pos.quantity} @ {pos.avgPrice.toLocaleString("pt-BR")}
                  </p>
                </div>
                {pos.unrealizedPnl != null && (
                  <p
                    className={
                      pos.unrealizedPnl >= 0
                        ? "text-emerald-400"
                        : "text-red-400"
                    }
                  >
                    {formatBrl(pos.unrealizedPnl)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ordens armadas</CardTitle>
          <CardDescription>
            Pendentes autorizadas — sem detalhes de setup interno
          </CardDescription>
        </CardHeader>
        {data.pendingOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma ordem armada aguardando execução.
          </p>
        ) : (
          <ul className="space-y-3">
            {data.pendingOrders.map((ord, i) => (
              <li
                key={`${ord.symbol}-${i}`}
                className="flex items-center justify-between rounded-xl border border-gold/20 bg-gold/5 px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-gold">{ord.symbol}</p>
                  <p className="text-xs text-muted-foreground">
                    {ord.side} · vol. {ord.volume}
                  </p>
                </div>
                {ord.ticket && (
                  <span className="font-mono text-xs text-muted-foreground">
                    #{ord.ticket}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
