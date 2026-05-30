"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CommercialAcceptanceFieldset } from "@/components/commercial/commercial-acceptance-fieldset";

export function SubscriptionRequestForm({
  hasSubscription,
  termsAccepted,
}: {
  hasSubscription: boolean;
  termsAccepted: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      acceptTerms: form.get("acceptTerms") === "on",
      acceptRisk: form.get("acceptRisk") === "on",
      acceptNoReturnGuarantee: form.get("acceptNoReturnGuarantee") === "on",
      acceptRealRequiresApproval: form.get("acceptRealRequiresApproval") === "on",
      acceptBlackBox: form.get("acceptBlackBox") === "on",
    };

    const res = await fetch("/api/me/subscription/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Falha ao solicitar assinatura.");
      return;
    }

    setSuccess(true);
    window.location.reload();
  }

  if (success) {
    return (
      <p className="text-sm text-emerald-400">
        Solicitação registrada. Aguarde confirmação administrativa do pagamento.
      </p>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Solicitar assinatura</CardTitle>
        <CardDescription>
          AutoTrade Single Robot — R$ 300,00/mês · 1 robô. Pagamento confirmado pelo admin.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit} className="space-y-4 px-6 pb-6">
        <CommercialAcceptanceFieldset />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <Button type="submit" disabled={loading}>
          {loading ? "Enviando…" : "Confirmar solicitação — R$ 300,00/mês"}
        </Button>
      </form>
    </Card>
  );
}
