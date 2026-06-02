import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  InstructionSource,
  OrderLogStatus,
  RealManualBulkDispatchBatchStatus,
  RealManualBulkDispatchItemStatus,
  RealTradePreflightStatus,
} from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  default: {
    license: { findMany: vi.fn() },
    realManualBulkDispatchBatch: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    realManualBulkDispatchItem: { findFirst: vi.fn(), update: vi.fn() },
    instruction: { findUnique: vi.fn(), create: vi.fn() },
    instructionStatusLog: { create: vi.fn() },
    realTradePreflight: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/admin/record-action", () => ({ recordAdminAction: vi.fn() }));
vi.mock("@/lib/admin/real-manual-bulk-eligibility", () => ({
  evaluateBulkLicenseEligibility: vi.fn(),
  listBulkCandidateLicenseIds: vi.fn(),
}));
vi.mock("@/lib/risk/real-trade-preflight", () => ({
  runRealTradePreflight: vi.fn(),
}));
vi.mock("@/lib/risk/real-trading-guard", () => ({
  isRealTradingEnabled: vi.fn(() => true),
}));
vi.mock("@/lib/risk/real-trading-config", () => ({
  isAutoDispatchEnabled: vi.fn(() => false),
}));

import prisma from "@/lib/prisma";
import {
  evaluateBulkLicenseEligibility,
  listBulkCandidateLicenseIds,
} from "@/lib/admin/real-manual-bulk-eligibility";
import { runRealTradePreflight } from "@/lib/risk/real-trade-preflight";
import {
  BULK_DISPATCH_CONFIRM_PHRASE,
  bulkDispatchCountConfirmPhrase,
  buildBulkInstructionIdempotencyKey,
  executeRealManualBulkDispatch,
  hashManagementPlan,
  previewRealManualBulkDispatch,
} from "@/lib/admin/real-manual-bulk-dispatch";

const managementPlan = {
  version: 1 as const,
  initialStopLoss: 4999,
  takes: [
    { label: "T1" as const, enabled: true, price: 5001, quantity: 1 },
    { label: "T2" as const, enabled: false, price: null, quantity: 0 },
  ],
  breakEven: {
    enabled: false,
    trigger: "MANUAL_DISABLED" as const,
    triggerPrice: null,
    offset: 0,
  },
  trailingStop: {
    enabled: false,
    triggerPrice: null,
    distance: null,
    step: null,
  },
};

const previewBody = {
  symbol: "WDON26",
  side: "BUY" as const,
  orderType: "LIMIT" as const,
  orderPrice: 5000,
  requestedContracts: 1,
  managementPlan,
};

describe("real manual bulk dispatch preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listBulkCandidateLicenseIds).mockResolvedValue(["lic-1", "lic-2"]);
    vi.mocked(prisma.realManualBulkDispatchBatch.create).mockResolvedValue({
      id: "batch-1",
    } as never);
  });

  it("lista elegivel e bloqueado sem criar instruction", async () => {
    vi.mocked(evaluateBulkLicenseEligibility)
      .mockResolvedValueOnce({
        eligible: true,
        userId: "u-1",
        licenseId: "lic-1",
        userEmail: "a@test.com",
        userName: "A",
        accountLogin: "1",
        accountServer: "S",
        symbol: "WDON26",
        magicNumber: 910001,
        requestedContracts: 1,
        maxContracts: 1,
        freeMargin: 1000,
        eaOnline: true,
        deviceActiveReal: true,
        heartbeatAt: new Date().toISOString(),
        approvalId: "ap-1",
        accountSnapshotId: "snap-1",
        openInstructionId: null,
      })
      .mockResolvedValueOnce({
        eligible: false,
        userId: "u-2",
        licenseId: "lic-2",
        userEmail: "b@test.com",
        userName: null,
        accountLogin: null,
        accountServer: null,
        symbol: "WDON26",
        magicNumber: null,
        reasonCode: "USER_NOT_ACTIVE",
        reasonDetail: "Usuário inativo",
        actionHint: "Ativar usuário",
        regularizationLinks: { user: "/admin/users/u-2" },
      } as never);

    const result = await previewRealManualBulkDispatch({
      actorId: "admin-1",
      body: previewBody,
    });

    expect(result.summary.eligibleCount).toBe(1);
    expect(result.summary.blockedCount).toBe(1);
    expect(prisma.instruction.create).not.toHaveBeenCalled();
    expect(prisma.realManualBulkDispatchBatch.create).toHaveBeenCalled();
  });

  it("bloqueia managementPlan inválido", async () => {
    await expect(
      previewRealManualBulkDispatch({
        actorId: "admin-1",
        body: {
          ...previewBody,
          managementPlan: {
            ...managementPlan,
            initialStopLoss: 0,
          },
        },
      })
    ).rejects.toMatchObject({ code: expect.any(String) });
  });
});

