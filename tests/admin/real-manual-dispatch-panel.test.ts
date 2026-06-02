import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("FirstRealManualDispatchPanel UI", () => {
  const panel = readFileSync(
    path.join(process.cwd(), "components/admin/first-real-manual-dispatch-panel.tsx"),
    "utf8"
  );
  const page = readFileSync(
    path.join(process.cwd(), "app/admin/real-trading/preflights/page.tsx"),
    "utf8"
  );

  it("form contém orderType, stopLoss e takeProfit", () => {
    expect(panel).toContain('data-testid="order-type-select"');
    expect(panel).toContain('data-testid="stop-loss-field"');
    expect(panel).toContain('data-testid="take-profit-field"');
    expect(panel).toContain('data-testid="order-price-field"');
    expect(panel).toContain("Stop Loss");
    expect(panel).toContain("Take Profit");
  });

  it("mensagem quando não há dry-run recente", () => {
    expect(panel).toContain(
      "Nenhum dry-run PASSED recente disponível para dispatch real manual"
    );
    expect(panel).toContain(
      "Execute um novo dry-run PASSED para liberar o formulário"
    );
  });

  it("exibe card de sucesso com links para instruções reais e proteção", () => {
    expect(panel).toContain("REAL_MANUAL_ALREADY_DISPATCHED");
    expect(panel).toContain("/admin/real-trading/instructions/");
    expect(panel).toContain("/admin/real-trading/protection");
    expect(panel).toContain("Abrir em Conta real / Instruções reais");
  });

  it("página separa bloco dry-run e bloco dispatch manual", () => {
    expect(page).toContain("Preflight dry-run (conta real)");
    expect(page).toContain("Criar instruction REAL manual");
    expect(page).toContain("XPMT5-PRD");
    expect(page).not.toContain("XPMTS-PRD");
  });
});
