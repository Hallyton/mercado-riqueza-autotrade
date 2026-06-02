import { PreflightDryRunPanel } from "@/components/admin/preflight-dry-run-panel";
import { FirstRealManualDispatchPanel } from "@/components/admin/first-real-manual-dispatch-panel";
import { REAL_MANUAL_PREFLIGHT_MAX_AGE_MS } from "@/lib/admin/real-manual-dispatch-validation";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listRealTradePreflightsAdmin } from "@/lib/admin/real-trading-approval";
import prisma from "@/lib/prisma";

const DEFAULT_LICENSE_ID = "cmptsr44j0005ib0417zkckn6";

export default async function AdminRealTradingPreflightsPage() {
  const [items, license] = await Promise.all([
    listRealTradePreflightsAdmin(100),
    prisma.license.findUnique({
      where: { id: DEFAULT_LICENSE_ID },
      include: { mt5Account: true },
    }),
  ]);

  const mt5 = license?.mt5Account;
  const now = Date.now();
  const recentPassedDryRuns = items
    .filter(
      (row) =>
        row.source === "DRY_RUN" &&
        row.status === "PASSED" &&
        row.reasonCode === "REAL_TRADING_ALLOWED_BY_CONTROLLED_GATE" &&
        now - row.createdAt.getTime() <= REAL_MANUAL_PREFLIGHT_MAX_AGE_MS
    )
    .map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      licenseId: row.licenseId,
      accountLogin: row.accountLogin,
      accountServer: row.accountServer,
      symbol: row.symbol,
      magicNumber: row.magicNumber,
      requestedContracts: row.requestedContracts,
      reasonCode: row.reasonCode,
    }));

  return (
    <div className="space-y-6">
      <Card className="border-gold/20 p-6">
        <CardHeader className="p-0">
          <CardTitle>Preflight dry-run (conta real)</CardTitle>
          <CardDescription className="mt-2">
            Valida o gate REAL sem criar instruction e sem enviar ordem. O resultado é
            registrado como DRY_RUN na tabela abaixo.
          </CardDescription>
        </CardHeader>
        <div className="mt-6">
          <PreflightDryRunPanel
            defaultLicenseId={license?.id ?? DEFAULT_LICENSE_ID}
            defaultAccountLogin={mt5?.login ?? "19583778"}
            defaultAccountServer={mt5?.server ?? "XPMT5-PRD"}
            defaultSymbol="WDON26"
            defaultMagicNumber="910001"
          />
        </div>
      </Card>

      <Card className="border-gold/20 p-6">
        <CardHeader className="p-0 pb-4">
          <CardTitle>Criar instruction REAL manual</CardTitle>
          <CardDescription className="mt-2">
            Liberado somente após dry-run PASSED recente (15 minutos). Exige tipo de
            ordem, Stop Loss e Take Profit. Para LIMIT/STOP, informe também o preço de
            apregoamento.
          </CardDescription>
        </CardHeader>
        <FirstRealManualDispatchPanel preflights={recentPassedDryRuns} />
      </Card>

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5">
            <tr>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Origem</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Magic</th>
              <th className="px-4 py-3">Margem</th>
              <th className="px-4 py-3">EA</th>
              <th className="px-4 py-3">Snapshot</th>
              <th className="px-4 py-3">Approval</th>
              <th className="px-4 py-3">Proteção ant.</th>
              <th className="px-4 py-3">Reason code</th>
              <th className="px-4 py-3">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-b border-white/5">
                <td className="px-4 py-3">{row.status}</td>
                <td className="px-4 py-3 font-mono text-xs">{row.source}</td>
                <td className="px-4 py-3">{row.user.email}</td>
                <td className="px-4 py-3">{row.magicNumber}</td>
                <td className="px-4 py-3">{row.marginOk ? "OK" : "Falha"}</td>
                <td className="px-4 py-3">{row.eaOnline ? "Online" : "Offline"}</td>
                <td className="px-4 py-3">{row.snapshotOk ? "OK" : "Falha"}</td>
                <td className="px-4 py-3">{row.realApprovalOk ? "OK" : "Falha"}</td>
                <td className="px-4 py-3">
                  {row.protectionPreviousOk ? "OK" : "Bloqueado"}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {row.reasonCode ?? "—"}
                </td>
                <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">
                  {row.reason ?? "—"}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-muted-foreground">
                  Nenhum preflight registrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
