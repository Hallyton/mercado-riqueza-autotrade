"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type PlanOption = { slug: string; name: string };

export function CreateUserForm({ plans }: { plans: PlanOption[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("CLIENT");
  const [planSlug, setPlanSlug] = useState(plans[0]?.slug ?? "");
  const [createSubscription, setCreateSubscription] = useState(false);
  const [generatePassword, setGeneratePassword] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setTempPassword(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          role,
          generate_password: generatePassword,
          must_change_password: true,
          plan_slug: createSubscription ? planSlug : undefined,
          create_subscription: createSubscription,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Falha ao criar usuário.");
        return;
      }
      if (data.temporary_password) {
        setTempPassword(data.temporary_password);
      }
      setCreatedUserId(data.user?.id ?? null);
    } catch {
      setError("Erro de rede.");
    } finally {
      setBusy(false);
    }
  }

  if (createdUserId && !tempPassword) {
    router.push(`/admin/users/${createdUserId}`);
    return null;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-lg">
      <label className="block text-sm">
        <span className="text-muted-foreground">Nome</span>
        <input
          required
          className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="text-muted-foreground">E-mail</span>
        <input
          required
          type="email"
          className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="text-muted-foreground">Perfil</span>
        <select
          className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="CLIENT">Cliente</option>
          <option value="SUPPORT">Admin — Suporte</option>
          <option value="OPS">Admin — Operações</option>
          <option value="FINANCE">Admin — Financeiro</option>
          <option value="SUPERADMIN">Superadmin</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={generatePassword}
          onChange={(e) => setGeneratePassword(e.target.checked)}
        />
        Gerar senha temporária automaticamente
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={createSubscription}
          onChange={(e) => setCreateSubscription(e.target.checked)}
        />
        Criar assinatura e licença
      </label>
      {createSubscription && (
        <label className="block text-sm">
          <span className="text-muted-foreground">Plano</span>
          <select
            className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2"
            value={planSlug}
            onChange={(e) => setPlanSlug(e.target.value)}
          >
            {plans.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name} ({p.slug})
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
      >
        {busy ? "Criando…" : "Criar usuário"}
      </button>
      {error && <p className="text-sm text-red-300">{error}</p>}
      {tempPassword && createdUserId && (
        <div className="rounded border border-gold/40 p-4 space-y-2">
          <p className="text-sm text-gold font-medium">Usuário criado — senha temporária</p>
          <p className="font-mono text-lg select-all">{tempPassword}</p>
          <p className="text-xs text-muted-foreground">
            Não será exibida novamente. Copie antes de continuar.
          </p>
          <button
            type="button"
            className="text-sm text-gold hover:underline"
            onClick={() => router.push(`/admin/users/${createdUserId}`)}
          >
            Ir para detalhes do usuário →
          </button>
        </div>
      )}
    </form>
  );
}
