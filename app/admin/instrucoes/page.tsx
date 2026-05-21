import { AdminInstructionForm } from "@/components/admin/admin-instruction-form";
import {
  canDispatchAdminInstructions,
} from "@/lib/admin/permissions";
import {
  listAdminDispatchedInstructions,
  listLicensesForInstructionDispatch,
} from "@/lib/admin/instruction-dispatch";
import { requireAppRole } from "@/lib/auth/session";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

export default async function AdminInstrucoesPage() {
  const session = await requireAppRole("ADMIN");
  const adminRole = session.user.role ?? "";
  const canDispatch = canDispatchAdminInstructions(adminRole);

  const [licenses, recent] = await Promise.all([
    listLicensesForInstructionDispatch(),
    listAdminDispatchedInstructions(40),
  ]);

  const licenseOptions = licenses.map((l) => ({
    id: l.id,
    clientEmail: l.user.email,
    status: l.status,
    mt5Label: l.mt5Account
      ? `${l.mt5Account.login}@${l.mt5Account.server}`
      : null,
  }));

  return (
    <div className="space-y-8">
      <Card className="p-6">
        <CardHeader className="p-0 pb-4">
          <CardTitle>Fila interna — teste / homologação</CardTitle>
          <CardDescription>
            Despacho manual para validar o EA. Papéis autorizados: SUPERADMIN e
            OPS. Registro em admin_actions e audit_logs.
          </CardDescription>
        </CardHeader>

        {canDispatch ? (
          <AdminInstructionForm licenses={licenseOptions} />
        ) : (
          <p className="text-sm text-amber-400">
            Seu papel ({adminRole}) não pode despachar instruções. Apenas
            SUPERADMIN e OPS podem criar entradas nesta fila.
          </p>
        )}
      </Card>

      <Card className="overflow-hidden p-0">
        <CardHeader className="p-6 pb-0">
          <CardTitle>Instruções despachadas</CardTitle>
          <CardDescription>
            TEST e HOMOLOGATION — rastreio via status logs e execuções do EA
          </CardDescription>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-6 py-3 font-medium">Quando</th>
                <th className="px-6 py-3 font-medium">Origem</th>
                <th className="px-6 py-3 font-medium">Cliente</th>
                <th className="px-6 py-3 font-medium">Ativo</th>
                <th className="px-6 py-3 font-medium">Lado</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">ID</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-8 text-muted-foreground"
                  >
                    Nenhuma instrução de teste/homologação ainda.
                  </td>
                </tr>
              ) : (
                recent.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-white/5 hover:bg-white/[0.02]"
                  >
                    <td className="px-6 py-3">{fmtDate(row.createdAt)}</td>
                    <td className="px-6 py-3">
                      <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-xs text-gold">
                        {row.source}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-mono text-xs">
                      {row.license.user.email}
                    </td>
                    <td className="px-6 py-3">{row.symbol}</td>
                    <td className="px-6 py-3">{row.side}</td>
                    <td className="px-6 py-3">{row.currentStatus}</td>
                    <td className="px-6 py-3 font-mono text-xs text-muted-foreground">
                      {row.id.slice(0, 12)}…
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