describe("real manual bulk dispatch execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(prisma as any));
    vi.mocked(prisma.realManualBulkDispatchBatch.findUnique).mockResolvedValue({
      id: "batch-1",
      status: RealManualBulkDispatchBatchStatus.PREVIEW_READY,
      expiresAt: new Date(Date.now() + 60_000),
      symbol: "WDON26",
      side: "BUY",
      orderType: "LIMIT",
      orderPrice: 5000,
      requestedContracts: 1,
      managementPlan,
      managementPlanHash: hashManagementPlan(managementPlan),
      items: [
        {
          id: "item-1",
          licenseId: "lic-1",
          status: RealManualBulkDispatchItemStatus.ELIGIBLE,
        },
        {
          id: "item-2",
          licenseId: "lic-2",
          status: RealManualBulkDispatchItemStatus.ELIGIBLE,
        },
      ],
    } as never);
    vi.mocked(prisma.realManualBulkDispatchItem.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.instruction.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.instruction.create).mockResolvedValue({
      id: "inst-1",
      source: InstructionSource.REAL_MANUAL,
      currentStatus: OrderLogStatus.RECEIVED,
    } as never);
    vi.mocked(runRealTradePreflight).mockResolvedValue({
      passed: true,
      status: RealTradePreflightStatus.PASSED,
      preflightId: "pf-1",
      checks: [],
    });
  });

  it("cria instruction para elegível selecionado", async () => {
    vi.mocked(evaluateBulkLicenseEligibility).mockResolvedValue({
      eligible: true,
      userId: "u-1",
      licenseId: "lic-1",
      userEmail: "a@test.com",
      userName: "A",
      accountLogin: "1",
      accountServer: "S",
      symbol: "WDON26",
      magicNumber: 910001,
      requestedContracts: 1,
      maxContracts: 1,
      freeMargin: 1000,
      eaOnline: true,
      deviceActiveReal: true,
      heartbeatAt: new Date().toISOString(),
      approvalId: "ap-1",
      accountSnapshotId: "snap-1",
      openInstructionId: null,
    });

    const result = await executeRealManualBulkDispatch({
      actorId: "admin-1",
      body: {
        batchPreviewId: "batch-1",
        selectedLicenseIds: ["lic-1"],
        adminConfirmation: BULK_DISPATCH_CONFIRM_PHRASE,
        adminConfirmationCount: bulkDispatchCountConfirmPhrase(1),
      },
    });

    expect(result.summary.dispatched).toBe(1);
    expect(prisma.instruction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: InstructionSource.REAL_MANUAL,
          bulkBatchId: "batch-1",
          managementPlan,
          requiresProtectionConfirmation: true,
        }),
      })
    );
  });

  it("não cria instruction para bloqueado no execute", async () => {
    vi.mocked(evaluateBulkLicenseEligibility).mockResolvedValue({
      eligible: false,
      userId: "u-1",
      licenseId: "lic-1",
      userEmail: "a@test.com",
      userName: null,
      accountLogin: "1",
      accountServer: "S",
      symbol: "WDON26",
      magicNumber: 910001,
      reasonCode: "HEARTBEAT_STALE",
      reasonDetail: "stale",
      actionHint: "Reativar EA",
      regularizationLinks: {},
    } as never);

    const result = await executeRealManualBulkDispatch({
      actorId: "admin-1",
      body: {
        batchPreviewId: "batch-1",
        selectedLicenseIds: ["lic-1"],
        adminConfirmation: BULK_DISPATCH_CONFIRM_PHRASE,
        adminConfirmationCount: bulkDispatchCountConfirmPhrase(1),
      },
    });

    expect(result.summary.skipped).toBe(1);
    expect(prisma.instruction.create).not.toHaveBeenCalled();
    expect(result.items[0].status).toBe("BLOCKED_AT_EXECUTE");
  });

  it("idempotency key estável", () => {
    const key = buildBulkInstructionIdempotencyKey({
      batchId: "batch-1",
      licenseId: "lic-1",
      symbol: "WDON26",
      side: "BUY",
      orderType: "LIMIT",
      orderPrice: 5000,
      managementPlanHash: hashManagementPlan(managementPlan),
    });
    expect(key).toContain("bulk:batch-1:lic-1");
  });

  it("duplo clique retorna instruction existente via idempotency", async () => {
    vi.mocked(evaluateBulkLicenseEligibility).mockResolvedValue({
      eligible: true,
      userId: "u-1",
      licenseId: "lic-1",
      userEmail: "a@test.com",
      userName: "A",
      accountLogin: "1",
      accountServer: "S",
      symbol: "WDON26",
      magicNumber: 910001,
      requestedContracts: 1,
      maxContracts: 1,
      freeMargin: 1000,
      eaOnline: true,
      deviceActiveReal: true,
      heartbeatAt: new Date().toISOString(),
      approvalId: "ap-1",
      accountSnapshotId: "snap-1",
      openInstructionId: null,
    });
    vi.mocked(prisma.instruction.findUnique).mockResolvedValue({
      id: "inst-existing",
    } as never);

    const result = await executeRealManualBulkDispatch({
      actorId: "admin-1",
      body: {
        batchPreviewId: "batch-1",
        selectedLicenseIds: ["lic-1"],
        adminConfirmation: BULK_DISPATCH_CONFIRM_PHRASE,
        adminConfirmationCount: bulkDispatchCountConfirmPhrase(1),
      },
    });

    expect(result.items[0].instructionId).toBe("inst-existing");
    expect(prisma.instruction.create).not.toHaveBeenCalled();
  });
});
