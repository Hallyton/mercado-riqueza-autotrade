import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("RealManualCloseNoOrderPanel UI", () => {
  const panel = readFileSync(
    path.join(process.cwd(), "components/admin/real-manual-close-no-order-panel.tsx"),
    "utf8"
  );
  const detailPage = readFileSync(
    path.join(
      process.cwd(),
      "app/admin/real-trading/instructions/[instructionId]/page.tsx"
    ),
    "utf8"
  );

  it("formulário com atestação manual e confirmação", () => {
    expect(panel).toContain("Encerrar sem ordem apregoada");
    expect(panel).toContain("CLOSE_NO_ORDER_REASON_CODE");
    expect(panel).toContain("CLOSE_NO_ORDER_CONFIRM_PHRASE");
    expect(panel).toContain("attest-no-pending-order");
    expect(panel).toContain("attest-no-open-position");
    expect(panel).toContain("attest-no-risk-exposure");
    expect(panel).toContain("attest-requires-new-preflight");
    expect(panel).toContain("operatorAttestation");
  });

  it("página de detalhe inclui Ações administrativas e painel", () => {
    expect(detailPage).toContain("Ações administrativas");
    expect(detailPage).toContain("RealManualCloseNoOrderPanel");
    expect(detailPage).toContain("canShowClosePanel");
  });
});
