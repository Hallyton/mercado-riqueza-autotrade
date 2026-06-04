import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyFinancialRiskLimit, DailyFinancialRiskState } from "@prisma/client";

type SnapshotRow = {
  limit: DailyFinancialRiskLimit;
  state: DailyFinancialRiskState | null | undefined;
};

export function LicenseDailyRiskCard({
  licenseId,
  snapshots,
}: {
  licenseId: string;
  snapshots: SnapshotRow[];
}) {
  const primary = snapshots[0];

  return (
    <Card className="border-gold/20 p-6">
      <CardHeader className="p-0">
        <CardTitle>Stop financeiro diário</CardTitle>
        <CardDescription className="mt-2">
          Limite de perda diária por licença/conta/estratégia — caixa preta para o cliente.
        </CardDescription>
      </CardHeader>
      {primary ? (
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Habilitado</dt>
            <dd>{primary.limit.enabled ? "Sim" : "Não"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Limite (R$)</dt>
            <dd>{(primary.limit.dailyLossLimitCents / 100).toFixed(2)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">PnL total hoje</dt>
            <dd>
              {primary.state
                ? (primary.state.totalPnlCents / 100).toFixed(2)
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd>{primary.state?.status ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Perda restante</dt>
            <dd>
              {primary.state
                ? (primary.state.remainingLossCents / 100).toFixed(2)
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Última atualização</dt>
            <dd>
              {primary.state?.lastUpdatedAt
                ? new Date(primary.state.lastUpdatedAt).toLocaleString("pt-BR")
                : "—"}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Nenhum stop financeiro diário configurado.
        </p>
      )}
      <Link
        href={`/admin/real-trading/daily-risk?license_id=${licenseId}`}
        className="mt-4 inline-block text-sm text-gold hover:underline"
      >
        Configurar stop financeiro diário →
      </Link>
    </Card>
  );
}
