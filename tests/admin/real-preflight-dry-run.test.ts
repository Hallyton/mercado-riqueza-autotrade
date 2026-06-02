import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  RealTradePreflightSource,
  RealTradePreflightStatus,
  TradeMode,
} from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  default: {
    license: { findUnique: vi.fn() },
    instruction: { create: vi.fn() },
    realTradePreflight: { create: vi.fn() },
    subscription: { findUnique: vi.fn() },
    invoice: { findFirst: vi.fn() },
    termsAcceptance: { findFirst: vi.fn() },
    device: { findFirst: vi.fn() },
    realTradingApproval: { findFirst: vi.fn() },
    accountSnapshot: { findFirst: vi.fn(), findUnique: vi.fn() },
    eaHeartbeat: { findFirst: vi.fn() },
    executionProtectionReport: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/admin/record-action", () => ({
  recordAdminAction: vi.fn(),
}));

vi.mock("@/lib/risk/real-trade-preflight", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/risk/real-trade-preflight")>();
  return {
    ...actual,
    runRealTradePreflight: vi.fn(),
  };
});

import prisma from "@/lib/prisma";
import { recordAdminAction } from "@/lib/admin/record-action";
import { runAdminRealPreflightDryRun } from "@/lib/admin/real-preflight-dry-run";
import { runRealTradePreflight } from "@/lib/risk/real-trade-preflight";
import { REAL_TRADING_REASONS } from "@/lib/risk/real-trading-reasons";

describe("admin real preflight dry-run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.license.findUnique).mockResolvedValue({
      id: "lic-1",
      userId: "user-1",
    } as never);
    vi.mocked(runRealTradePreflight).mockResolvedValue({
      status: RealTradePreflightStatus.PASSED,
      passed: true,
      reasonCode: REAL_TRADING_REASONS.ALLOWED_BY_CONTROLLED_GATE,
      checks: [],
      preflightId: "pf-dry",
      dryRun: true,
      source: RealTradePreflightSource.DRY_RUN,
      flags: {
        marginOk: true,
        eaOnline: true,
        snapshotOk: true,
        realApprovalOk: true,
        protectionPreviousOk: true,
        deviceOk: true,
        accountOk: true,
        licenseOk: true,
        subscriptionOk: true,
        paymentOk: true,
      },
    });
  });

  it("chama preflight em modo dryRun sem criar instruction", async () => {
    const result = await runAdminRealPreflightDryRun({
      actorId: "admin-1",
      licenseId: "lic-1",
      accountLogin: "19583778",
      accountServer: "XPMTS-PRD",
      symbol: "WDON26",
      magicNumber: 910001,
      requestedContracts: 1,
    });

    expect(runRealTradePreflight).toHaveBeenCalledWith(
      expect.objectContaining({
        dryRun: true,
        environment: TradeMode.REAL,
        isAutoDispatch: false,
      })
    );
    expect(prisma.instruction.create).not.toHaveBeenCalled();
    expect(result.dryRun).toBe(true);
    expect(result.passed).toBe(true);
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "real_trading.preflight_dry_run" })
    );
  });
});

