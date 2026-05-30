import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { AdminUserActions } from "@/components/admin/admin-user-actions";
import { getAdminUserDetail } from "@/lib/admin/users";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LicenseStatusBadge } from "@/components/subscription/status-badge";

type PageProps = { params: Promise<{ userId: string }> };

function formatDt(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { userId } = await params;
  const detail = await getAdminUserDetail(userId);
  if (!detail) notFound();

  const session = await auth();
  const currentUserId = session?.user?.id;

  const { user } = detail;

  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="text-sm text-gold hover:underline">
        ← Voltar aos usuários
      </Link>

      <Card className="p-6">
        <CardHeader className="p-0">
          <CardTitle>{user.email}</CardTitle>
          <CardDescription className="mt-1">
            {user.name ?? "—"} · {user.role} ·{" "}
            <span className="font-mono">{user.status}</span>
          </CardDescription>
        </CardHeader>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Criado em</dt>
            <dd>{formatDt(user.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Último acesso</dt>
            <dd>{formatDt(user.lastLoginAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Trocar senha no login</dt>
            <dd>{user.mustChangePassword ? "Sim" : "Não"}</dd>
          </div>
          {user.blockedAt && (
            <div>
              <dt className="text-muted-foreground">Bloqueado em</dt>
              <dd>{formatDt(user.blockedAt)}</dd>
            </div>
          )}
          {user.inactiveAt && (
            <div>
              <dt className="text-muted-foreground">Inativado em</dt>
              <dd>{formatDt(user.inactiveAt)}</dd>
            </div>
          )}
        </dl>
      </Card>

      <Card className="p-6">
        <CardHeader className="p-0 pb-4">
          <CardTitle>Licenças</CardTitle>
          <CardDescription>Gerenciar devices e códigos de ativação por licença.</CardDescription>
        </CardHeader>
        {detail.licenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma licença.</p>
        ) : (
          <ul className="space-y-3">
            {detail.licenses.map((lic) => (
              <li
                key={lic.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-white/10 p-3"
              >
                <div>
                  <LicenseStatusBadge status={lic.status} />
                  <p className="text-xs text-muted-foreground mt-1">
                    {lic.licenseIdMasked} · {lic.mt5 ?? "MT5 não vinculado"} ·{" "}
                    {lic.deviceCount} device(s)
                  </p>
                </div>
                <Link
                  href={`/admin/licenses/${lic.id}`}
                  className="text-sm text-gold hover:underline"
                >
                  Gerenciar licença / devices →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-6">
        <CardHeader className="p-0 pb-4">
          <CardTitle>Códigos de ativação recentes</CardTitle>
          <CardDescription>Sem código em claro — apenas metadados.</CardDescription>
        </CardHeader>
        {detail.activationCodes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registro.</p>
        ) : (
          <ul className="text-xs space-y-2 font-mono">
            {detail.activationCodes.map((c) => (
              <li key={c.id} className="text-muted-foreground">
                {c.licenseIdMasked} · criado {formatDt(c.createdAt)} · expira{" "}
                {formatDt(c.expiresAt)} · {c.usedAt ? "usado" : "pendente"}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-6">
        <CardHeader className="p-0 pb-4">
          <CardTitle>Últimos heartbeats</CardTitle>
        </CardHeader>
        {detail.recentHeartbeats.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <ul className="text-xs space-y-1 text-muted-foreground">
            {detail.recentHeartbeats.map((hb) => (
              <li key={hb.id}>
                {hb.tradeMode} · {hb.deviceId} · {formatDt(hb.receivedAt)}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-6">
        <CardHeader className="p-0 pb-4">
          <CardTitle>Ações administrativas</CardTitle>
          <CardDescription>Confirmação textual obrigatória · auditoria registrada.</CardDescription>
        </CardHeader>
        <AdminUserActions
          userId={userId}
          status={user.status}
          currentUserId={currentUserId}
        />
      </Card>

      <Card className="p-6">
        <CardHeader className="p-0 pb-4">
          <CardTitle>Histórico AdminAction (usuário)</CardTitle>
        </CardHeader>
        {detail.adminActions.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <ul className="text-xs space-y-2">
            {detail.adminActions.map((a) => (
              <li key={a.id} className="text-muted-foreground">
                <span className="text-foreground">{a.action}</span> ·{" "}
                {formatDt(a.createdAt)}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
