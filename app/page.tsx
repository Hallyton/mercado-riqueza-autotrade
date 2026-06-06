import Link from "next/link";
import { AUTOTRADE_LANDING_PATH } from "@/lib/commercial/autotrade-landing";

/**
 * Landing pública mínima — CTA adicional para página comercial /autotrade.
 */
export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-[#c9a227]">
        Mercado da Riqueza
      </p>
      <h1 className="mt-4 max-w-2xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
        AutoTrade
      </h1>
      <p className="mt-4 max-w-lg text-sm text-zinc-400">
        Execução automatizada MT5 com acompanhamento de resultados. Ferramenta
        tecnológica — não constitui promessa de rentabilidade.
      </p>
      <Link
        href="/login"
        className="mt-8 inline-flex h-11 items-center rounded-lg bg-[#c9a227] px-6 text-sm font-semibold text-black transition hover:bg-[#e4c65b]"
      >
        Acessar plataforma
      </Link>
      <div className="mt-4 flex flex-wrap justify-center gap-4">
        <Link href="/planos" className="text-sm text-[#c9a227] hover:underline">
          Ver planos
        </Link>
        <Link href="/cadastro" className="text-sm text-zinc-400 hover:text-white">
          Cadastrar-se
        </Link>
      </div>

      <section className="mt-12 w-full max-w-lg rounded-xl border border-white/10 bg-white/[0.03] p-6 text-left sm:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">
          Produto
        </p>
        <h2 className="mt-3 text-lg font-semibold text-white sm:text-xl">
          Conheça o Mercado da Riqueza AutoTrade
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Robô MR Fibo D1 Guard com gestão de risco, stop financeiro diário e
          acompanhamento operacional pelo site.
        </p>
        <Link
          href={AUTOTRADE_LANDING_PATH}
          className="mt-5 inline-flex h-10 items-center rounded-lg border border-white/15 px-5 text-sm font-semibold text-white transition hover:border-[#c9a227]/40 hover:bg-white/[0.04]"
        >
          Conhecer AutoTrade
        </Link>
      </section>
    </main>
  );
}
