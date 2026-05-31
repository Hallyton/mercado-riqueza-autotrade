import { requireAppRole } from "@/lib/auth/session";
import { getCommercialPortalOverview } from "@/lib/commercial/portal-overview";
import { SubscriptionRequestForm } from "@/components/commercial/subscription-request-form";
import { CommercialInvoicesSection } from "@/components/billing/commercial-invoices-section";
import { SubscriptionStatusBadge } from "@/components/subscription/status-badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function formatMoney(cents: number | null) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function formatDt(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

export default async function ComercialPortalPage() {
  const session = await requireAppRole("CLIENT");
  const overview = await getCommercialPortalOverview(session.user.id);
  const sub = overview.subscription;

  const showRequestForm =
    !sub ||
    sub.adminPaymentStatus === "PENDING" ||
    sub.displayStatus === "pending";

  return (
    <div className="space-y-6">
      {overview.alerts.map((alert) => (
        <p
          key={alert}
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
        >
          {alert}
        </p>
      ))}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Assinatura comercial</CardTitle>
            <CardDescription>Plano, pagamento e vigência</CardDescription>
          </div>
          {sub && <SubscriptionStatusBadge status={sub.displayStatus} />}
        </CardHeader>

        {sub ? (
          <dl className="grid gap-4 sm:grid-cols-2 p-6 pt-0 text-sm">
            <div>
              <dt className="text-muted-foreground">Plano</dt>
              <dd className="font-medium">{sub.planName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Valor mensal</dt>
              <dd className="font-medium text-gold">
                {formatMoney(sub.monthlyPriceCents)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Robôs contratados</dt>
              <dd className="font-medium">
                {sub.robotCount} (máx. plano: {sub.maxRobots})
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Pagamento</dt>
              <dd className="font-medium">{sub.adminPaymentStatusLabel}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Vigência até</dt>
              <dd className="font-medium">
                {formatDt(sub.currentPeriodEnd)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Termos aceitos</dt>
              <dd className="font-medium">
                {overview.termsAccepted ? "Sim" : "Pendente"}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="px-6 pb-6 text-sm text-muted-foreground">
            Nenhuma assinatura ativa. Solicite o plano AutoTrade Single Robot abaixo.
          </p>
        )}

        {sub?.adminPaymentStatus === "PENDING" && (
          <p className="mx-6 mb-6 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-sm">
            Pagamento pendente de confirmação administrativa. A licença e o robô serão
            provisionados após confirmação — sem liberação automática de conta real.
          </p>
        )}
      </Card>

      {showRequestForm && (
        <SubscriptionRequestForm
          hasSubscription={!!sub}
          termsAccepted={overview.termsAccepted}
        />
      )}

      <CommercialInvoicesSection
        invoices={overview.invoices}
        currentInvoice={overview.currentInvoice}
      />

      <Card>
        <CardHeader>
          <CardTitle>Robôs e instâncias</CardTitle>
          <CardDescription>
            Status operacional por robô — magicNumber atribuído pelo servidor
          </CardDescription>
        </CardHeader>
        {overview.robots.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">
            Nenhum robô provisionado ainda. Após confirmação administrativa do pagamento, o
            robô será alocado com magicNumber exclusivo.
          </p>
        ) : (
          <ul className="divide-y divide-white/5 px-6 pb-6">
            {overview.robots.map((robot) => (
              <li key={robot.id} className="py-4 space-y-2 text-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Robô provisionado
                </p>
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">Produto: {robot.productName}</span>
                  <span className="rounded-full border border-gold/30 px-2 py-0.5 text-xs text-gold">
                    Status: {robot.displayStatusLabel}
                  </span>
                </div>
                <p className="text-muted-foreground">
                  MagicNumber:{" "}
                  <span className="font-mono text-foreground" aria-readonly="true">
                    {robot.magicNumber ?? "Aguardando alocação"}
                  </span>
                </p>
                {robot.symbol && (
                  <p className="text-muted-foreground">
                    Símbolo: <span className="text-foreground">{robot.symbol}</span>
                  </p>
                )}
                {robot.licenseStatusLabel && (
                  <p className="text-muted-foreground">
                    Licença:{" "}
                    <span className="text-foreground">{robot.licenseStatusLabel}</span>
                    {robot.licenseIdMasked ? ` · ${robot.licenseIdMasked}` : ""}
                  </p>
                )}
                {robot.deviceStatusLabel && (
                  <p className="text-xs text-muted-foreground">
                    Device/EA: {robot.deviceStatusLabel}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Último heartbeat: {formatDt(robot.lastHeartbeat)}
                  {robot.lastProtectionStatus
                    ? ` · Proteção: ${robot.lastProtectionStatus}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Licenças, EA e devices</CardTitle>
          <CardDescription>Conta MT5 parcialmente mascarada — sem tokens ou códigos</CardDescription>
        </CardHeader>
        {overview.licenses.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">
            Licença será emitida após confirmação comercial.
          </p>
        ) : (
          <ul className="divide-y divide-white/5 px-6 pb-6">
            {overview.licenses.map((lic) => (
              <li key={lic.id} className="py-4 space-y-2 text-sm">
                <p>
                  Licença {lic.idMasked} ·{" "}
                  <span className="text-gold">{lic.status}</span>
                </p>
                <p className="text-muted-foreground">
                  MT5:{" "}
                  {lic.mt5LoginMasked
                    ? `${lic.mt5LoginMasked} @ ${lic.mt5Server}`
                    : "Pendente de vínculo"}
                </p>
                <p className="text-muted-foreground">
                  Devices ativos: {lic.deviceCount}/{lic.maxDevices} · Último sinal:{" "}
                  {formatDt(lic.lastDeviceSeenAt)}
                </p>
                <p className="text-xs text-muted-foreground">{lic.flags.displayMessage}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">
        Rentabilidade passada não garante resultados futuros. Parâmetros operacionais
        permanecem protegidos — tecnologia proprietária do Mercado da Riqueza.
      </p>
    </div>
  );
}
