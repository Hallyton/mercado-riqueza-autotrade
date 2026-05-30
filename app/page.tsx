import Link from "next/link";

/**
 * Landing pública mínima — não alterar sem necessidade de produto/marketing.
 */
export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
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
    </main>
  );
}
