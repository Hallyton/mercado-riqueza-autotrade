"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
        <fieldset className="space-y-2 rounded-lg border border-white/10 p-4 text-sm">
          <legend className="px-1 text-xs font-medium text-muted-foreground">
            Aceites obrigatórios
          </legend>
          <label className="flex gap-2">
            <input type="checkbox" name="acceptTerms" required className="mt-1" />
            <span>Aceito os termos comerciais.</span>
          </label>
          <label className="flex gap-2">
            <input type="checkbox" name="acceptRisk" required className="mt-1" />
            <span>Ciência de risco de mercado.</span>
          </label>
          <label className="flex gap-2">
            <input
              type="checkbox"
              name="acceptNoReturnGuarantee"
              required
              className="mt-1"
            />
            <span>Sem promessa de rentabilidade.</span>
          </label>
          <label className="flex gap-2">
            <input
              type="checkbox"
              name="acceptRealRequiresApproval"
              required
              className="mt-1"
            />
            <span>Conta real depende de aprovação admin.</span>
          </label>
          <label className="flex gap-2">
            <input type="checkbox" name="acceptBlackBox" required className="mt-1" />
            <span>Modelo caixa preta — sem lógica exposta.</span>
          </label>
        </fieldset>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <Button type="submit" disabled={loading}>
          {loading ? "Enviando…" : "Confirmar solicitação — R$ 300,00/mês"}
        </Button>
      </form>
    </Card>
  );
}
