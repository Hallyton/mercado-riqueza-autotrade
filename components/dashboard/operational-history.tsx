import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import type { ClientDashboardData } from "@/lib/dashboard/types";

export function OperationalHistory({ data }: { data: ClientDashboardData }) {
  return (
    <Card id="historico" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>Histórico operacional</CardTitle>
        <CardDescription>
          Execuções reportadas — sem exposição de estratégia, Fibo ou parâmetros
          internos
        </CardDescription>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-2 py-3 font-medium">Data</th>
              <th className="px-2 py-3 font-medium">Ativo</th>
              <th className="px-2 py-3 font-medium">Lado</th>
              <th className="px-2 py-3 font-medium">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {data.history.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-2 py-8 text-center text-muted-foreground"
                >
                  Nenhuma operação registrada ainda.
                </td>
              </tr>
            ) : (
              data.history.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-white/5 hover:bg-white/[0.02]"
                >
                  <td className="px-2 py-3 text-muted-foreground">
                    {formatDateTime(row.at)}
                  </td>
                  <td className="px-2 py-3 font-medium">{row.symbol}</td>
                  <td className="px-2 py-3">{row.side}</td>
                  <td className="px-2 py-3">{row.resultLabel}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
