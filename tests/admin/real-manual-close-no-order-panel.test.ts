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

  it("formulário com confirmação e reason code fixo", () => {
    expect(panel).toContain("Encerrar sem ordem apregoada");
    expect(panel).toContain("CLOSE_NO_ORDER_REASON_CODE");
    expect(panel).toContain("CLOSE_NO_ORDER_CONFIRM_PHRASE");
    expect(panel).toContain("close-no-order");
  });

  it("página de detalhe inclui Ações administrativas", () => {
    expect(detailPage).toContain("Ações administrativas");
    expect(detailPage).toContain("RealManualCloseNoOrderPanel");
  });
});
