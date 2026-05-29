import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LicenseStatus,
  RealTradePreflightStatus,
  RealTradingApprovalStatus,
  SubscriptionStatus,
  TradeMode,
} from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  default: {
    license: { findUnique: vi.fn() },
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
  vi.mocked(prisma.license.findUnique).mockResolvedValue({
    id: baseInput.licenseId,
    userId: baseInput.userId,
    status: LicenseStatus.ACTIVE,
    haltAllTrading: false,
    mt5Account: {
      login: baseInput.accountLogin,
      server: baseInput.accountServer,
    },
    subscription: { status: SubscriptionStatus.ACTIVE },
  } as never);

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

  vi.mocked(prisma.realTradePreflight.create).mockImplementation(async ({ data }) => ({
    id: "pf-1",
    ...data,
  }));
}

describe("runRealTradePreflight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENABLE_REAL_TRADING = "true";
    process.env.REAL_TRADING_ALLOWED_LICENSE_IDS = baseInput.licenseId;
    process.env.ENABLE_AUTO_DISPATCH = "false";
  });

  it("bloqueia REAL sem ENABLE_REAL_TRADING", async () => {
    delete process.env.ENABLE_REAL_TRADING;
    mockHappyPath();
    const result = await runRealTradePreflight(baseInput);
    expect(result.passed).toBe(false);
    expect(result.reasonCode).toBe(REAL_TRADING_REASONS.DISABLED);
  });

  it("bloqueia sem approval aprovado", async () => {
    process.env.ENABLE_REAL_TRADING = "true";
    vi.mocked(prisma.license.findUnique).mockResolvedValue({
      id: baseInput.licenseId,
      userId: baseInput.userId,
      status: LicenseStatus.ACTIVE,
      haltAllTrading: false,
      mt5Account: { login: baseInput.accountLogin, server: baseInput.accountServer },
      subscription: { status: SubscriptionStatus.ACTIVE },
    } as never);
    vi.mocked(prisma.realTradingApproval.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.accountSnapshot.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.eaHeartbeat.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.instruction.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.executionProtectionReport.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.realTradePreflight.create).mockResolvedValue({ id: "pf-2" } as never);

    const result = await runRealTradePreflight(baseInput);
    expect(result.passed).toBe(false);
    expect(result.reasonCode).toBe(REAL_TRADING_REASONS.APPROVAL_REQUIRED);
  });

  it("passa com approval, snapshot, EA online e margem", async () => {
    mockHappyPath();
    const result = await runRealTradePreflight({
      ...baseInput,
      requiredMargin: 1000,
    });
    expect(result.passed).toBe(true);
    expect(result.status).toBe(RealTradePreflightStatus.PASSED);
  });

  it("bloqueia margem insuficiente", async () => {
    mockHappyPath();
    vi.mocked(prisma.accountSnapshot.findFirst).mockResolvedValue({
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

  it("bloqueia proteção anterior pendente", async () => {
    mockHappyPath();
    vi.mocked(prisma.instruction.findFirst).mockResolvedValue({
      id: "inst-blocked",
      protectionBlocked: true,
    } as never);

    const result = await runRealTradePreflight(baseInput);
    expect(result.passed).toBe(false);
    expect(result.reasonCode).toBe(
      REAL_TRADING_REASONS.PROTECTION_NOT_CONFIRMED
    );
  });

  it("bloqueia dispatch automático quando solicitado", async () => {
    mockHappyPath();
    const result = await runRealTradePreflight({
      ...baseInput,
      isAutoDispatch: true,
    });
    expect(result.passed).toBe(false);
    expect(result.reasonCode).toBe(
      REAL_TRADING_REASONS.AUTO_DISPATCH_DISABLED
    );
  });
});

describe("hasPreMarketSnapshotToday", () => {
  it("retorna ok quando snapshot existe", async () => {
    vi.mocked(prisma.accountSnapshot.findFirst).mockResolvedValue({
      id: "snap-today",
    } as never);
    const result = await hasPreMarketSnapshotToday(
      "lic-1",
      "123",
      "SERVER"
    );
    expect(result.ok).toBe(true);
    expect(result.snapshotId).toBe("snap-today");
  });
});
