import { SubscriptionStatusBadge } from "@/components/subscription/status-badge";
import { LicenseStatusBadge } from "@/components/subscription/status-badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { formatDateTime } from "@/lib/format";
import type { ClientDashboardData } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

export function StatusOverview({ data }: { data: ClientDashboardData }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Assinatura"
        value={
          <SubscriptionStatusBadge status={data.subscription.displayStatus} />
        }
        hint={
          data.subscription.planName
            ? `Plano ${data.subscription.planName}`
            : "Sem plano ativo"
        }
      />
      <StatCard
        label="Licença"
        value={
          data.license ? (
            <LicenseStatusBadge status={data.license.status} />
          ) : (
            "—"
          )
        }
        hint={
          data.license?.canAcceptNewEntries
            ? "Entradas autorizadas"
            : "Novas entradas bloqueadas"
        }
      />
      <StatCard
        label="EA executor"
        value={
          <span
            className={cn(
              data.ea.online ? "text-emerald-400" : "text-red-400"
            )}
          >
            {data.ea.online ? "Online" : "Offline"}
          </span>
        }
        hint={
          data.ea.eaVersion
            ? `Versão ${data.ea.eaVersion}`
            : "Aguardando sincronização"
        }
      />
      <StatCard
        label="Última sincronização"
        value={formatDateTime(data.ea.lastSyncAt)}
        hint="Heartbeat do MetaTrader 5"
      />
      <StatCard
        label="Conta vinculada"
        value={
          data.license?.mt5Login
            ? `${data.license.mt5Login}`
            : "Pendente"
        }
        hint={data.license?.mt5Server ?? "Vincule no painel de assinatura"}
        className="sm:col-span-2"
      />
      <StatCard
        label="Plano contratado"
        value={data.subscription.planName ?? "—"}
        hint={data.subscription.planSlug ?? undefined}
      />
      <StatCard
        label="Perfil de exposição"
        value={data.license?.exposureProfileName ?? "Não definido"}
        hint="Limite comercial — sem parâmetros de estratégia"
        valueClassName="text-gold"
      />
    </section>
  );
}
