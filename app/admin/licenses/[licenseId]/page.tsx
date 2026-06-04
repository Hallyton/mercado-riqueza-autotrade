import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivationCodeGenerator } from "@/components/admin/activation-code-generator";
import { LicenseDeviceManagement } from "@/components/admin/license-device-management";
import { LicenseMt5AccountCard } from "@/components/admin/license-mt5-account-card";
import { LicenseOperationalModeCard } from "@/components/admin/license-operational-mode";
import { LicenseStatus, SubscriptionStatus } from "@prisma/client";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LicenseStatusBadge } from "@/components/subscription/status-badge";
import { LicenseDailyRiskCard } from "@/components/admin/license-daily-risk-card";
import { getDailyRiskSnapshotForLicense } from "@/lib/admin/daily-financial-risk-admin";
import { getLicenseAdminDetail } from "@/lib/admin/license-devices";

type PageProps = { params: Promise<{ licenseId: string }> };

export default async function AdminLicenseDetailPage({ params }: PageProps) {
  const { licenseId } = await params;
  const [detail, dailyRiskSnapshots] = await Promise.all([
    getLicenseAdminDetail(licenseId),
    getDailyRiskSnapshotForLicense(licenseId),
  ]);
  if (!detail) notFound();

  const sub = detail.subscription;
  const canGenerateCode =
    Boolean(detail.mt5Account) &&
    (detail.status === LicenseStatus.ACTIVE ||
      detail.status === LicenseStatus.PENDING_ACTIVATION) &&
    sub?.status === SubscriptionStatus.ACTIVE &&
    (!sub?.currentPeriodEnd || sub.currentPeriodEnd >= new Date());

  let ineligibleReason: string | null = null;
  if (!detail.mt5Account) {
    ineligibleReason = "Vincule uma conta MT5 antes de gerar o código.";
  } else if (detail.status === LicenseStatus.REVOKED) {
    ineligibleReason = "Licença revogada.";
  } else if (detail.status === LicenseStatus.SUSPENDED) {
    ineligibleReason = "Licença suspensa.";
  } else if (!sub || sub.status !== SubscriptionStatus.ACTIVE) {
    ineligibleReason = "Assinatura inativa.";
  }

  const deviceRows = detail.devices.map((d) => ({
    ...d,
    createdAt: d.createdAt.toISOString(),
    lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
    revokedAt: d.revokedAt?.toISOString() ?? null,
    blockedAt: d.blockedAt?.toISOString() ?? null,
    lastHeartbeatAt: d.lastHeartbeatAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6">
      <Link href="/admin/clientes" className="text-sm text-gold hover:underline">
        ← Voltar aos clientes
      </Link>

      <Card className="p-6">
        <CardHeader className="p-0">
          <CardTitle>Licença — gerenciar devices/VPS</CardTitle>
          <CardDescription className="mt-2">
            {detail.user.email} · Licença {detail.licenseIdMasked}
          </CardDescription>
        </CardHeader>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Cliente</dt>
            <dd>{detail.user.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status licença</dt>
            <dd>
              <LicenseStatusBadge status={detail.status} />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Plano</dt>
            <dd>
              {detail.plan?.name ?? "—"} (max devices: {detail.maxDevices})
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Conta MT5 vinculada</dt>
            <dd>
              {detail.mt5Account
                ? `${detail.mt5Account.login} @ ${detail.mt5Account.server}`
                : "—"}
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="p-6">
        <LicenseMt5AccountCard
          licenseId={detail.licenseId}
          linked={detail.mt5Linked}
          login={detail.mt5Account?.login ?? null}
          server={detail.mt5Account?.server ?? null}
          expectedSymbol={detail.expectedSymbol}
          expectedMagicNumber={detail.expectedMagicNumber}
          expectedTradeMode={detail.expectedTradeMode}
          lastChangedAt={
            detail.mt5BindingAudit?.changedAt.toISOString() ?? null
          }
          lastChangedBy={detail.mt5BindingAudit?.changedBy ?? null}
        />
      </Card>

      <LicenseDailyRiskCard
        licenseId={detail.licenseId}
        snapshots={dailyRiskSnapshots}
      />

      <Card className="p-6">
        <LicenseOperationalModeCard
          licenseId={detail.licenseId}
          expectedTradeMode={detail.expectedTradeMode}
          expectedAccountLogin={detail.expectedAccount.login}
          expectedAccountServer={detail.expectedAccount.server}
          expectedSymbol={detail.expectedSymbol}
          expectedMagicNumber={detail.expectedMagicNumber}
          mt5Login={detail.mt5Account?.login ?? null}
          mt5Server={detail.mt5Account?.server ?? null}
          operationalStatus={detail.operationalStatus}
          latestHeartbeatTradeMode={detail.latestHeartbeat?.tradeMode ?? null}
          latestHeartbeatDeviceId={detail.latestHeartbeat?.deviceId ?? null}
          latestHeartbeatAt={
            detail.latestHeartbeat?.receivedAt.toISOString() ?? null
          }
        />
      </Card>

      <Card className="p-6">
        <CardHeader className="p-0 pb-4">
          <CardTitle>Devices / VPS</CardTitle>
          <CardDescription>
            tradeMode na tabela é o último valor reportado pelo heartbeat (histórico).
            Devices REVOKED não são editáveis — configure o modo esperado e ative um novo device.
          </CardDescription>
        </CardHeader>
        <LicenseDeviceManagement
          licenseId={detail.licenseId}
          devices={deviceRows}
          maxDevices={detail.maxDevices}
          activeDeviceCount={detail.activeDeviceCount}
          expectedTradeMode={detail.expectedTradeMode}
        />
      </Card>

      <ActivationCodeGenerator
        licenseId={detail.licenseId}
        canGenerate={canGenerateCode}
        ineligibleReason={ineligibleReason}
        expectedAccountLogin={
          detail.mt5Account?.login ?? detail.expectedAccount.login
        }
        expectedAccountServer={
          detail.mt5Account?.server ?? detail.expectedAccount.server
        }
        expectedTradeMode={detail.expectedTradeMode}
        expectedSymbol={detail.expectedSymbol}
        expectedMagicNumber={detail.expectedMagicNumber}
        mt5Linked={detail.mt5Linked}
      />
    </div>
  );
}
