/**
 * Fase 12.4 — matriz de dry run (sem ordem real).
 * Valida bloqueios e cenário "todos OK" via mocks — espelha validação staging operacional.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LicenseStatus,
  RealTradePreflightStatus,
  RealTradingApprovalStatus,
  SubscriptionStatus,
  TradeMode,
} from "@prisma/client";
import { evaluateRealTradingGuard } from "@/lib/risk/real-trading-guard";
import { runRealTradePreflight } from "@/lib/risk/real-trade-preflight";
import { REAL_TRADING_REASONS } from "@/lib/risk/real-trading-reasons";
import { isAutoDispatchEnabled } from "@/lib/risk/real-trading-config";
import prisma from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  default: {
    license: { findUnique: vi.fn() },
    subscription: { findUnique: vi.fn() },
    invoice: { findFirst: vi.fn() },
    termsAcceptance: { findFirst: vi.fn() },
    device: { findFirst: vi.fn() },
    realTradingApproval: { findFirst: vi.fn() },
    accountSnapshot: { findFirst: vi.fn(), findUnique: vi.fn() },
    eaHeartbeat: { findFirst: vi.fn() },
    instruction: { findFirst: vi.fn() },
    executionProtectionReport: { findFirst: vi.fn() },
    realTradePreflight: { create: vi.fn() },
  },
}));

const baseInput = {
  userId: "user-homolog",
  licenseId: "lic-homolog-staging",
  accountLogin: "52609973",
  accountServer: "XPMT5-REAL",
  symbol: "WDOM26",
  magicNumber: 910001,
  environment: TradeMode.REAL,
};

function mockAllCriteriaPassing() {
  process.env.ENABLE_REAL_TRADING = "true";
  process.env.REAL_TRADING_ALLOWED_LICENSE_IDS = baseInput.licenseId;

  vi.mocked(prisma.license.findUnique).mockResolvedValue({
    id: baseInput.licenseId,
    userId: baseInput.userId,
    status: LicenseStatus.ACTIVE,
    haltAllTrading: false,
    haltNewEntries: false,
    revokedAt: null,
    subscriptionId: "sub-1",
    mt5Account: {
      login: baseInput.accountLogin,
      server: baseInput.accountServer,
    },
  } as never);

  vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
    status: SubscriptionStatus.ACTIVE,
    plan: { maxMt5Accounts: 4 },
  } as never);

  vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.termsAcceptance.findFirst).mockResolvedValue({ id: "terms-1" } as never);
  vi.mocked(prisma.device.findFirst).mockResolvedValue({ id: "dev-1" } as never);

  vi.mocked(prisma.realTradingApproval.findFirst).mockImplementation(async (args) => {
    const where = args?.where as Record<string, unknown> | undefined;
    if (
      where?.licenseId &&
      typeof where.licenseId === "object" &&
      where.licenseId !== null &&
      "not" in (where.licenseId as object)
    ) {
      return null;
    }
    if (where?.status === RealTradingApprovalStatus.APPROVED) {
      return {
        id: "appr-dry-run",
        symbol: baseInput.symbol,
        magicNumber: baseInput.magicNumber,
        marginBufferPercent: 15,
        minFreeMargin: 5000,
        maxContracts: 1,
        userId: baseInput.userId,
        allowReal: true,
      } as never;
    }
    return null;
  });

  vi.mocked(prisma.accountSnapshot.findFirst).mockResolvedValue({
    id: "snap-pre-market",
    freeMargin: 100000,
  } as never);
  vi.mocked(prisma.accountSnapshot.findUnique).mockResolvedValue({
    id: "snap-pre-market",
    freeMargin: 100000,
  } as never);
  vi.mocked(prisma.eaHeartbeat.findFirst).mockResolvedValue({
    eaStatus: "ONLINE",
    receivedAt: new Date(),
  } as never);
  vi.mocked(prisma.instruction.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.executionProtectionReport.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.realTradePreflight.create).mockResolvedValue({ id: "pf-dry" } as never);
}

describe("Fase 12.4 — Controlled Real Pilot Dry Run (sem ordem real)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ENABLE_REAL_TRADING;
    delete process.env.REAL_TRADING_ALLOWED_LICENSE_IDS;
    delete process.env.ENABLE_AUTO_DISPATCH;
  });

  it("dispatch automático permanece desativado por padrão", () => {
    expect(isAutoDispatchEnabled()).toBe(false);
  });

  it("A) sem ENABLE_REAL_TRADING → BLOCKED", () => {
    const d = evaluateRealTradingGuard({
      tradeMode: TradeMode.REAL,
      licenseId: baseInput.licenseId,
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe(REAL_TRADING_REASONS.ENV_NOT_ENABLED);
  });

  it("B) sem allowlist → BLOCKED", () => {
    process.env.ENABLE_REAL_TRADING = "true";
    const d = evaluateRealTradingGuard({
      tradeMode: TradeMode.REAL,
      licenseId: baseInput.licenseId,
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) {
      expect(d.code).toBe(REAL_TRADING_REASONS.LICENSE_NOT_ALLOWLISTED);
    }
  });

  it("C) sem PRE_MARKET → BLOCKED", async () => {
    mockAllCriteriaPassing();
    vi.mocked(prisma.accountSnapshot.findFirst).mockResolvedValue(null);
    const r = await runRealTradePreflight(baseInput);
    expect(r.passed).toBe(false);
    expect(r.reasonCode).toBe(REAL_TRADING_REASONS.SNAPSHOT_REQUIRED);
  });

  it("D) margem insuficiente → BLOCKED", async () => {
    mockAllCriteriaPassing();
    vi.mocked(prisma.accountSnapshot.findUnique).mockResolvedValue({
      id: "snap-1",
      freeMargin: 50,
    } as never);
    const r = await runRealTradePreflight({
      ...baseInput,
      requiredMargin: 99999,
    });
    expect(r.passed).toBe(false);
    expect(r.reasonCode).toBe(REAL_TRADING_REASONS.MARGIN_INSUFFICIENT);
  });

  it("E) EA offline → BLOCKED", async () => {
    mockAllCriteriaPassing();
    vi.mocked(prisma.eaHeartbeat.findFirst).mockResolvedValue(null);
    const r = await runRealTradePreflight(baseInput);
    expect(r.passed).toBe(false);
    expect(r.reasonCode).toBe(REAL_TRADING_REASONS.EXECUTOR_OFFLINE);
  });

  it("F) magicNumber divergente da aprovação → BLOCKED", async () => {
    mockAllCriteriaPassing();
    const r = await runRealTradePreflight({
      ...baseInput,
      magicNumber: 910099,
    });
    expect(r.passed).toBe(false);
    expect(r.reasonCode).toBe(REAL_TRADING_REASONS.MAGIC_MISMATCH);
  });

  it("G) proteção anterior failed → BLOCKED", async () => {
    mockAllCriteriaPassing();
    vi.mocked(prisma.instruction.findFirst).mockResolvedValue({
      id: "inst-blocked",
      protectionBlocked: true,
    } as never);
    const r = await runRealTradePreflight(baseInput);
    expect(r.passed).toBe(false);
    expect(r.reasonCode).toBe(REAL_TRADING_REASONS.PREVIOUS_PROTECTION_FAILED);
  });

  it("H) todos critérios OK → preflight PASSED (sem implicar ordem real nesta fase)", async () => {
    mockAllCriteriaPassing();
    const r = await runRealTradePreflight({
      ...baseInput,
      requiredMargin: 500,
    });
    expect(r.passed).toBe(true);
    expect(r.status).toBe(RealTradePreflightStatus.PASSED);
    expect(r.reasonCode).toBe(REAL_TRADING_REASONS.ALLOWED_BY_CONTROLLED_GATE);
    // Dry run: EA em DebugMode não envia OrderSend — validação operacional na VPS.
  });
});
