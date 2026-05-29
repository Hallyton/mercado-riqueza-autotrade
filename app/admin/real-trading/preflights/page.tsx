import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listRealTradePreflightsAdmin } from "@/lib/admin/real-trading-approval";

export default async function AdminRealTradingPreflightsPage() {
  const items = await listRealTradePreflightsAdmin(100);

  return (
    <div className="space-y-6">
      <Card className="border-gold/20 p-6">
        <CardHeader className="p-0">
          <CardTitle>Preflights de conta real</CardTitle>
          <CardDescription className="mt-2">
            PASSED com reason REAL_TRADING_ALLOWED_BY_CONTROLLED_GATE indica liberação
            condicional. FAILED/BLOCKED: nenhuma instruction REAL é entregue ao EA.
          </CardDescription>
        </CardHeader>
      </Card>
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5">
            <tr>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Magic</th>
              <th className="px-4 py-3">Margem</th>
              <th className="px-4 py-3">EA</th>
              <th className="px-4 py-3">Snapshot</th>
              <th className="px-4 py-3">Approval</th>
              <th className="px-4 py-3">Proteção ant.</th>
              <th className="px-4 py-3">Reason code</th>
              <th className="px-4 py-3">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-b border-white/5">
                <td className="px-4 py-3">{row.status}</td>
                <td className="px-4 py-3">{row.user.email}</td>
                <td className="px-4 py-3">{row.magicNumber}</td>
                <td className="px-4 py-3">{row.marginOk ? "OK" : "Falha"}</td>
                <td className="px-4 py-3">{row.eaOnline ? "Online" : "Offline"}</td>
                <td className="px-4 py-3">{row.snapshotOk ? "OK" : "Falha"}</td>
                <td className="px-4 py-3">{row.realApprovalOk ? "OK" : "Falha"}</td>
                <td className="px-4 py-3">
                  {row.protectionPreviousOk ? "OK" : "Bloqueado"}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {row.reasonCode ?? "—"}
                </td>
                <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">
                  {row.reason ?? "—"}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-muted-foreground">
                  Nenhum preflight registrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
