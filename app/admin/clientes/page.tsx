import { listAdminClientsOverview } from "@/lib/licensing/service";
import {
  LicenseStatusBadge,
  SubscriptionStatusBadge,
} from "@/components/subscription/status-badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export default async function AdminClientesPage() {
  const clients = await listAdminClientsOverview();

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="p-6 pb-0">
        <CardTitle>Clientes</CardTitle>
        <CardDescription>
          Plano, pagamento, status da licença e bloqueio de novas entradas
        </CardDescription>
      </CardHeader>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-6 py-3 font-medium">Cliente</th>
              <th className="px-6 py-3 font-medium">Plano</th>
              <th className="px-6 py-3 font-medium">Assinatura</th>
              <th className="px-6 py-3 font-medium">Pagamento</th>
              <th className="px-6 py-3 font-medium">Licenças</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-8 text-center text-muted-foreground"
                >
                  Nenhum cliente cadastrado.
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr
                  key={client.id}
                  className="border-b border-white/5 hover:bg-white/[0.02]"
                >
                  <td className="px-6 py-4">
                    <p className="font-medium text-foreground">{client.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {client.name ?? "—"} · {formatDate(client.createdAt)}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    {client.subscription?.planName ?? "—"}
                    {client.subscription?.planSlug && (
                      <p className="text-xs text-muted-foreground">
                        {client.subscription.planSlug}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {client.subscription ? (
                      <SubscriptionStatusBadge
                        status={client.subscription.displayStatus}
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">
                    {client.paymentStatus ?? "—"}
                  </td>
                  <td className="px-6 py-4">
                    {client.licenses.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <ul className="space-y-2">
                        {client.licenses.map((lic) => (
                          <li key={lic.id} className="space-y-1">
                            <LicenseStatusBadge status={lic.status} />
                            <p className="text-xs text-muted-foreground">
                              {lic.mt5}
                              {lic.haltNewEntries ? " · sem novas entradas" : ""}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
