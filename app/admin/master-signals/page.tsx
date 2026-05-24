import Link from "next/link";
import {
  canDispatchMasterSignals,
} from "@/lib/admin/permissions";
import { listMasterSignalsForAdmin } from "@/lib/master-signals/admin";
import { requireAppRole } from "@/lib/auth/session";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

export default async function AdminMasterSignalsPage() {
  const session = await requireAppRole("ADMIN");
  const adminRole = session.user.role ?? "";
  const canDispatch = canDispatchMasterSignals(adminRole);
  const signals = await listMasterSignalsForAdmin(100);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <CardHeader className="p-0">
          <CardTitle>Sinais mestre</CardTitle>
          <CardDescription>
            Intake via EA Mãe (`POST /api/master/signals`). Dispatch manual pelo
            painel — não automático no POST. Papéis com disparo: SUPERADMIN e OPS.
          </CardDescription>
        </CardHeader>
        {!canDispatch && (
          <p className="mt-4 text-sm text-amber-400">
            Seu papel ({adminRole}) pode visualizar sinais, mas não disparar para
            clientes.
          </p>
        )}
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-6 py-3 font-medium">Master Signal ID</th>
                <th className="px-6 py-3 font-medium">Source</th>
                <th className="px-6 py-3 font-medium">Symbol</th>
                <th className="px-6 py-3 font-medium">Side</th>
                <th className="px-6 py-3 font-medium">Order</th>
                <th className="px-6 py-3 font-medium">Purpose</th>
                <th className="px-6 py-3 font-medium">Profile</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Received</th>
                <th className="px-6 py-3 font-medium">Dispatches</th>
                <th className="px-6 py-3 font-medium">Instructions</th>
                <th className="px-6 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {signals.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="px-6 py-8 text-muted-foreground"
                  >
                    Nenhum sinal mestre registrado.
                  </td>
                </tr>
              ) : (
                signals.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-white/5 hover:bg-white/[0.02]"
                  >
                    <td className="px-6 py-3 font-mono text-xs">
                      {row.masterSignalId}
                    </td>
                    <td className="px-6 py-3">{row.source}</td>
                    <td className="px-6 py-3">{row.symbol}</td>
                    <td className="px-6 py-3">{row.side}</td>
                    <td className="px-6 py-3">{row.orderType}</td>
                    <td className="px-6 py-3">{row.purpose}</td>
                    <td className="px-6 py-3">{row.profileSlug ?? "—"}</td>
                    <td className="px-6 py-3">
                      <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-xs text-gold">
                        {row.status}
                      </span>
                    </td>
                    <td className="px-6 py-3">{fmtDate(row.receivedAt)}</td>
                    <td className="px-6 py-3">{row.dispatchCount}</td>
                    <td className="px-6 py-3">{row.instructionCount}</td>
                    <td className="px-6 py-3">
                      <Link
                        href={`/admin/master-signals/${encodeURIComponent(row.masterSignalId)}`}
                        className="text-gold hover:underline"
                      >
                        Ver detalhes
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
