"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SubscriptionRow = {
  id: string;
  status: string;
  adminPaymentStatus: string;
  planName: string;
  robotCount: number;
  maxRobots: number;
  robots: Array<{
    id: string;
    magicNumber: number | null;
    status: string;
    productName: string;
    licenseId: string | null;
  }>;
  licenses: Array<{
    id: string;
    status: string;
    expectedMagicNumber: number | null;
    mt5: string | null;
    deviceCount: number;
  }>;
};

export function AdminCommercialActions({
  subscriptions,
}: {
  subscriptions: SubscriptionRow[];
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function callAction(subscriptionId: string, action: string) {
    setLoading(`${subscriptionId}:${action}`);
    setMessage(null);
    const res = await fetch(
      `/api/admin/subscriptions/${subscriptionId}/${action}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
    );
    setLoading(null);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setMessage(data.error ?? "Falha na ação.");
      return;
    }
    setMessage("Ação registrada com sucesso.");
    window.location.reload();
  }

  if (subscriptions.length === 0) {
    return (
      <Card className="p-6">
        <CardHeader className="p-0">
          <CardTitle>Comercial</CardTitle>
          <CardDescription>Nenhuma assinatura vinculada.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <CardHeader className="p-0 pb-4">
        <CardTitle>Gestão comercial</CardTitle>
        <CardDescription>
          Pagamento manual, licença e robô — ações auditadas. Sem exposição de secrets.
        </CardDescription>
      </CardHeader>

      {message && <p className="mb-4 text-sm text-gold">{message}</p>}

      <ul className="space-y-6">
        {subscriptions.map((sub) => (
          <li key={sub.id} className="rounded border border-white/10 p-4 space-y-3">
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="font-medium">{sub.planName}</span>
              <span className="text-muted-foreground">·</span>
              <span>{sub.status}</span>
              <span className="text-muted-foreground">·</span>
              <span>Pagamento: {sub.adminPaymentStatus}</span>
              <span className="text-muted-foreground">·</span>
              <span>
                Robôs: {sub.robotCount}/{sub.maxRobots}
              </span>
            </div>

            {sub.robots.length > 0 && (
              <ul className="text-xs text-muted-foreground space-y-1">
                {sub.robots.map((r) => (
                  <li key={r.id}>
                    {r.productName} · magic {r.magicNumber ?? "—"} · {r.status}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                disabled={!!loading}
                onClick={() => callAction(sub.id, "confirm-payment")}
              >
                Marcar pagamento em dia
              </Button>
              <Button
                variant="outline"
                disabled={!!loading}
                onClick={() => callAction(sub.id, "mark-pending")}
              >
                Pagamento pendente
              </Button>
              <Button
                variant="outline"
                disabled={!!loading}
                onClick={() => callAction(sub.id, "suspend")}
              >
                Suspender
              </Button>
              <Button
                variant="outline"
                disabled={!!loading}
                onClick={() => callAction(sub.id, "reactivate")}
              >
                Reativar
              </Button>
              <Button
                variant="outline"
                disabled={!!loading}
                onClick={() => callAction(sub.id, "cancel")}
              >
                Cancelar
              </Button>
              <Button
                variant="outline"
                disabled={!!loading}
                onClick={() => callAction(sub.id, "create-license")}
              >
                Criar licença + robô
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
