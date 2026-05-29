import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listAccountSnapshotsAdmin } from "@/lib/admin/real-trading-approval";

export default async function AdminRealTradingSnapshotsPage() {
  const items = await listAccountSnapshotsAdmin(100);

  return (
    <div className="space-y-6">
      <Card className="border-gold/20 p-6">
        <CardHeader className="p-0">
          <CardTitle>Snapshots de conta</CardTitle>
          <CardDescription className="mt-2">
            PRE_MARKET do dia é obrigatório antes de operação real. EA envia via POST
            /api/v1/ea/account-snapshots.
          </CardDescription>
        </CardHeader>
      </Card>
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5">
            <tr>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Conta</th>
              <th className="px-4 py-3">Ambiente</th>
              <th className="px-4 py-3">Equity</th>
              <th className="px-4 py-3">Margem livre</th>
              <th className="px-4 py-3">Capturado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-b border-white/5">
                <td className="px-4 py-3">{row.snapshotType}</td>
                <td className="px-4 py-3">{row.user.email}</td>
                <td className="px-4 py-3">
                  {row.accountLogin} @ {row.accountServer}
                </td>
                <td className="px-4 py-3">{row.environment}</td>
                <td className="px-4 py-3">{Number(row.equity).toFixed(2)}</td>
                <td className="px-4 py-3">
                  {row.freeMargin != null ? Number(row.freeMargin).toFixed(2) : "—"}
                </td>
                <td className="px-4 py-3">
                  {row.capturedAt.toISOString().slice(0, 19)}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-muted-foreground">
                  Nenhum snapshot registrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
