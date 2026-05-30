import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COMMERCIAL_TERMS_PATH,
  COMMERCIAL_TERMS_SECTIONS,
  PUBLIC_PLANOS_COPY,
  SIGNUP_ACCEPTANCE_LABELS,
} from "@/lib/commercial/public-terms";
import { ROBOT_MONTHLY_PRICE_CENTS } from "@/lib/commercial/constants";

function readRepoFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("página /termos/autotrade", () => {
  const termsPageSource = readRepoFile("app/termos/autotrade/page.tsx");

  it("renderiza conteúdo obrigatório na rota pública", () => {
    expect(COMMERCIAL_TERMS_PATH).toBe("/termos/autotrade");
    expect(termsPageSource).toContain("COMMERCIAL_TERMS_TITLE");
    expect(termsPageSource).toContain("Voltar para cadastro");
    expect(termsPageSource).toContain("Voltar para planos");
    expect(termsPageSource).toContain("COMMERCIAL_TERMS_SECTIONS");
  });

  it("contém aviso de risco e conta real dependente de aprovação", () => {
    const bodies = COMMERCIAL_TERMS_SECTIONS.map((s) => s.body).join(" ");
    expect(bodies).toMatch(/risco/i);
    expect(bodies).toMatch(/aprovação administrativa/i);
    expect(bodies).toMatch(/não há promessa de rentabilidade/i);
    expect(bodies).toMatch(/lucro garantido/i);
  });
});

describe("cadastro — aceite e link de termos", () => {
  const signupSource = readRepoFile("components/commercial/signup-form.tsx");
  const acceptanceSource = readRepoFile(
    "components/commercial/commercial-acceptance-fieldset.tsx"
  );
  const termsLinkSource = readRepoFile("components/commercial/commercial-terms-link.tsx");

  it("possui link para /termos/autotrade", () => {
    expect(COMMERCIAL_TERMS_PATH).toBe("/termos/autotrade");
    expect(termsLinkSource).toContain("COMMERCIAL_TERMS_PATH");
    expect(signupSource).toContain("CommercialAcceptanceFieldset");
    expect(acceptanceSource).toContain("CommercialTermsLink");
  });

  it("mantém aceite de termos obrigatório", () => {
    expect(acceptanceSource).toContain('name="acceptTerms" required');
    expect(SIGNUP_ACCEPTANCE_LABELS.terms).toContain("Termos de Uso Comercial/Beta");
  });
});

describe("página /planos — copy comercial", () => {
  const planosSource = readRepoFile("app/planos/page.tsx");

  it("mostra R$ 300,00 via preço do plano", () => {
    expect(ROBOT_MONTHLY_PRICE_CENTS).toBe(30000);
    expect(planosSource).toContain("PUBLIC_PLANOS_COPY");
    expect(planosSource).toContain("formatMoney(priceCents)");
    expect(PUBLIC_PLANOS_COPY.complement).toContain("R$ 300,00");
  });

  it("não usa caixa preta como mensagem comercial principal", () => {
    expect(planosSource.toLowerCase()).not.toContain("caixa preta");
    expect(PUBLIC_PLANOS_COPY.subtitle.toLowerCase()).not.toContain("caixa preta");
  });

  it("declara ausência de promessa de lucro no bloco de risco", () => {
    expect(PUBLIC_PLANOS_COPY.riskBlock).toMatch(/não há promessa de rentabilidade/i);
    expect(PUBLIC_PLANOS_COPY.riskBlock).toMatch(/lucro garantido/i);
  });

  it("não expõe estratégia interna", () => {
    expect(PUBLIC_PLANOS_COPY.subtitle).toMatch(/protegid/i);
    expect(PUBLIC_PLANOS_COPY.subtitle).not.toMatch(/stop|alvo|filtro|horário/i);
  });
});

describe("interfaces públicas — linguagem institucional", () => {
  const publicFiles = [
    "app/planos/page.tsx",
    "app/termos/autotrade/page.tsx",
    "components/commercial/signup-form.tsx",
    "components/commercial/commercial-acceptance-fieldset.tsx",
    "components/commercial/subscription-request-form.tsx",
    "app/layout.tsx",
  ];

  it("não usa caixa preta nas páginas públicas principais", () => {
    for (const file of publicFiles) {
      const source = readRepoFile(file).toLowerCase();
      expect(source, file).not.toContain("caixa preta");
    }
  });
});
