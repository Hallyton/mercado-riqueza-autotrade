import { beforeEach, describe, expect, it, vi } from "vitest";
import { TradeMode } from "@prisma/client";
import {
  evaluateRealTradingGuard,
  evaluateRealTradingGuardAsync,
  isLicenseAllowedForRealTrading,
  isRealTradingEnabled,
} from "@/lib/risk/real-trading-guard";
import { REAL_TRADING_REASONS } from "@/lib/risk/real-trading-reasons";
import {
  REAL_TRADING_GUARD_DIAGNOSTIC_SCENARIOS,
  runRealTradingGuardDiagnostics,
} from "@/scripts/risk/diagnose-real-trading-guard";

vi.mock("@/lib/prisma", () => ({
  default: {
    realTradingApproval: { findFirst: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";

const baseCtx = {
  tradeMode: TradeMode.REAL,
  licenseId: "lic-1",
  userId: "user-1",
  accountLogin: "12345678",
  accountServer: "XPMT5-REAL",
  symbol: "WDOM26",
  magicNumber: 910001,
  requestedContracts: 1,
};

describe("Real Trading Guard — sync", () => {
  it("bloqueia REAL por padrão quando ENABLE_REAL_TRADING está ausente", () => {
    const decision = evaluateRealTradingGuard(
      { tradeMode: TradeMode.REAL, licenseId: "lic-1" },
      {}
    );

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.code).toBe(REAL_TRADING_REASONS.ENV_NOT_ENABLED);
    }
  });

  it("permite DEMO sem feature flag", () => {
    const decision = evaluateRealTradingGuard(
      { tradeMode: TradeMode.DEMO, licenseId: "lic-1" },
      {}
    );

    expect(decision.allowed).toBe(true);
  });

  it("master switch on sem approval bloqueia na camada sync", () => {
    const decision = evaluateRealTradingGuard(
      { tradeMode: TradeMode.REAL, licenseId: "lic-out" },
      { ENABLE_REAL_TRADING: "true", REAL_TRADING_ALLOWED_LICENSE_IDS: "lic-in" }
    );

    expect(isRealTradingEnabled({ ENABLE_REAL_TRADING: "true" })).toBe(true);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.code).toBe(REAL_TRADING_REASONS.APPROVAL_REQUIRED);
    }
  });

  it("allowlist env não libera REAL sozinha (sync)", () => {
    const env = {
      ENABLE_REAL_TRADING: "true",
      REAL_TRADING_ALLOWED_LICENSE_IDS: "lic-a, lic-b",
    };
    const decision = evaluateRealTradingGuard(
      { tradeMode: TradeMode.REAL, licenseId: "lic-b" },
      env
    );

    expect(isLicenseAllowedForRealTrading("lic-b", env)).toBe(true);
    expect(decision.allowed).toBe(false);
  });

  it("harness diagnóstico cobre todos os cenários obrigatórios sem falhas", () => {
    const results = runRealTradingGuardDiagnostics();

    expect(results).toHaveLength(REAL_TRADING_GUARD_DIAGNOSTIC_SCENARIOS.length);
    expect(results.every((result) => result.status === "PASS")).toBe(true);
  });
});

describe("Real Trading Guard — async", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ENABLE_REAL_TRADING=false bloqueia mesmo com approval no banco", async () => {
    vi.mocked(prisma.realTradingApproval.findFirst).mockResolvedValue({
      id: "appr-1",
      status: "APPROVED",
      allowReal: true,
      accountLogin: baseCtx.accountLogin,
      accountServer: baseCtx.accountServer,
      symbol: "WDOM26",
      magicNumber: 910001,
      maxContracts: 1,
    } as never);

    const decision = await evaluateRealTradingGuardAsync(baseCtx, {});
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.code).toBe(REAL_TRADING_REASONS.ENV_NOT_ENABLED);
    }
  });

  it("ENABLE_REAL_TRADING=true sem approval bloqueia", async () => {
    vi.mocked(prisma.realTradingApproval.findFirst).mockResolvedValue(null);

    const decision = await evaluateRealTradingGuardAsync(baseCtx, {
      ENABLE_REAL_TRADING: "true",
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.code).toBe(REAL_TRADING_REASONS.APPROVAL_REQUIRED);
    }
  });

  it("ENABLE_REAL_TRADING=true com approval APPROVED permite seguir", async () => {
    vi.mocked(prisma.realTradingApproval.findFirst).mockResolvedValue({
      id: "appr-1",
      status: "APPROVED",
      allowReal: true,
      accountLogin: baseCtx.accountLogin,
      accountServer: baseCtx.accountServer,
      symbol: "WDOM26",
      magicNumber: 910001,
      maxContracts: 1,
    } as never);

    const decision = await evaluateRealTradingGuardAsync(baseCtx, {
      ENABLE_REAL_TRADING: "true",
    });
    expect(decision.allowed).toBe(true);
    if (decision.allowed) {
      expect(decision.code).toBe(REAL_TRADING_REASONS.ALLOWED_BY_MANUAL_APPROVAL);
    }
  });

  it("account mismatch bloqueia", async () => {
    vi.mocked(prisma.realTradingApproval.findFirst).mockResolvedValue({
      id: "appr-1",
      status: "APPROVED",
      allowReal: true,
      accountLogin: "other-login",
      accountServer: baseCtx.accountServer,
      symbol: "WDOM26",
      magicNumber: 910001,
      maxContracts: 1,
    } as never);

    const decision = await evaluateRealTradingGuardAsync(baseCtx, {
      ENABLE_REAL_TRADING: "true",
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.code).toBe(REAL_TRADING_REASONS.ACCOUNT_MISMATCH);
    }
  });

  it("approval APPROVED + allowlist env vazia permite", async () => {
    vi.mocked(prisma.realTradingApproval.findFirst).mockResolvedValue({
      id: "appr-1",
      status: "APPROVED",
      allowReal: true,
      accountLogin: baseCtx.accountLogin,
      accountServer: baseCtx.accountServer,
      symbol: "WDOM26",
      magicNumber: 910001,
      maxContracts: 1,
    } as never);

    const decision = await evaluateRealTradingGuardAsync(baseCtx, {
      ENABLE_REAL_TRADING: "true",
    });
    expect(decision.allowed).toBe(true);
    if (decision.allowed) {
      expect(decision.code).toBe(REAL_TRADING_REASONS.ALLOWED_BY_MANUAL_APPROVAL);
    }
  });

  it("approval APPROVED + allowlist contém licença permite", async () => {
    vi.mocked(prisma.realTradingApproval.findFirst).mockResolvedValue({
      id: "appr-1",
      status: "APPROVED",
      allowReal: true,
      accountLogin: baseCtx.accountLogin,
      accountServer: baseCtx.accountServer,
      symbol: "WDOM26",
      magicNumber: 910001,
      maxContracts: 1,
    } as never);

    const decision = await evaluateRealTradingGuardAsync(baseCtx, {
      ENABLE_REAL_TRADING: "true",
      REAL_TRADING_ALLOWED_LICENSE_IDS: "lic-1,other",
    });
    expect(decision.allowed).toBe(true);
  });

  it("approval APPROVED + allowlist sem a licença bloqueia", async () => {
    vi.mocked(prisma.realTradingApproval.findFirst).mockResolvedValue({
      id: "appr-1",
      status: "APPROVED",
      allowReal: true,
      accountLogin: baseCtx.accountLogin,
      accountServer: baseCtx.accountServer,
      symbol: "WDOM26",
      magicNumber: 910001,
      maxContracts: 1,
    } as never);

    const decision = await evaluateRealTradingGuardAsync(baseCtx, {
      ENABLE_REAL_TRADING: "true",
      REAL_TRADING_ALLOWED_LICENSE_IDS: "other-license-only",
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.code).toBe(
        REAL_TRADING_REASONS.LICENSE_NOT_IN_ENV_ALLOWLIST
      );
    }
  });

  it("maxContracts excedido bloqueia", async () => {
    vi.mocked(prisma.realTradingApproval.findFirst).mockResolvedValue({
      id: "appr-1",
      status: "APPROVED",
      allowReal: true,
      accountLogin: baseCtx.accountLogin,
      accountServer: baseCtx.accountServer,
      symbol: "WDOM26",
      magicNumber: 910001,
      maxContracts: 1,
    } as never);

    const decision = await evaluateRealTradingGuardAsync(
      { ...baseCtx, requestedContracts: 2 },
      { ENABLE_REAL_TRADING: "true" }
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.code).toBe(REAL_TRADING_REASONS.CONTRACT_LIMIT_EXCEEDED);
    }
  });
});
