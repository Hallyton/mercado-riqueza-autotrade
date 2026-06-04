import { listAutonomousStrategyDecisions } from "@/lib/admin/daily-financial-risk-admin";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MR_FIBO_D1_GUARD_DISPLAY_NAME } from "@/lib/risk/autonomous-strategy-reasons";

export default async function AdminAutonomousStrategyPage() {
  const items = await listAutonomousStrategyDecisions({ limit: 150 });

  return (
    <div className="space-y-6">
      <Card className="border-gold/20 p-6">
        <CardHeader className="p-0">
          <CardTitle>Estratégia autônoma — {MR_FIBO_D1_GUARD_DISPLAY_NAME}</CardTitle>
          <CardDescription className="mt-2">
            Decisões de preflight (caixa preta — sem expor lógica ao cliente).
          </CardDescription>
        </CardHeader>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-muted-foreground">
                <th className="p-2">Quando</th>
                <th className="p-2">Cliente</th>
                <th className="p-2">Decisão</th>
                <th className="p-2">Motivo</th>
                <th className="p-2">Lado</th>
                <th className="p-2">Símbolo</th>
                <th className="p-2">Exec ID</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-white/5">
                  <td className="p-2">
                    {row.createdAt.toLocaleString("pt-BR")}
                  </td>
                  <td className="p-2">{row.license.user.email}</td>
                  <td className="p-2">{row.decision}</td>
                  <td className="p-2">{row.reasonCode ?? "—"}</td>
                  <td className="p-2">{row.side}</td>
                  <td className="p-2">{row.symbol}</td>
                  <td className="p-2 font-mono">{row.id.slice(0, 10)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">Nenhuma decisão registrada.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
