import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LicenseStatus,
  RealTradePreflightStatus,
  RealTradingApprovalStatus,
  SubscriptionStatus,
  TradeMode,
} from "@prisma/client";
import { REAL_TRADING_REASONS } from "@/lib/risk/real-trading-reasons";

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

import prisma from "@/lib/prisma";
import { evaluateRealTradingGuard } from "@/lib/risk/real-trading-guard";
import { runRealTradePreflight } from "@/lib/risk/real-trade-preflight";
import { InstructionPurpose } from "@prisma/client";
import { mapInstructionToEaPayloadForReal } from "@/lib/ea/instructions";
import { Decimal } from "@prisma/client/runtime/library";

const baseInput = {
  userId: "user-1",
  licenseId: "lic-1",
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
  vi.mocked(prisma.termsAcceptance.findFirst).mockResolvedValue({
    id: "terms-1",
  } as never);
  vi.mocked(prisma.device.findFirst).mockResolvedValue({ id: "dev-1" } as never);

  vi.mocked(prisma.realTradingApproval.findFirst).mockImplementation(
    async (args) => {
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
          id: "appr-1",
          symbol: "WDOM26",
          magicNumber: 910001,
          marginBufferPercent: 10,
          minFreeMargin: 1000,
          maxContracts: 2,
          userId: baseInput.userId,
        } as never;
      }
      return null;
    }
  );

  vi.mocked(prisma.accountSnapshot.findFirst).mockResolvedValue({
    id: "snap-1",
    freeMargin: 50000,
  } as never);
  vi.mocked(prisma.accountSnapshot.findUnique).mockResolvedValue({
    id: "snap-1",
    freeMargin: 50000,
  } as never);
  vi.mocked(prisma.eaHeartbeat.findFirst).mockResolvedValue({
    eaStatus: "ONLINE",
    receivedAt: new Date(),
  } as never);
  vi.mocked(prisma.instruction.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.executionProtectionReport.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.realTradePreflight.create).mockResolvedValue({ id: "pf-ok" } as never);
}

describe("Conditional Real Trading Gate — cenários obrigatórios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ENABLE_REAL_TRADING;
    delete process.env.REAL_TRADING_ALLOWED_LICENSE_IDS;
  });

  it("1) bloqueia se ENABLE_REAL_TRADING=false", () => {
    const d = evaluateRealTradingGuard({
      tradeMode: TradeMode.REAL,
      licenseId: "lic-1",
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe(REAL_TRADING_REASONS.ENV_NOT_ENABLED);
  });

  it("2) bloqueia se license fora da allowlist", () => {
    process.env.ENABLE_REAL_TRADING = "true";
    process.env.REAL_TRADING_ALLOWED_LICENSE_IDS = "other";
    const d = evaluateRealTradingGuard({
      tradeMode: TradeMode.REAL,
      licenseId: "lic-1",
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) {
      expect(d.code).toBe(REAL_TRADING_REASONS.LICENSE_NOT_ALLOWLISTED);
    }
  });

  it("3) bloqueia sem RealTradingApproval", async () => {
    process.env.ENABLE_REAL_TRADING = "true";
    process.env.REAL_TRADING_ALLOWED_LICENSE_IDS = baseInput.licenseId;
    vi.mocked(prisma.license.findUnique).mockResolvedValue({
      userId: baseInput.userId,
      status: LicenseStatus.ACTIVE,
      haltAllTrading: false,
      revokedAt: null,
      subscriptionId: "sub-1",
      mt5Account: { login: baseInput.accountLogin, server: baseInput.accountServer },
    } as never);
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      status: SubscriptionStatus.ACTIVE,
      plan: { maxMt5Accounts: 1 },
    } as never);
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.termsAcceptance.findFirst).mockResolvedValue({ id: "t" } as never);
    vi.mocked(prisma.device.findFirst).mockResolvedValue({ id: "d" } as never);
    vi.mocked(prisma.realTradingApproval.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.accountSnapshot.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.eaHeartbeat.findFirst).mockResolvedValue({ eaStatus: "ONLINE" } as never);
    vi.mocked(prisma.instruction.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.executionProtectionReport.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.realTradePreflight.create).mockResolvedValue({ id: "pf" } as never);

    const r = await runRealTradePreflight(baseInput);
    expect(r.passed).toBe(false);
    expect(r.reasonCode).toBe(REAL_TRADING_REASONS.APPROVAL_REQUIRED);
  });

  it("4-6) bloqueia subscription/payment/terms", async () => {
    process.env.ENABLE_REAL_TRADING = "true";
    process.env.REAL_TRADING_ALLOWED_LICENSE_IDS = baseInput.licenseId;

    vi.mocked(prisma.license.findUnique).mockResolvedValue({
      userId: baseInput.userId,
      status: LicenseStatus.ACTIVE,
      haltAllTrading: false,
      revokedAt: null,
      subscriptionId: "sub-1",
      mt5Account: { login: baseInput.accountLogin, server: baseInput.accountServer },
    } as never);
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      status: SubscriptionStatus.PAST_DUE,
      plan: { maxMt5Accounts: 1 },
    } as never);
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.termsAcceptance.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.device.findFirst).mockResolvedValue({ id: "d" } as never);
    vi.mocked(prisma.realTradingApproval.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.accountSnapshot.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.eaHeartbeat.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.instruction.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.executionProtectionReport.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.realTradePreflight.create).mockResolvedValue({ id: "pf" } as never);

    const r = await runRealTradePreflight(baseInput);
    expect(r.passed).toBe(false);
  });

  it("15) permite quando todos os critérios OK", async () => {
    mockAllCriteriaPassing();
    const r = await runRealTradePreflight({
      ...baseInput,
      requiredMargin: 1000,
    });
    expect(r.passed).toBe(true);
    expect(r.status).toBe(RealTradePreflightStatus.PASSED);
    expect(r.reasonCode).toBe(REAL_TRADING_REASONS.ALLOWED_BY_CONTROLLED_GATE);
  });

  it("16) payload REAL inclui protectionRequired e controlled_real_gate", () => {
    const payload = mapInstructionToEaPayloadForReal(
      {
        id: "inst-1",
        purpose: InstructionPurpose.ENTRY,
        symbol: "WDOM26",
        side: "BUY",
        orderType: "MARKET",
        quantity: new Decimal(1),
        stopLoss: null,
        takeProfit: null,
        expiresAt: new Date(),
        idempotencyKey: "k",
        magicNumber: 910001,
      },
      {
        accountLogin: baseInput.accountLogin,
        accountServer: baseInput.accountServer,
        requestedContracts: 1,
      }
    );
    expect(payload.protection_required).toBe(true);
    expect(payload.controlled_real_gate).toBe(true);
    expect(payload.trade_mode).toBe("REAL");
    expect(payload).not.toHaveProperty("strategy");
  });

  it("14) bloqueia dispatch automático", async () => {
    mockAllCriteriaPassing();
    const r = await runRealTradePreflight({
      ...baseInput,
      isAutoDispatch: true,
    });
    expect(r.passed).toBe(false);
    expect(r.reasonCode).toBe(REAL_TRADING_REASONS.AUTO_DISPATCH_DISABLED);
  });
});
