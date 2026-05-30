import { requireAppRole } from "@/lib/auth/session";
import { getClientSubscriptionOverview } from "@/lib/licensing/service";
import {
  LicenseStatusBadge,
  SubscriptionStatusBadge,
} from "@/components/subscription/status-badge";
import { LicenseOnboarding } from "@/components/subscription/license-onboarding";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function formatDate(date: Date | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export default async function AssinaturaPage() {
  const session = await requireAppRole("CLIENT");
  const overview = await getClientSubscriptionOverview(session.user.id);
  const sub = overview.subscription;
  const price = sub?.plan.prices[0];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Assinatura</CardTitle>
            <CardDescription>
              Status de pagamento e vigência do plano
            </CardDescription>
          </div>
          <SubscriptionStatusBadge status={overview.displayStatus} />
        </CardHeader>

        {sub ? (
          <dl className="grid gap-4 sm:grid-cols-2 p-6 pt-0 text-sm">
            <div>
              <dt className="text-muted-foreground">Plano</dt>
              <dd className="font-medium text-foreground">{sub.plan.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Valor mensal</dt>
              <dd className="font-medium text-gold">
                {price ? formatMoney(price.amountCents) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status interno</dt>
              <dd className="font-medium">{sub.status}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Vigência até</dt>
              <dd className="font-medium">
                {formatDate(sub.currentPeriodEnd)}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="px-6 pb-6 text-sm text-muted-foreground">
            Você ainda não possui assinatura.{" "}
            <a href="/dashboard/comercial" className="text-gold hover:underline">
              Solicite o plano comercial
            </a>{" "}
            — a licença será provisionada após confirmação administrativa do pagamento.
          </p>
        )}

        {overview.displayStatus === "past_due" && (
          <p className="mx-6 mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Pagamento em atraso: novas entradas estão bloqueadas. A gestão de
            posições já abertas é mantida conforme política do produto.
          </p>
        )}

        {(overview.displayStatus === "expired" ||
          overview.displayStatus === "cancelled") && (
          <p className="mx-6 mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            Assinatura inativa: novas operações de entrada não serão enviadas ao
            EA até regularização.
          </p>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Licenças de execução</CardTitle>
          <CardDescription>
            Vincule sua conta MT5 e gere o código para ativar o EA executor
          </CardDescription>
        </CardHeader>

        {overview.licenses.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">
            Nenhuma licença emitida. Será criada após confirmação do pagamento.
          </p>
        ) : (
          <ul className="divide-y divide-white/5 px-6 pb-6">
            {overview.licenses.map((lic) => (
              <li key={lic.id} className="py-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {lic.id.slice(0, 12)}…
                  </span>
                  <LicenseStatusBadge status={lic.status} />
                </div>
                <p className="text-sm">
                  {lic.mt5Account
                    ? `MT5: ${lic.mt5Account.login} @ ${lic.mt5Account.server}`
                    : "Conta MT5 pendente de vínculo"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Perfil: {lic.exposureProfile?.name ?? "Não definido"}
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span
                    className={
                      lic.flags.canAcceptNewEntries
                        ? "text-emerald-400"
                        : "text-amber-300"
                    }
                  >
                    {lic.flags.canAcceptNewEntries
                      ? "Novas entradas permitidas"
                      : "Novas entradas bloqueadas"}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">
                    {lic.flags.canManageOpenPositions
                      ? "Gestão de posição aberta ativa"
                      : "Sem gestão de posição"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {lic.flags.displayMessage}
                </p>

                <LicenseOnboarding
                  license={{
                    id: lic.id,
                    status: lic.status,
                    mt5Login: lic.mt5Account?.login ?? null,
                    mt5Server: lic.mt5Account?.server ?? null,
                    deviceCount: lic.deviceCount,
                    maxDevices: lic.maxDevices,
                    canLinkMt5: lic.canLinkMt5,
                    canChangeMt5: lic.canChangeMt5,
                    canIssueActivationCode: lic.canIssueActivationCode,
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">
        Rentabilidade passada não garante resultados futuros. Parâmetros
        operacionais não são exibidos — modelo caixa preta.
      </p>
    </div>
  );
}
