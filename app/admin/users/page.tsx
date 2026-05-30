import Link from "next/link";
import { listAdminUsers } from "@/lib/admin/users";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function statusClass(status: string) {
  if (status === "ACTIVE") return "text-emerald-400";
  if (status === "BLOCKED") return "text-red-300";
  return "text-amber-400";
}

export default async function AdminUsersPage() {
  const users = await listAdminUsers();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/users/new"
          className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black"
        >
          Novo usuário
        </Link>
        <Link
          href="/admin/clientes"
          className="text-sm text-gold hover:underline"
        >
          Ver clientes e licenças →
        </Link>
      </div>

      <Card className="overflow-hidden p-0">
        <CardHeader className="p-6 pb-0">
          <CardTitle>Usuários</CardTitle>
          <CardDescription>
            Cadastro, status, papéis e acesso às licenças — sem exposição de senhas ou tokens.
          </CardDescription>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-6 py-3 font-medium">Nome / E-mail</th>
                <th className="px-6 py-3 font-medium">Perfil</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Criado</th>
                <th className="px-6 py-3 font-medium">Último acesso</th>
                <th className="px-6 py-3 font-medium">Assinatura</th>
                <th className="px-6 py-3 font-medium">Licenças</th>
                <th className="px-6 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                    Nenhum usuário cadastrado.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-white/5 hover:bg-white/[0.02]"
                  >
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="font-medium text-gold hover:underline"
                      >
                        {u.email}
                      </Link>
                      <p className="text-xs text-muted-foreground">{u.name ?? "—"}</p>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">{u.role}</td>
                    <td className={`px-6 py-4 font-mono text-xs ${statusClass(u.status)}`}>
                      {u.status}
                    </td>
                    <td className="px-6 py-4 text-xs">{formatDate(u.createdAt)}</td>
                    <td className="px-6 py-4 text-xs">{formatDate(u.lastLoginAt)}</td>
                    <td className="px-6 py-4 text-xs">
                      {u.subscription
                        ? `${u.subscription.planName} (${u.subscription.status})`
                        : "—"}
                    </td>
                    <td className="px-6 py-4">{u.licenseCount}</td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="text-xs text-gold hover:underline"
                      >
                        Ver detalhes →
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
