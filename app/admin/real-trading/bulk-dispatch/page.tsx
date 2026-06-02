import { RealManualBulkDispatchPanel } from "@/components/admin/real-manual-bulk-dispatch-panel";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminRealManualBulkDispatchPage() {
  return (
    <div className="space-y-6">
      <Card className="border-gold/20 p-6">
        <CardHeader className="p-0">
          <CardTitle>Conta real — Disparo REAL_MANUAL em lote controlado</CardTitle>
          <CardDescription className="mt-2">
            Preview obrigatório, seleção manual e confirmação textual forte antes de criar
            instructions individuais. O backend não envia ordem ao broker — o EA busca via API.
          </CardDescription>
        </CardHeader>
      </Card>
      <RealManualBulkDispatchPanel />
    </div>
  );
}
