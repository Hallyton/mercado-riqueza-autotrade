import { DailyRiskAdminForm } from "@/components/admin/daily-risk-admin-form";
import { listDailyFinancialRiskLimits } from "@/lib/admin/daily-financial-risk-admin";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PageProps = { searchParams: Promise<{ license_id?: string }> };

export default async function AdminDailyRiskPage({ searchParams }: PageProps) {
  const { license_id: licenseId } = await searchParams;
  const items = await listDailyFinancialRiskLimits(licenseId);

  return (
    <div className="space-y-6">
      <Card className="border-gold/20 p-6">
        <CardHeader className="p-0">
          <CardTitle>Stop financeiro diário</CardTitle>
          <CardDescription className="mt-2">
            Configuração interna por licença, conta e estratégia MR Fibo D1 Guard.
          </CardDescription>
        </CardHeader>
      </Card>
      <Card className="border-gold/20 p-6">
        <CardHeader className="p-0">
          <CardTitle>Nova configuração</CardTitle>
          <CardDescription className="mt-2">
            O cliente vê apenas mensagem genérica de risco diário ativo.
          </CardDescription>
        </CardHeader>
        <div className="mt-6">
          <DailyRiskAdminForm defaultLicenseId={licenseId ?? ""} />
        </div>
      </Card>

      <Card className="mt-6 border-gold/20 p-6">
        <CardHeader className="p-0">
          <CardTitle>Configurações existentes</CardTitle>
        </CardHeader>
        <ul className="mt-4 space-y-3 text-sm">
          {items.map((row) => (
            <li key={row.id} className="rounded border border-white/10 p-3">
              <span className="text-gold">{row.license.user.email}</span> ·{" "}
              {row.accountLogin}@{row.accountServer} · {row.symbol} ·{" "}
              {row.enabled ? "ativo" : "inativo"} · limite R${" "}
              {(row.dailyLossLimitCents / 100).toFixed(2)}
            </li>
          ))}
          {items.length === 0 && (
            <li className="text-muted-foreground">Nenhum registro.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
