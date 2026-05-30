import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import {
  COMMERCIAL_TERMS_SECTIONS,
  COMMERCIAL_TERMS_TITLE,
  COMMERCIAL_TERMS_VERSION_NOTICE,
} from "@/lib/commercial/public-terms";

export default function CommercialTermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-white/5 px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <BrandLogo />
          <Link href="/planos" className="text-sm text-gold hover:underline">
            Ver planos
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-gold">
          Mercado da Riqueza AutoTrade
        </p>
        <h1 className="mt-4 text-2xl font-bold text-foreground sm:text-3xl">
          {COMMERCIAL_TERMS_TITLE}
        </h1>

        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {COMMERCIAL_TERMS_VERSION_NOTICE}
        </p>

        <div className="mt-8 space-y-8">
          {COMMERCIAL_TERMS_SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {section.body}
              </p>
            </section>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap gap-4 border-t border-white/10 pt-8">
          <Link
            href="/cadastro"
            className="inline-flex h-10 items-center rounded-lg bg-gold px-5 text-sm font-semibold text-black hover:bg-gold/90"
          >
            Voltar para cadastro
          </Link>
          <Link
            href="/planos"
            className="inline-flex h-10 items-center rounded-lg border border-white/20 px-5 text-sm font-semibold text-foreground hover:bg-white/5"
          >
            Voltar para planos
          </Link>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Rentabilidade passada não garante resultados futuros. Operações envolvem risco de
          perda parcial ou total do capital.
        </p>
      </main>
    </div>
  );
}
