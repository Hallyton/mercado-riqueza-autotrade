import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listExecutionProtectionReportsAdmin } from "@/lib/admin/real-trading-approval";
import { ProtectionStatus } from "@prisma/client";

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

function fmtPrice(value: { toString(): string } | null | undefined) {
  if (value == null) return "—";
  return Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 6 });
}

export default async function AdminRealTradingProtectionPage() {
  const items = await listExecutionProtectionReportsAdmin(100);
  const latestAt = items[0]?.reportedAt ?? null;

  return (
    <div className="space-y-6">
      <Card className="border-gold/20 p-6">
        <CardHeader className="p-0">
          <CardTitle>Relatórios de proteção (SL/TP)</CardTitle>
          <CardDescription className="mt-2">
            Stop e take obrigatórios em conta real. PROTECTION_FAILED bloqueia novas
            ordens do mesmo magic. Registros mais recentes aparecem primeiro.
          </CardDescription>
        </CardHeader>
      </Card>
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5">
            <tr>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Origem</th>
              <th className="px-4 py-3">Tipo ordem</th>
              <th className="px-4 py-3">Conta</th>
              <th className="px-4 py-3">Instrução</th>
              <th className="px-4 py-3">Magic</th>
              <th className="px-4 py-3">SL instr.</th>
              <th className="px-4 py-3">TP instr.</th>
              <th className="px-4 py-3">SL conf.</th>
              <th className="px-4 py-3">TP conf.</th>
              <th className="px-4 py-3">Reportado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const failed =
                row.protectionStatus === ProtectionStatus.PROTECTION_FAILED;
              const isHomologation =
                row.instruction.source === "TEST" ||
                row.instruction.source === "HOMOLOGATION";
              const isCurrent =
                latestAt != null &&
                row.reportedAt.getTime() === latestAt.getTime() &&
                !isHomologation;
              return (
                <tr
                  key={row.id}
                  className={`border-b border-white/5 ${
                    failed
                      ? "bg-red-950/20"
                      : isCurrent
                        ? "bg-gold/5"
                        : isHomologation
                          ? "opacity-60"
                          : ""
                  }`}
                >
                  <td className="px-4 py-3 font-medium">{row.protectionStatus}</td>
                  <td className="px-4 py-3">{row.license.user.email}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {row.instruction.source ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {row.instruction.orderType}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {row.accountLogin}@{row.accountServer}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs break-all select-all">
                    {row.instructionId}
                  </td>
                  <td className="px-4 py-3">{row.magicNumber}</td>
                  <td className="px-4 py-3">{fmtPrice(row.instruction.stopLoss)}</td>
                  <td className="px-4 py-3">{fmtPrice(row.instruction.takeProfit)}</td>
                  <td className="px-4 py-3">
                    {row.stopLossPresent ? "Sim" : "Não"}
                  </td>
                  <td className="px-4 py-3">
                    {row.takeProfitPresent ? "Sim" : "Não"}
                  </td>
                  <td className="px-4 py-3">{fmtDate(row.reportedAt)}</td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-muted-foreground">
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
