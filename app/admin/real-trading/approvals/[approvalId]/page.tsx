import Link from "next/link";
import { notFound } from "next/navigation";
import { RealTradingApprovalActions } from "@/components/admin/real-trading-approval-actions";
import {
  RealTradingApprovalLimitEditPanel,
  type ApprovalLimitEditView,
} from "@/components/admin/real-trading-approval-limit-edit";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getRealTradingApprovalById,
  listRelatedPreflightsForApproval,
  listRelatedProtectionReportsForApproval,
  listRelatedSnapshotsForApproval,
} from "@/lib/admin/real-trading-approval";
import { RealTradingApprovalStatus } from "@prisma/client";
import {
  maskAccountLogin,
  maskLicenseId,
} from "@/lib/risk/real-trading-guard-status";

type PageProps = { params: Promise<{ approvalId: string }> };

function decimalToNumber(value: { toString(): string } | number | null): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return Number(value.toString());
}

export default async function AdminRealTradingApprovalDetailPage({
  params,
}: PageProps) {
  const { approvalId } = await params;
  const approval = await getRealTradingApprovalById(approvalId);
  if (!approval) notFound();

  const [snapshots, preflights, protections] = await Promise.all([
    listRelatedSnapshotsForApproval(approval),
    listRelatedPreflightsForApproval(approval),
    listRelatedProtectionReportsForApproval(approval),
  ]);

  const limitEditView: ApprovalLimitEditView = {
    approvalId: approval.id,
    licenseId: approval.licenseId,
    accountLogin: approval.accountLogin,
    accountServer: approval.accountServer,
    symbol: approval.symbol,
    magicNumber: approval.magicNumber,
    status: approval.status,
    allowReal: approval.allowReal,
    maxContracts: approval.maxContracts,
    minFreeMargin: decimalToNumber(approval.minFreeMargin),
    marginBufferPercent: decimalToNumber(approval.marginBufferPercent),
    notes: approval.notes,
    createdAt: approval.createdAt.toISOString(),
    updatedAt: approval.updatedAt.toISOString(),
    editable:
      approval.status === RealTradingApprovalStatus.APPROVED &&
      approval.allowReal &&
      approval.revokedAt == null,
    strategyConfigHref: `/admin/licenses/${approval.licenseId}/strategy-config`,
  };

  return (
    <div className="space-y-6">
      <Link
        href="/admin/real-trading/approvals"
        className="text-sm text-gold hover:underline"
      >
        ← Voltar às aprovações
      </Link>

      <Card className="p-6">
        <CardHeader className="p-0">
          <CardTitle>Aprovação real — {approval.status}</CardTitle>
          <CardDescription className="mt-2">
            ID: {approval.id.slice(0, 12)}… · allowReal:{" "}
            {approval.allowReal ? "sim" : "não"}
          </CardDescription>
        </CardHeader>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Cliente</dt>
            <dd>{approval.user.email}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Licença</dt>
            <dd className="font-mono">{maskLicenseId(approval.licenseId)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Conta</dt>
            <dd className="font-mono">{maskAccountLogin(approval.accountLogin)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Servidor</dt>
            <dd>{approval.accountServer}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Símbolo / Magic</dt>
            <dd>
              {approval.symbol} / {approval.magicNumber}
            </dd>
          </div>
        </dl>
      </Card>

      <RealTradingApprovalLimitEditPanel approval={limitEditView} />

      <Card className="p-6">
        <CardHeader className="p-0 pb-4">
          <CardTitle>Ações administrativas</CardTitle>
          <CardDescription>
            Suspender, revogar ou bloquear — com confirmação textual e trilha de
            auditoria. Não remove registro do banco.
          </CardDescription>
        </CardHeader>
        <RealTradingApprovalActions approvalId={approval.id} />
      </Card>

      <Card className="p-6">
        <CardHeader className="p-0 pb-4">
          <CardTitle>Snapshots relacionados</CardTitle>
        </CardHeader>
        {snapshots.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum snapshot.</p>
        ) : (
          <ul className="space-y-1 text-xs font-mono text-muted-foreground">
            {snapshots.map((s) => (
              <li key={s.id}>
                {s.snapshotType} · {s.environment} · {s.capturedAt.toISOString()}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-6">
        <CardHeader className="p-0 pb-4">
          <CardTitle>Preflights relacionados</CardTitle>
        </CardHeader>
        {preflights.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum preflight.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {preflights.map((p) => (
              <li key={p.id}>
                {p.status} · {p.reasonCode ?? "—"} · {p.createdAt.toISOString()}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-6">
        <CardHeader className="p-0 pb-4">
          <CardTitle>Protection reports</CardTitle>
        </CardHeader>
        {protections.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum report.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {protections.map((r) => (
              <li key={r.id}>
                {r.protectionStatus} · {r.reportedAt.toISOString()}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
