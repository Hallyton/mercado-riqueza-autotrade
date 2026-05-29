import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listExecutionProtectionReportsAdmin } from "@/lib/admin/real-trading-approval";
import { ProtectionStatus } from "@prisma/client";

export default async function AdminRealTradingProtectionPage() {
  const items = await listExecutionProtectionReportsAdmin(100);

  return (
    <div className="space-y-6">
      <Card className="border-gold/20 p-6">
        <CardHeader className="p-0">
          <CardTitle>Relatórios de proteção (SL/TP)</CardTitle>
          <CardDescription className="mt-2">
            PROTECTION_FAILED bloqueia novas ordens no magicNumber até revisão admin.
            Stop/take ausentes em conta real falham validação.
          </CardDescription>
        </CardHeader>
      </Card>
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5">
            <tr>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Instrução</th>
              <th className="px-4 py-3">Magic</th>
              <th className="px-4 py-3">SL</th>
              <th className="px-4 py-3">TP</th>
              <th className="px-4 py-3">Reportado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const failed =
                row.protectionStatus === ProtectionStatus.PROTECTION_FAILED;
              return (
                <tr
                  key={row.id}
                  className={`border-b border-white/5 ${failed ? "bg-red-950/20" : ""}`}
                >
                  <td className="px-4 py-3 font-medium">{row.protectionStatus}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {row.instructionId.slice(0, 12)}…
                  </td>
                  <td className="px-4 py-3">{row.magicNumber}</td>
                  <td className="px-4 py-3">
                    {row.stopLossPresent ? "Sim" : "Não"}
                  </td>
                  <td className="px-4 py-3">
                    {row.takeProfitPresent ? "Sim" : "Não"}
                  </td>
                  <td className="px-4 py-3">
                    {row.reportedAt.toISOString().slice(0, 19)}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-muted-foreground">
                  Nenhum relatório de proteção.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
