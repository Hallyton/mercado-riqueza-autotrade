import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("VoidFalseExecutionActionPanel UI", () => {
  const panel = readFileSync(
    path.join(process.cwd(), "components/admin/void-false-execution-action-panel.tsx"),
    "utf8"
  );
  const page = readFileSync(
    path.join(
      process.cwd(),
      "app/admin/real-trading/instructions/[instructionId]/page.tsx"
    ),
    "utf8"
  );
  const adminPanel = readFileSync(
    path.join(process.cwd(), "components/admin/real-trading-admin-actions-panel.tsx"),
    "utf8"
  );

  it("componente client com botão e formulário", () => {
    expect(panel).toContain('"use client"');
    expect(panel).toContain("Anular falso positivo de execução");
    expect(panel).toContain("void-false-execution-open-button");
    expect(panel).toContain("Confirmar anulação");
    expect(panel).toContain("attest-checked-mt5");
    expect(panel).toContain("Anulando falso positivo de execução");
    expect(panel).toContain("void-false-execution-success");
    expect(panel).toContain("VOID_FALSE_EXECUTION_REASON_CODE");
  });

  it("página importa painel administrativo após proteção", () => {
    expect(page).toContain("RealTradingAdminActionsPanel");
    expect(page).toContain("Ações administrativas");
    expect(page).toContain("admin-actions-card");
    expect(page).toContain("voidEligibility");
    const protectionIdx = page.indexOf("Relatórios de proteção");
    const actionsIdx = page.indexOf("Ações administrativas");
    expect(protectionIdx).toBeGreaterThan(-1);
    expect(actionsIdx).toBeGreaterThan(protectionIdx);
  });

  it("painel agregador inclui void e close", () => {
    expect(adminPanel).toContain("VoidFalseExecutionActionPanel");
    expect(adminPanel).toContain("CloseNoOrderActionPanel");
    expect(adminPanel).toContain("void-false-execution-success");
  });
});
