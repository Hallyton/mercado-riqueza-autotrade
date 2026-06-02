import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("CloseNoOrderActionPanel UI", () => {
  const panel = readFileSync(
    path.join(process.cwd(), "components/admin/close-no-order-action-panel.tsx"),
    "utf8"
  );
  const page = readFileSync(
    path.join(
      process.cwd(),
      "app/admin/real-trading/instructions/[instructionId]/page.tsx"
    ),
    "utf8"
  );

  it("componente client com botão e formulário", () => {
    expect(panel).toContain('"use client"');
    expect(panel).toContain("Encerrar sem ordem apregoada");
    expect(panel).toContain("close-no-order-open-button");
    expect(panel).toContain("Confirmar encerramento");
    expect(panel).toContain("attest-no-pending-order");
    expect(panel).toContain("Encerrando instruction");
    expect(panel).toContain("close-no-order-error");
  });

  it("página importa e renderiza CloseNoOrderActionPanel após proteção", () => {
    expect(page).toContain("CloseNoOrderActionPanel");
    expect(page).toContain("Ações administrativas");
    expect(page).toContain("admin-actions-card");
    expect(page).toContain("canCloseNoOrder");
    const protectionIdx = page.indexOf("Relatórios de proteção");
    const actionsIdx = page.indexOf("Ações administrativas");
    expect(protectionIdx).toBeGreaterThan(-1);
    expect(actionsIdx).toBeGreaterThan(protectionIdx);
  });
});
