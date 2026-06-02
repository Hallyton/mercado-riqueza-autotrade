import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LicenseStatus,
  RealTradePreflightSource,
  RealTradePreflightStatus,
  RealTradingApprovalStatus,
  SubscriptionStatus,
  TradeMode,
} from "@prisma/client";

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
import {
  hasPreMarketSnapshotToday,
  runRealTradePreflight,
} from "@/lib/risk/real-trade-preflight";
import { REAL_TRADING_REASONS } from "@/lib/risk/real-trading-reasons";
import { buildMockApprovedRealTradingApproval } from "@/tests/risk/_real-trading-mocks";

const baseInput = {
  userId: "user-1",
  licenseId: "lic-approved",
  accountLogin: "52609973",
  accountServer: "XPMT5-REAL",
  symbol: "WDOM26",
  magicNumber: 910001,
  environment: TradeMode.REAL,
};

function mockHappyPath() {
  process.env.ENABLE_REAL_TRADING = "true";
  delete process.env.REAL_TRADING_ALLOWED_LICENSE_IDS;

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
        return buildMockApprovedRealTradingApproval({
          accountLogin: baseInput.accountLogin,
          accountServer: baseInput.accountServer,
          userId: baseInput.userId,
        }) as never;
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
  vi.mocked(prisma.realTradePreflight.create).mockImplementation(async ({ data }) => ({
    id: "pf-1",
    ...data,
  }));
}

describe("runRealTradePreflight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ENABLE_REAL_TRADING;
    delete process.env.REAL_TRADING_ALLOWED_LICENSE_IDS;
  });

  it("bloqueia REAL sem ENABLE_REAL_TRADING", async () => {
    mockHappyPath();
    delete process.env.ENABLE_REAL_TRADING;
    const result = await runRealTradePreflight(baseInput);
    expect(result.passed).toBe(false);
    expect(result.reasonCode).toBe(REAL_TRADING_REASONS.ENV_NOT_ENABLED);
  });

  it("passa com todos os critérios e reason ALLOWED_BY_CONTROLLED_GATE", async () => {
    mockHappyPath();
    const result = await runRealTradePreflight({
      ...baseInput,
      requiredMargin: 1000,
    });
    expect(result.passed).toBe(true);
    expect(result.status).toBe(RealTradePreflightStatus.PASSED);
    expect(result.reasonCode).toBe(
      REAL_TRADING_REASONS.ALLOWED_BY_CONTROLLED_GATE
    );
  });

  it("bloqueia margem insuficiente", async () => {
    mockHappyPath();
    vi.mocked(prisma.accountSnapshot.findUnique).mockResolvedValue({
      id: "snap-1",
      freeMargin: 100,
    } as never);
    const result = await runRealTradePreflight({
      ...baseInput,
      requiredMargin: 50000,
    });
    expect(result.passed).toBe(false);
    expect(result.reasonCode).toBe(REAL_TRADING_REASONS.MARGIN_INSUFFICIENT);
  });

  it("bloqueia EA offline", async () => {
    mockHappyPath();
    vi.mocked(prisma.eaHeartbeat.findFirst).mockResolvedValue(null);
    const result = await runRealTradePreflight(baseInput);
    expect(result.passed).toBe(false);
    expect(result.reasonCode).toBe(REAL_TRADING_REASONS.EXECUTOR_OFFLINE);
  });

  it("bloqueia snapshot PRE_MARKET ausente", async () => {
    mockHappyPath();
    vi.mocked(prisma.accountSnapshot.findFirst).mockResolvedValue(null);
    const result = await runRealTradePreflight(baseInput);
    expect(result.passed).toBe(false);
    expect(result.reasonCode).toBe(REAL_TRADING_REASONS.SNAPSHOT_REQUIRED);
  });

  it("bloqueia termos não aceitos", async () => {
    mockHappyPath();
    vi.mocked(prisma.termsAcceptance.findFirst).mockResolvedValue(null);
    const result = await runRealTradePreflight(baseInput);
    expect(result.passed).toBe(false);
    expect(result.reasonCode).toBe(REAL_TRADING_REASONS.TERMS_NOT_ACCEPTED);
  });

  it("bloqueia dispatch automático", async () => {
    mockHappyPath();
    const result = await runRealTradePreflight({
      ...baseInput,
      isAutoDispatch: true,
    });
    expect(result.passed).toBe(false);
    expect(result.reasonCode).toBe(REAL_TRADING_REASONS.AUTO_DISPATCH_DISABLED);
  });

  it("dry-run persiste source DRY_RUN sem instructionId", async () => {
    mockHappyPath();
    await runRealTradePreflight({
      ...baseInput,
      instructionId: "instr-ignored",
      dryRun: true,
    });
    expect(prisma.realTradePreflight.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: RealTradePreflightSource.DRY_RUN,
          instructionId: undefined,
          masterSignalId: undefined,
        }),
      })
    );
  });
});

describe("hasPreMarketSnapshotToday", () => {
  it("retorna ok quando snapshot existe", async () => {
    vi.mocked(prisma.accountSnapshot.findFirst).mockResolvedValue({
      id: "snap-today",
    } as never);
    const result = await hasPreMarketSnapshotToday("lic-1", "123", "SERVER");
    expect(result.ok).toBe(true);
  });
});
