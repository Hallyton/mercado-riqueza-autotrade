import { existsSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { InstructionSource } from "@prisma/client";
import { REAL_TRADING_INSTRUCTION_SOURCES } from "@/lib/admin/real-trading-instructions";

const ROOT = process.cwd();

describe("admin real-trading instructions routes", () => {
  const listPage = path.join(
    ROOT,
    "app/admin/real-trading/instructions/page.tsx"
  );
  const detailPage = path.join(
    ROOT,
    "app/admin/real-trading/instructions/[instructionId]/page.tsx"
  );
  const apiRoute = path.join(
    ROOT,
    "app/api/admin/real-trading/instructions/route.ts"
  );
  const adminShell = path.join(ROOT, "components/layout/admin-shell.tsx");
  const instrucoesPage = path.join(ROOT, "app/admin/instrucoes/page.tsx");
  const dispatchPanel = path.join(
    ROOT,
    "components/admin/first-real-manual-dispatch-panel.tsx"
  );
  const lib = path.join(ROOT, "lib/admin/real-trading-instructions.ts");

  it("páginas e API existem no app router", () => {
    expect(existsSync(listPage)).toBe(true);
    expect(existsSync(detailPage)).toBe(true);
    expect(existsSync(apiRoute)).toBe(true);
  });

  it("lista usa listRealTradingInstructionsAdmin (REAL_MANUAL)", () => {
    const source = readFileSync(listPage, "utf8");
    expect(source).toContain("listRealTradingInstructionsAdmin");
    expect(source).not.toContain("listAdminDispatchedInstructions");
    expect(source).toContain("REAL_MANUAL");
  });

  it("lib filtra apenas REAL_MANUAL, não TEST/HOMOLOGATION", () => {
    const source = readFileSync(lib, "utf8");
    expect(source).toContain("InstructionSource.REAL_MANUAL");
    expect(source).toContain("REAL_TRADING_INSTRUCTION_SOURCES");
    expect(source).not.toMatch(/InstructionSource\.TEST/);
    expect(source).not.toMatch(/InstructionSource\.HOMOLOGATION/);
  });

  it("menu lateral aponta para /admin/real-trading/instructions", () => {
    const source = readFileSync(adminShell, "utf8");
    expect(source).toContain('href: "/admin/real-trading/instructions"');
    expect(source).toContain("Conta real / Instruções reais");
  });

  it("/admin/instrucoes avisa que REAL_MANUAL não aparece na fila", () => {
    const source = readFileSync(instrucoesPage, "utf8");
    expect(source).toContain("REAL_MANUAL");
    expect(source).toContain("/admin/real-trading/instructions");
    expect(source).toMatch(/não aparecem aqui|não aparece nesta fila/i);
  });

  it("pós-criação REAL_MANUAL linka instruções reais, não /admin/instrucoes", () => {
    const source = readFileSync(dispatchPanel, "utf8");
    expect(source).toContain("/admin/real-trading/instructions/");
    expect(source).not.toMatch(/href=.*\/admin\/instrucoes/);
  });

  it("detalhe usa getRealTradingInstructionAdminDetail", () => {
    const source = readFileSync(detailPage, "utf8");
    expect(source).toContain("getRealTradingInstructionAdminDetail");
    expect(source).toContain("redactedPayload");
  });

  it("middleware bloqueia CLIENT em /admin", () => {
    const source = readFileSync(path.join(ROOT, "middleware.ts"), "utf8");
    expect(source).toContain('pathname.startsWith("/admin")');
    expect(source).toContain('appRole !== "ADMIN"');
  });

  it("REAL_TRADING_INSTRUCTION_SOURCES exclui TEST e HOMOLOGATION", () => {
    expect(REAL_TRADING_INSTRUCTION_SOURCES).toEqual([
      InstructionSource.REAL_MANUAL,
    ]);
  });
});
