import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("real manual bulk dispatch panel", () => {
  const panel = readFileSync(
    path.join(process.cwd(), "components/admin/real-manual-bulk-dispatch-panel.tsx"),
    "utf8"
  );
  const page = readFileSync(
    path.join(process.cwd(), "app/admin/real-trading/bulk-dispatch/page.tsx"),
    "utf8"
  );

  it("mostra formulário da ordem e managementPlan", () => {
    expect(panel).toContain("Bloco 1 — Parâmetros da ordem");
    expect(panel).toContain("RealManualManagementPlanFields");
    expect(panel).toContain("Contratos por cliente");
  });

  it("mostra preview, elegíveis, bloqueados e confirmação textual", () => {
    expect(panel).toContain("Validar clientes elegíveis");
    expect(panel).toContain("Clientes elegíveis");
    expect(panel).toContain("Clientes bloqueados / regularizar antes do envio");
    expect(panel).toContain("LiveMarketReadinessCard");
    expect(panel).toContain("LIVE_MARKET_EXECUTE_CHECKLIST_ITEMS");
    expect(panel).toContain("BULK_DISPATCH_LIVE_AWARENESS_PHRASE");
    expect(panel).toContain("Checklist final de envio real");
    expect(panel).toContain("Preview expirado");
    expect(panel).toContain("Revalidar elegibilidade");
  });

  it("página admin descreve fluxo controlado", () => {
    expect(page).toContain("Disparo REAL_MANUAL em lote controlado");
    expect(page).toContain("RealManualBulkDispatchPanel");
  });
});
