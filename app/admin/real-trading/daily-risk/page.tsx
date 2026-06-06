import { DailyRiskAdminPanel } from "@/components/admin/daily-risk-admin-panel";
import { listDailyRiskExistingConfigViews } from "@/lib/admin/daily-financial-risk-admin";
import { listDailyRiskEligibleLicenses } from "@/lib/admin/daily-risk-eligible-licenses";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PageProps = {
  searchParams: Promise<{ licenseId?: string; license_id?: string }>;
};

export default async function AdminDailyRiskPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const preselectedLicenseId = params.licenseId ?? params.license_id ?? "";

  const [eligibleLicenses, existingConfigs] = await Promise.all([
    listDailyRiskEligibleLicenses(),
    listDailyRiskExistingConfigViews(),
  ]);

  return (
    <div className="space-y-6">
      <Card className="border-gold/20 p-6">
        <CardHeader className="p-0">
          <CardTitle>Stop financeiro diário</CardTitle>
          <CardDescription className="mt-2">
            Configuração interna por licença, conta, símbolo e estratégia MR Fibo D1
            Guard. Selecione uma licença ativa — conta, servidor e símbolo são
            preenchidos automaticamente.
          </CardDescription>
        </CardHeader>
      </Card>

      <DailyRiskAdminPanel
        eligibleLicenses={eligibleLicenses}
        existingConfigs={existingConfigs}
        preselectedLicenseId={preselectedLicenseId}
      />
    </div>
  );
}
