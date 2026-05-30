import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivationCodeGenerator } from "@/components/admin/activation-code-generator";
import { LicenseDeviceManagement } from "@/components/admin/license-device-management";
import { LicenseStatus, SubscriptionStatus } from "@prisma/client";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LicenseStatusBadge } from "@/components/subscription/status-badge";
import { getLicenseAdminDetail } from "@/lib/admin/license-devices";

type PageProps = { params: Promise<{ licenseId: string }> };

export default async function AdminLicenseDetailPage({ params }: PageProps) {
  const { licenseId } = await params;
  const detail = await getLicenseAdminDetail(licenseId);
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
            <dt className="text-muted-foreground">Conta MT5</dt>
            <dd>
              {detail.mt5Account
                ? `${detail.mt5Account.login} @ ${detail.mt5Account.server}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Último heartbeat</dt>
            <dd>
              {detail.latestHeartbeat
                ? `${detail.latestHeartbeat.tradeMode ?? "—"} · ${detail.latestHeartbeat.deviceId} · ${detail.latestHeartbeat.receivedAt.toISOString()}`
                : "—"}
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="p-6">
        <CardHeader className="p-0 pb-4">
          <CardTitle>Devices / VPS</CardTitle>
          <CardDescription>
            Revogue o device DEMO antigo para liberar vaga antes de ativar na conta real.
          </CardDescription>
        </CardHeader>
        <LicenseDeviceManagement
          licenseId={detail.licenseId}
          devices={deviceRows}
          maxDevices={detail.maxDevices}
          activeDeviceCount={detail.activeDeviceCount}
        />
      </Card>

      <ActivationCodeGenerator
        licenseId={detail.licenseId}
        canGenerate={canGenerateCode}
        ineligibleReason={ineligibleReason}
      />
    </div>
  );
}
