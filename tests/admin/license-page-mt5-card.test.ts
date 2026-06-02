import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readRepoFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("admin license page — MT5 account card", () => {
  const pageSource = readRepoFile("app/admin/licenses/[licenseId]/page.tsx");
  const cardSource = readRepoFile(
    "components/admin/license-mt5-account-card.tsx"
  );

  it("renderiza LicenseMt5AccountCard sem condicionar a mt5Account", () => {
    expect(pageSource).toContain(
      'import { LicenseMt5AccountCard } from "@/components/admin/license-mt5-account-card"'
    );
    expect(pageSource).toContain("<LicenseMt5AccountCard");
    expect(pageSource).not.toMatch(
      /\{\s*detail\.mt5Account\s*&&\s*<LicenseMt5AccountCard/
    );
    expect(pageSource).not.toMatch(
      /\{\s*license\.mt5Account\s*&&\s*<LicenseMt5AccountCard/
    );
    const mt5CardIndex = pageSource.indexOf("<LicenseMt5AccountCard");
    const modeCardIndex = pageSource.indexOf("<LicenseOperationalModeCard");
    expect(mt5CardIndex).toBeGreaterThan(-1);
    expect(modeCardIndex).toBeGreaterThan(mt5CardIndex);
  });

  it("passa linked=false quando não há mt5Account", () => {
    expect(pageSource).toContain("linked={detail.mt5Linked}");
  });

  it("card mostra botão e estado não vinculado", () => {
    expect(cardSource).toContain("Vincular / editar conta MT5");
    expect(cardSource).toContain("Não vinculada");
    expect(cardSource).toContain(
      "Vincule a conta MT5 antes de gerar o código de ativação"
    );
  });

  it("card exige confirmações DEMO e REAL", () => {
    expect(cardSource).toContain("MT5_ACCOUNT_REAL_CONFIRM_PHRASE");
    expect(cardSource).toContain("MT5_ACCOUNT_DEMO_CONFIRM_PHRASE");
    const libSource = readRepoFile("lib/admin/license-mt5-account.ts");
    expect(libSource).toContain("CONFIGURAR CONTA REAL MT5");
    expect(libSource).toContain("CONFIGURAR CONTA DEMO MT5");
  });

  it("página bloqueia activation code sem mt5Account", () => {
    expect(pageSource).toContain("Boolean(detail.mt5Account)");
    expect(pageSource).toContain(
      "Vincule uma conta MT5 antes de gerar o código."
    );
  });
});
