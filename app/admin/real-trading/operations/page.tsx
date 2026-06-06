import { RealTradingOperationsPanel } from "@/components/admin/real-trading-operations-panel";
import { getRealTradingOperationCenterView } from "@/lib/admin/real-trading-operation-center";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminRealTradingOperationsPage() {
  const view = await getRealTradingOperationCenterView();

  return (
    <div className="space-y-6">
      <Card className="border-gold/20 p-6">
        <CardHeader className="p-0">
          <CardTitle>Centro de Operações — Conta Real</CardTitle>
          <CardDescription className="mt-2">
            Acompanhe EAs MR Fibo D1 Guard em tempo operacional e envie comandos
            administrativos seguros. Comandos exigem confirmação textual e audit trail
            completo.
          </CardDescription>
        </CardHeader>
      </Card>

      <RealTradingOperationsPanel summary={view.summary} rows={view.rows} />
    </div>
  );
}
