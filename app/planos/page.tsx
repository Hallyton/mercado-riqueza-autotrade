import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { getPublicCommercialPlan } from "@/lib/commercial/subscription-request";
import {
  MAX_ROBOTS_FUTURE,
  ROBOT_MONTHLY_PRICE_CENTS,
} from "@/lib/commercial/constants";
import { PUBLIC_PLANOS_COPY } from "@/lib/commercial/public-terms";

export const dynamic = "force-dynamic";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export default async function PlanosPage() {
  const plan = await getPublicCommercialPlan();
  const priceCents = plan?.monthlyPriceCents ?? ROBOT_MONTHLY_PRICE_CENTS;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-white/5 px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <BrandLogo />
          <Link href="/login" className="text-sm text-gold hover:underline">
            Entrar no portal
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-gold">
          Mercado da Riqueza AutoTrade
        </p>
        <h1 className="mt-4 text-3xl font-bold text-foreground sm:text-4xl">
          {plan?.name ?? "AutoTrade Single Robot"}
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">{PUBLIC_PLANOS_COPY.subtitle}</p>
        <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
          {PUBLIC_PLANOS_COPY.complement}
        </p>

        <div className="mt-10 rounded-xl border border-gold/30 bg-gold/5 p-8">
          <p className="text-4xl font-bold text-gold">{formatMoney(priceCents)}</p>
          <p className="mt-1 text-sm text-muted-foreground">por robô / mês</p>
          <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
            <li>• Plano inicial: <strong className="text-foreground">1 robô</strong></li>
            <li>
              • Estrutura futura: até{" "}
              <strong className="text-foreground">{MAX_ROBOTS_FUTURE} robôs</strong> (
              {formatMoney(priceCents)} × quantidade)
            </li>
            <li>• Operação sujeita a licença ativa, device, margem, preflight e proteção</li>
            <li>• Conta real depende de aprovação administrativa — pagamento não libera real</li>
          </ul>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/cadastro"
              className="inline-flex h-11 items-center rounded-lg bg-gold px-6 text-sm font-semibold text-black hover:bg-gold/90"
            >
              Solicitar assinatura
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center rounded-lg border border-white/20 px-6 text-sm font-semibold text-foreground hover:bg-white/5"
            >
              Entrar no portal
            </Link>
          </div>
        </div>

        <section className="mt-10 rounded-xl border border-white/10 bg-white/[0.02] p-8">
          <h2 className="text-xl font-semibold text-foreground">
            AutoTrade — MR Fibo D1 Guard
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Estratégia automatizada para Mini Dólar com gestão de risco, controle
            operacional e avaliação prévia.
          </p>
          <Link
            href="/autotrade"
            className="mt-6 inline-flex h-10 items-center rounded-lg border border-gold/30 px-5 text-sm font-semibold text-gold transition hover:bg-gold/10"
          >
            Ver detalhes
          </Link>
        </section>

        <section className="mt-12 space-y-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-6">
          <h2 className="text-lg font-semibold text-amber-200">Avisos de risco</h2>
          <p className="text-sm text-muted-foreground">{PUBLIC_PLANOS_COPY.riskBlock}</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Rentabilidade passada não garante resultados futuros.</li>
            <li>
              Ferramenta tecnológica de execução automatizada — sujeita a falhas de conexão,
              broker ou mercado.
            </li>
            <li>
              O cliente não terá acesso à estratégia, regras de entrada/saída ou parâmetros
              internos — lógica interna protegida como propriedade intelectual do Mercado da
              Riqueza.
            </li>
          </ul>
        </section>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Mercado da Riqueza AutoTrade — plataforma institucional. Sem exposição de estratégia.
        </p>
      </main>
    </div>
  );
}
