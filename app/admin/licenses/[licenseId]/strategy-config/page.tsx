import Link from "next/link";
import { notFound } from "next/navigation";
import { LicenseStrategyConfigForm } from "@/components/admin/license-strategy-config-form";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getStrategyConfigAdminView } from "@/lib/admin/strategy-runtime-config";

type PageProps = { params: Promise<{ licenseId: string }> };

export default async function AdminLicenseStrategyConfigPage({ params }: PageProps) {
  const { licenseId } = await params;
  let view;
  try {
    view = await getStrategyConfigAdminView(licenseId);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/licenses/${licenseId}`}
        className="text-sm text-gold hover:underline"
      >
        ← Voltar à licença
      </Link>

      <Card className="border-gold/20 p-6">
        <CardHeader className="p-0">
          <CardTitle>Parâmetros — {view.strategyName}</CardTitle>
          <CardDescription className="mt-2">
            Configuração operacional estilo inputs do EA, versionada e entregue ao
            Executor via API. Área exclusiva admin — caixa preta para o cliente.
          </CardDescription>
        </CardHeader>
      </Card>

      <LicenseStrategyConfigForm view={view} />
    </div>
  );
}
