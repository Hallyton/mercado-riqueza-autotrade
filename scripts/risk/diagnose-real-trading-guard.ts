import { TradeMode } from "@prisma/client";
import {
  evaluateRealTradingGuard,
  type RealTradingGuardDecision,
  type RealTradingGuardInput,
} from "@/lib/risk/real-trading-guard";
import { REAL_TRADING_REASONS } from "@/lib/risk/real-trading-reasons";

type DiagnosticEnv = Record<string, string | undefined>;

type DiagnosticScenario = {
  name: string;
  input: RealTradingGuardInput;
  env: DiagnosticEnv;
  expected: {
    allowed: boolean;
    code?: string;
  };
  note?: string;
};

type DiagnosticResult = {
  name: string;
  input: Record<string, string | null>;
  allowed: boolean;
  code: string | null;
  reason: string | null;
  status: "PASS" | "FAIL";
  note?: string;
};

export const REAL_TRADING_GUARD_DIAGNOSTIC_SCENARIOS: DiagnosticScenario[] = [
  {
    name: "A) DEMO sem env",
    input: { tradeMode: TradeMode.DEMO, licenseId: "diagnostic-license-demo" },
    env: {},
    expected: { allowed: true },
  },
  {
    name: "B) REAL sem env",
    input: { tradeMode: TradeMode.REAL, licenseId: "diagnostic-license-real" },
    env: {},
    expected: { allowed: false, code: REAL_TRADING_REASONS.ENV_NOT_ENABLED },
  },
  {
    name: "C) REAL com ENABLE_REAL_TRADING=false",
    input: { tradeMode: TradeMode.REAL, licenseId: "diagnostic-license-real" },
    env: { ENABLE_REAL_TRADING: "false" },
    expected: { allowed: false, code: REAL_TRADING_REASONS.ENV_NOT_ENABLED },
  },
  {
    name: "D) REAL com ENABLE_REAL_TRADING=true sem approval (sync)",
    input: { tradeMode: TradeMode.REAL, licenseId: "diagnostic-license-real" },
    env: { ENABLE_REAL_TRADING: "true" },
    expected: { allowed: false, code: REAL_TRADING_REASONS.APPROVAL_REQUIRED },
    note: "Camada sync: master switch on não libera sem RealTradingApproval.",
  },
  {
    name: "E) REAL com allowlist env sem approval (sync)",
    input: { tradeMode: TradeMode.REAL, licenseId: "diagnostic-license-real" },
    env: {
      ENABLE_REAL_TRADING: "true",
      REAL_TRADING_ALLOWED_LICENSE_IDS: "other-diagnostic-license",
    },
    expected: { allowed: false, code: REAL_TRADING_REASONS.APPROVAL_REQUIRED },
    note: "Allowlist env sozinha não substitui approval manual.",
  },
  {
    name: "F) REAL com allowlist contendo a licença (sync)",
    input: { tradeMode: TradeMode.REAL, licenseId: "diagnostic-license-real" },
    env: {
      ENABLE_REAL_TRADING: "true",
      REAL_TRADING_ALLOWED_LICENSE_IDS: "diagnostic-license-real",
    },
    expected: { allowed: false, code: REAL_TRADING_REASONS.APPROVAL_REQUIRED },
    note:
      "Allowlist env + master switch ainda exige approval no banco (camada async/preflight).",
  },
  {
    name: "G) tradeMode ausente",
    input: { tradeMode: undefined, licenseId: "diagnostic-license-unknown" },
    env: {},
    expected: { allowed: true },
    note:
      "Comportamento atual: o guard bloqueia apenas REAL explícito; ausência de tradeMode não libera operação real.",
  },
  {
    name: "G2) tradeMode desconhecido",
    input: { tradeMode: "UNKNOWN", licenseId: "diagnostic-license-unknown" },
    env: {},
    expected: { allowed: true },
    note:
      "Comportamento atual: valor desconhecido não é tratado como REAL; deve ser acompanhado por validações de contrato/heartbeat.",
  },
];

function redactInput(input: RealTradingGuardInput): Record<string, string | null> {
  return {
    tradeMode: input.tradeMode ? String(input.tradeMode) : null,
    licenseId: input.licenseId,
  };
}

function decisionCode(decision: RealTradingGuardDecision): string | null {
  return decision.allowed ? null : decision.code;
}

function decisionReason(decision: RealTradingGuardDecision): string | null {
  return decision.allowed ? null : decision.reason;
}

export function runRealTradingGuardDiagnostics(
  scenarios = REAL_TRADING_GUARD_DIAGNOSTIC_SCENARIOS
): DiagnosticResult[] {
  return scenarios.map((scenario) => {
    const decision = evaluateRealTradingGuard(scenario.input, scenario.env);
    const code = decisionCode(decision);
    const pass =
      decision.allowed === scenario.expected.allowed &&
      (scenario.expected.code === undefined || code === scenario.expected.code);

    return {
      name: scenario.name,
      input: redactInput(scenario.input),
      allowed: decision.allowed,
      code,
      reason: decisionReason(decision),
      status: pass ? "PASS" : "FAIL",
      ...(scenario.note ? { note: scenario.note } : {}),
    };
  });
}

function printReport(results: DiagnosticResult[]): void {
  console.log("=== Real Trading Guard Diagnostic Harness ===");
  console.log("Modo: local, puro, sem banco, sem secrets e sem env real.\n");

  for (const result of results) {
    console.log(`Cenário: ${result.name}`);
    console.log(`Input: ${JSON.stringify(result.input)}`);
    console.log(`allowed: ${result.allowed}`);
    console.log(`code: ${result.code ?? "-"}`);
    console.log(`reason: ${result.reason ?? "-"}`);
    if (result.note) console.log(`observação: ${result.note}`);
    console.log(`status: ${result.status}`);
    console.log("---");
  }

  const failed = results.filter((result) => result.status === "FAIL");
  console.log(`Resumo: ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length > 0) {
    console.log(`Falhas: ${failed.map((result) => result.name).join(", ")}`);
  }
}

const isMain = process.argv[1]?.replace(/\\/g, "/").endsWith(
  "scripts/risk/diagnose-real-trading-guard.ts"
);

if (isMain) {
  const results = runRealTradingGuardDiagnostics();
  printReport(results);

  if (results.some((result) => result.status === "FAIL")) {
    process.exit(1);
  }
}
