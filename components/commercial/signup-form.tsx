"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CommercialAcceptanceFieldset } from "@/components/commercial/commercial-acceptance-fieldset";

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name")),
      email: String(form.get("email")),
      phone: String(form.get("phone") || "") || undefined,
      password: String(form.get("password")),
      passwordConfirm: String(form.get("passwordConfirm")),
      acceptTerms: form.get("acceptTerms") === "on",
      acceptRisk: form.get("acceptRisk") === "on",
      acceptNoReturnGuarantee: form.get("acceptNoReturnGuarantee") === "on",
      acceptRealRequiresApproval: form.get("acceptRealRequiresApproval") === "on",
      acceptBlackBox: form.get("acceptBlackBox") === "on",
    };

    const res = await fetch("/api/commercial/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setIsLoading(false);

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Não foi possível concluir o cadastro.");
      return;
    }

    router.push("/login?registered=1");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Cadastro AutoTrade</CardTitle>
        <CardDescription>
          Plano Single Robot — R$ 300,00/mês. Pagamento confirmado administrativamente.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit} className="space-y-4 px-6 pb-6">
        <div className="space-y-2">
          <Label htmlFor="name">Nome completo</Label>
          <Input id="name" name="name" required autoComplete="name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone (opcional)</Label>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" name="password" type="password" required minLength={8} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="passwordConfirm">Confirmar senha</Label>
          <Input
            id="passwordConfirm"
            name="passwordConfirm"
            type="password"
            required
            minLength={8}
          />
        </div>

        <CommercialAcceptanceFieldset />

        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Cadastrando…" : "Criar conta e solicitar plano"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Já possui conta?{" "}
          <Link href="/login" className="text-gold hover:underline">
            Entrar
          </Link>
        </p>
      </form>
    </Card>
  );
}
