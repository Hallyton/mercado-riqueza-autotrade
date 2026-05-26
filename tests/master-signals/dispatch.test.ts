import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  InstructionPurpose,
  InstructionSide,
  InstructionSource,
  LicenseStatus,
  MasterSignalDispatchStatus,
  MasterSignalSource,
  MasterSignalStatus,
  OrderLogStatus,
  SubscriptionStatus,
  TradeMode,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const {
  masterFindUnique,
  masterUpdateMany,
  masterUpdate,
  masterFindUniqueOrThrow,
  licenseFindMany,
  licenseCount,
  heartbeatFindFirst,
  dispatchFindMany,
  dispatchFindUnique,
  dispatchUpsert,
  instructionCreate,
  instructionFindUnique,
  instructionFindUniqueOrThrow,
  statusLogCreate,
  transaction,
} = vi.hoisted(() => ({
  masterFindUnique: vi.fn(),
  masterUpdateMany: vi.fn(),
  masterUpdate: vi.fn(),
  masterFindUniqueOrThrow: vi.fn(),
  licenseFindMany: vi.fn(),
  licenseCount: vi.fn(),
  heartbeatFindFirst: vi.fn(),
  dispatchFindMany: vi.fn(),
  dispatchFindUnique: vi.fn(),
  dispatchUpsert: vi.fn(),
  instructionCreate: vi.fn(),
  instructionFindUnique: vi.fn(),
  instructionFindUniqueOrThrow: vi.fn(),
  statusLogCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    masterSignal: {
      findUnique: masterFindUnique,
      updateMany: masterUpdateMany,
      update: masterUpdate,
      findUniqueOrThrow: masterFindUniqueOrThrow,
    },
    license: { findMany: licenseFindMany, count: licenseCount },
    eaHeartbeat: { findFirst: heartbeatFindFirst },
    masterSignalDispatch: {
      findMany: dispatchFindMany,
      findUnique: dispatchFindUnique,
      upsert: dispatchUpsert,
    },
    instruction: {
      create: instructionCreate,
      findUnique: instructionFindUnique,
      findUniqueOrThrow: instructionFindUniqueOrThrow,
    },
    instructionStatusLog: { create: statusLogCreate },
    $transaction: transaction,
  },
}));

import {
  evaluateLicenseEligibility,
  selectEligibleLicensesForMasterSignal,
  type LicenseEligibilityInput,
} from "@/lib/master-signals/eligibility";
import {
  buildMasterInstructionIdempotencyKey,
  dispatchValidatedMasterSignal,
  mapDispatchedInstructionToEaPayload,
  MasterSignalDispatchError,
  MASTER_SIGNAL_DISPATCH_DEFAULT_QUANTITY,
  resolveInstructionExpiresAt,
  resolveMasterSignalDispatchQuantity,
} from "@/lib/master-signals/dispatch";
import { mapInstructionToEaPayload } from "@/lib/ea/instructions";
import {
  REAL_TRADING_DISABLED_CODE,
  REAL_TRADING_DISABLED_REASON,
} from "@/lib/risk/real-trading-guard";

function baseLicenseInput(
  overrides: Partial<LicenseEligibilityInput> = {}
): LicenseEligibilityInput {
  return {
    licenseId: "lic-1",
    licenseStatus: LicenseStatus.ACTIVE,
    subscriptionStatus: SubscriptionStatus.ACTIVE,
    haltNewEntries: false,
    haltAllTrading: false,
    hasMt5: true,
    mt5Login: "12345",
    mt5Server: "Broker",
    exposureProfileSlug: "start",
    planAllowDemo: true,
    planMaxDevices: 2,
    planMaxMt5Accounts: 2,
    activeDeviceCount: 1,
    userActiveMt5LicenseCount: 1,
    tradeMode: TradeMode.DEMO,
    subscriptionPeriodEnd: new Date(Date.now() + 86_400_000),
    ...overrides,
  };
}

function validatedSignal(overrides: Record<string, unknown> = {}) {
  return {
    id: "ms-row-1",
    masterSignalId: "msig-dispatch-001",
    source: MasterSignalSource.MASTER_EA,
    symbol: "WDOM26",
    side: InstructionSide.BUY,
    orderType: "MARKET",
    purpose: InstructionPurpose.ENTRY,
    profileSlug: "start",
    status: MasterSignalStatus.VALIDATED,
    idempotencyKey: "idem-dispatch-001",
    expiresAt: new Date(Date.now() + 120_000),
    ...overrides,
  };
}

function eligibleLicenseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "lic-eligible",
    userId: "user-1",
    status: LicenseStatus.ACTIVE,
    haltNewEntries: false,
    haltAllTrading: false,
    mt5AccountId: "mt5-1",
    subscription: {
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: new Date(Date.now() + 86_400_000),
      plan: {
        allowDemo: true,
        maxDevices: 2,
        maxMt5Accounts: 2,
      },
    },
    mt5Account: { login: "12345", server: "Broker" },
    exposureProfile: { slug: "start" },
    devices: [{ id: "dev-1", deviceId: "ea-1", revokedAt: null }],
    ...overrides,
  };
}

describe("master signal eligibility", () => {
  it("seleciona licença elegível sem filtrar profile no SQL", async () => {
    licenseFindMany.mockResolvedValue([eligibleLicenseRow()]);
    licenseCount.mockResolvedValue(1);
    heartbeatFindFirst.mockResolvedValue({ tradeMode: TradeMode.DEMO });

    const result = await selectEligibleLicensesForMasterSignal({
      purpose: InstructionPurpose.ENTRY,
      profileSlug: "start",
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(result.eligible).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
    expect(licenseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: LicenseStatus.ACTIVE,
          subscription: { is: { status: SubscriptionStatus.ACTIVE } },
          mt5AccountId: { not: null },
        },
      })
    );
    expect(licenseFindMany.mock.calls[0][0].where).not.toHaveProperty("exposureProfile");
  });

  it("licença conservador é elegível para MasterSignal profile conservador", async () => {
    licenseFindMany.mockResolvedValue([
      eligibleLicenseRow({
        id: "lic-staging",
        exposureProfile: { slug: "conservador" },
      }),
    ]);
    licenseCount.mockResolvedValue(1);
    heartbeatFindFirst.mockResolvedValue({ tradeMode: TradeMode.DEMO });

    const result = await selectEligibleLicensesForMasterSignal({
      purpose: InstructionPurpose.ENTRY,
      profileSlug: "conservador",
      expiresAt: new Date(Date.now() + 120_000),
    });

    expect(result.eligible).toHaveLength(1);
    expect(result.eligible[0].id).toBe("lic-staging");
  });

  it("profile mismatch retorna skipped PROFILE_MISMATCH", async () => {
    licenseFindMany.mockResolvedValue([
      eligibleLicenseRow({ exposureProfile: { slug: "moderado" } }),
    ]);
    licenseCount.mockResolvedValue(1);
    heartbeatFindFirst.mockResolvedValue({ tradeMode: TradeMode.DEMO });

    const result = await selectEligibleLicensesForMasterSignal({
      purpose: InstructionPurpose.ENTRY,
      profileSlug: "conservador",
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(result.eligible).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].code).toBe("PROFILE_MISMATCH");
  });

  it("candidatos existentes com rejeição preenchem skipped reasons", async () => {
    licenseFindMany.mockResolvedValue([
      eligibleLicenseRow({ id: "lic-a", exposureProfile: { slug: "start" } }),
      eligibleLicenseRow({
        id: "lic-b",
        exposureProfile: { slug: "moderado" },
        devices: [],
      }),
    ]);
    licenseCount.mockResolvedValue(1);
    heartbeatFindFirst.mockResolvedValue({ tradeMode: TradeMode.DEMO });

    const result = await selectEligibleLicensesForMasterSignal({
      purpose: InstructionPurpose.ENTRY,
      profileSlug: "start",
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(result.candidatesCount).toBe(2);
    expect(result.skipped.length).toBeGreaterThan(0);
    expect(result.skipped.some((s) => s.code === "NO_ACTIVE_DEVICE")).toBe(true);
  });

  it("ignora licença inativa", () => {
    const decision = evaluateLicenseEligibility(
      { purpose: InstructionPurpose.ENTRY, profileSlug: "start", expiresAt: null },
      baseLicenseInput({ licenseStatus: LicenseStatus.SUSPENDED })
    );
    expect(decision.eligible).toBe(false);
    if (!decision.eligible) expect(decision.code).toBe("LICENSE_INACTIVE");
  });

  it("ignora assinatura inativa", () => {
    const decision = evaluateLicenseEligibility(
      { purpose: InstructionPurpose.ENTRY, profileSlug: null, expiresAt: null },
      baseLicenseInput({ subscriptionStatus: SubscriptionStatus.PAST_DUE })
    );
    expect(decision.eligible).toBe(false);
    if (!decision.eligible) expect(decision.code).toBe("SUBSCRIPTION_INACTIVE");
  });

  it("respeita halt_all_trading", () => {
    const decision = evaluateLicenseEligibility(
      { purpose: InstructionPurpose.ENTRY, profileSlug: null, expiresAt: null },
      baseLicenseInput({ haltAllTrading: true })
    );
    expect(decision.eligible).toBe(false);
    if (!decision.eligible) expect(decision.code).toBe("HALT_ALL_TRADING");
  });

  it("respeita halt_new_entries para ENTRY", () => {
    const decision = evaluateLicenseEligibility(
      { purpose: InstructionPurpose.ENTRY, profileSlug: null, expiresAt: null },
      baseLicenseInput({ haltNewEntries: true })
    );
    expect(decision.eligible).toBe(false);
    if (!decision.eligible) expect(decision.code).toBe("HALT_NEW_ENTRIES");
  });

  it("respeita allow_demo", () => {
    const decision = evaluateLicenseEligibility(
      { purpose: InstructionPurpose.ENTRY, profileSlug: null, expiresAt: null },
      baseLicenseInput({ planAllowDemo: false, tradeMode: TradeMode.DEMO })
    );
    expect(decision.eligible).toBe(false);
    if (!decision.eligible) expect(decision.code).toBe("DEMO_NOT_ALLOWED");
  });

  it("bloqueia licença em modo REAL pelo Real Trading Guard", () => {
    const decision = evaluateLicenseEligibility(
      { purpose: InstructionPurpose.ENTRY, profileSlug: null, expiresAt: null },
      baseLicenseInput({ tradeMode: TradeMode.REAL })
    );
    expect(decision.eligible).toBe(false);
    if (!decision.eligible) {
      expect(decision.code).toBe(REAL_TRADING_DISABLED_CODE);
      expect(decision.reason).toBe(REAL_TRADING_DISABLED_REASON);
    }
  });

  it("não cria elegibilidade sem MT5 vinculado", () => {
    const decision = evaluateLicenseEligibility(
      { purpose: InstructionPurpose.ENTRY, profileSlug: null, expiresAt: null },
      baseLicenseInput({ hasMt5: false, mt5Login: null, mt5Server: null })
    );
    expect(decision.eligible).toBe(false);
    if (!decision.eligible) expect(decision.code).toBe("MT5_NOT_LINKED");
  });

  it("exige device ativo", () => {
    const decision = evaluateLicenseEligibility(
      { purpose: InstructionPurpose.ENTRY, profileSlug: null, expiresAt: null },
      baseLicenseInput({ activeDeviceCount: 0 })
    );
    expect(decision.eligible).toBe(false);
    if (!decision.eligible) expect(decision.code).toBe("NO_ACTIVE_DEVICE");
  });
});

describe("dispatchValidatedMasterSignal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MASTER_SIGNAL_DISPATCH_QUANTITY;
    licenseFindMany.mockResolvedValue([eligibleLicenseRow()]);
    licenseCount.mockResolvedValue(1);
    heartbeatFindFirst.mockResolvedValue({ tradeMode: TradeMode.DEMO });
    masterUpdateMany.mockResolvedValue({ count: 1 });
    masterUpdate.mockResolvedValue({});
    dispatchFindMany.mockResolvedValue([]);
    dispatchFindUnique.mockResolvedValue(null);
    dispatchUpsert.mockResolvedValue({});
    instructionCreate.mockImplementation(async ({ data }) => ({
      id: `inst-${data.licenseId}`,
      ...data,
      quantity: new Decimal(data.quantity),
    }));
    statusLogCreate.mockResolvedValue({});
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        masterSignalDispatch: {
          findUnique: dispatchFindUnique,
          upsert: dispatchUpsert,
        },
        instruction: { create: instructionCreate },
        instructionStatusLog: { create: statusLogCreate },
      })
    );
    instructionFindUniqueOrThrow.mockImplementation(async ({ where }) => ({
      id: where.id,
      purpose: InstructionPurpose.ENTRY,
      symbol: "WDOM26",
      side: InstructionSide.BUY,
      orderType: "MARKET",
      quantity: new Decimal(1),
      stopLoss: null,
      takeProfit: null,
      expiresAt: new Date(Date.now() + 60_000),
      idempotencyKey: "master:msig:lic",
    }));
  });

  afterEach(() => {
    delete process.env.MASTER_SIGNAL_DISPATCH_QUANTITY;
    delete process.env.ENABLE_REAL_TRADING;
    delete process.env.REAL_TRADING_ALLOWED_LICENSE_IDS;
  });

  it("1) não faz dispatch se MasterSignal não existe", async () => {
    masterFindUnique.mockResolvedValue(null);
    await expect(dispatchValidatedMasterSignal("missing")).rejects.toMatchObject({
      code: "MASTER_SIGNAL_NOT_FOUND",
    });
  });

  it("2) não faz dispatch se status não é VALIDATED", async () => {
    masterFindUnique.mockResolvedValue(
      validatedSignal({ status: MasterSignalStatus.RECEIVED })
    );
    await expect(dispatchValidatedMasterSignal("msig-dispatch-001")).rejects.toMatchObject({
      code: "MASTER_SIGNAL_NOT_DISPATCHABLE",
    });
  });

  it("3) cria Instruction para licença elegível", async () => {
    masterFindUnique.mockResolvedValue(validatedSignal());
    const result = await dispatchValidatedMasterSignal("msig-dispatch-001");
    expect(result.instructionsCreated).toBe(1);
    expect(instructionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          licenseId: "lic-eligible",
          symbol: "WDOM26",
          currentStatus: OrderLogStatus.RECEIVED,
          quantity: MASTER_SIGNAL_DISPATCH_DEFAULT_QUANTITY,
          source: InstructionSource.MASTER_SIGNAL,
        }),
      })
    );
  });

  it("3c) bloqueia dispatch para licença com heartbeat REAL sem flag de liberação", async () => {
    masterFindUnique.mockResolvedValue(validatedSignal());
    heartbeatFindFirst.mockResolvedValue({ tradeMode: TradeMode.REAL });

    const result = await dispatchValidatedMasterSignal("msig-dispatch-001");

    expect(result.instructionsCreated).toBe(0);
    expect(result.noEligibleLicenses).toBe(true);
    expect(result.status).toBe(MasterSignalStatus.REJECTED);
    expect(instructionCreate).not.toHaveBeenCalled();
    expect(dispatchUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          status: MasterSignalDispatchStatus.SKIPPED,
          reason: REAL_TRADING_DISABLED_CODE,
        }),
      })
    );
  });

  it("3b) instruction criada pelo master dispatch não usa source null", async () => {
    masterFindUnique.mockResolvedValue(validatedSignal());
    await dispatchValidatedMasterSignal("msig-dispatch-001");
    expect(instructionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: InstructionSource.MASTER_SIGNAL,
        }),
      })
    );
    const createArg = instructionCreate.mock.calls[0][0];
    expect(createArg.data.source).not.toBeNull();
  });

  it("4) cria MasterSignalDispatch com INSTRUCTION_CREATED", async () => {
    masterFindUnique.mockResolvedValue(validatedSignal());
    await dispatchValidatedMasterSignal("msig-dispatch-001");
    expect(dispatchUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          status: MasterSignalDispatchStatus.INSTRUCTION_CREATED,
          licenseId: "lic-eligible",
        }),
      })
    );
  });

  it("5) não duplica instruction em retry", async () => {
    masterFindUnique.mockResolvedValue(validatedSignal());
    dispatchFindUnique.mockResolvedValue({
      instructionId: "inst-existing",
      status: MasterSignalDispatchStatus.INSTRUCTION_CREATED,
    });

    const result = await dispatchValidatedMasterSignal("msig-dispatch-001");
    expect(result.instructionsCreated).toBe(0);
    expect(instructionCreate).not.toHaveBeenCalled();
  });

  it("6) retry retorna estado idempotente quando já DISPATCHED", async () => {
    masterFindUnique.mockResolvedValue(
      validatedSignal({ status: MasterSignalStatus.DISPATCHED })
    );
    dispatchFindMany.mockResolvedValue([
      {
        status: MasterSignalDispatchStatus.INSTRUCTION_CREATED,
        instructionId: "inst-1",
      },
    ]);

    const result = await dispatchValidatedMasterSignal("msig-dispatch-001");
    expect(result.idempotent).toBe(true);
    expect(result.instructionsCreated).toBe(1);
    expect(masterUpdateMany).not.toHaveBeenCalled();
  });

  it("7) atualiza MasterSignal para DISPATCHED quando cria instruction", async () => {
    masterFindUnique.mockResolvedValue(validatedSignal());
    await dispatchValidatedMasterSignal("msig-dispatch-001");
    expect(masterUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: MasterSignalStatus.DISPATCHED }),
      })
    );
  });

  it("7b) cenário staging conservador cria 1 instruction", async () => {
    masterFindUnique.mockResolvedValue(
      validatedSignal({ masterSignalId: "test-dispatch-002", profileSlug: "conservador" })
    );
    licenseFindMany.mockResolvedValue([
      eligibleLicenseRow({
        id: "cmpj3wby70005sx18ot5e939p",
        exposureProfile: { slug: "conservador" },
      }),
    ]);
    heartbeatFindFirst.mockResolvedValue({ tradeMode: TradeMode.DEMO });

    const result = await dispatchValidatedMasterSignal("test-dispatch-002");
    expect(result.instructionsCreated).toBe(1);
    expect(result.status).toBe(MasterSignalStatus.DISPATCHED);
  });

  it("7c) profile mismatch cria SKIPPED e rejeita sem instruction", async () => {
    masterFindUnique.mockResolvedValue(
      validatedSignal({ profileSlug: "conservador" })
    );
    licenseFindMany.mockResolvedValue([
      eligibleLicenseRow({ exposureProfile: { slug: "moderado" } }),
    ]);
    heartbeatFindFirst.mockResolvedValue({ tradeMode: TradeMode.DEMO });

    const result = await dispatchValidatedMasterSignal("msig-dispatch-001");
    expect(result.instructionsCreated).toBe(0);
    expect(result.noEligibleLicenses).toBe(true);
    expect(result.status).toBe(MasterSignalStatus.REJECTED);
    expect(instructionCreate).not.toHaveBeenCalled();
    expect(masterUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: MasterSignalStatus.REJECTED,
          rejectedReason: "NO_ELIGIBLE_LICENSES",
          dispatchedAt: null,
        }),
      })
    );
    expect(dispatchUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          status: MasterSignalDispatchStatus.SKIPPED,
          reason: "PROFILE_MISMATCH",
        }),
      })
    );
  });

  it("7d) retry do sinal REJECTED não cria instruction", async () => {
    masterFindUnique.mockResolvedValue(
      validatedSignal({
        status: MasterSignalStatus.REJECTED,
        rejectedReason: "NO_ELIGIBLE_LICENSES",
      })
    );
    dispatchFindMany.mockResolvedValue([
      {
        status: MasterSignalDispatchStatus.SKIPPED,
        instructionId: null,
      },
    ]);

    const result = await dispatchValidatedMasterSignal("msig-dispatch-001");
    expect(result.idempotent).toBe(true);
    expect(result.status).toBe(MasterSignalStatus.REJECTED);
    expect(result.instructionsCreated).toBe(0);
    expect(result.skipped).toBe(1);
    expect(masterUpdateMany).not.toHaveBeenCalled();
    expect(instructionCreate).not.toHaveBeenCalled();
  });

  it("8) atualiza para FAILED quando criação falha com elegível", async () => {
    masterFindUnique.mockResolvedValue(validatedSignal());
    transaction.mockRejectedValueOnce(new Error("db fail"));
    dispatchUpsert.mockResolvedValue({});

    const result = await dispatchValidatedMasterSignal("msig-dispatch-001");
    expect(result.failed).toBe(1);
    expect(result.instructionsCreated).toBe(0);
    expect(masterUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: MasterSignalStatus.FAILED }),
      })
    );
  });

  it("9) atualiza para PARTIALLY_DISPATCHED em falha parcial", async () => {
    masterFindUnique.mockResolvedValue(validatedSignal());
    licenseFindMany.mockResolvedValue([
      eligibleLicenseRow({ id: "lic-a" }),
      eligibleLicenseRow({ id: "lic-b" }),
    ]);
    transaction
      .mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          masterSignalDispatch: {
            findUnique: vi.fn().mockResolvedValue(null),
            upsert: dispatchUpsert,
          },
          instruction: { create: instructionCreate },
          instructionStatusLog: { create: statusLogCreate },
        })
      )
      .mockRejectedValueOnce(new Error("fail second"));

    const result = await dispatchValidatedMasterSignal("msig-dispatch-001");
    expect(result.instructionsCreated).toBe(1);
    expect(result.failed).toBe(1);
    expect(masterUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: MasterSignalStatus.PARTIALLY_DISPATCHED,
        }),
      })
    );
  });

  it("10) idempotency key estável por master signal e licença", () => {
    expect(buildMasterInstructionIdempotencyKey("msig-1", "lic-1")).toBe(
      "master:msig-1:lic-1"
    );
  });

  it("11) expiresAt da instruction segue o MasterSignal", () => {
    const expiresAt = new Date("2030-01-01T00:00:00.000Z");
    const resolved = resolveInstructionExpiresAt({ expiresAt });
    expect(resolved.toISOString()).toBe(expiresAt.toISOString());
  });

  it("12) EA payload mantém contrato atual", async () => {
    const instruction = {
      id: "inst-ea",
      purpose: InstructionPurpose.ENTRY,
      symbol: "WDOM26",
      side: InstructionSide.BUY,
      orderType: "MARKET",
      quantity: new Decimal(1),
      stopLoss: null,
      takeProfit: null,
      expiresAt: new Date(Date.now() + 60_000),
      idempotencyKey: "master:msig:lic",
    };
    const expected = mapInstructionToEaPayload(instruction);
    instructionFindUniqueOrThrow.mockResolvedValue(instruction);
    const mapped = await mapDispatchedInstructionToEaPayload("inst-ea");
    expect(mapped).toEqual(expected);
    expect(mapped).not.toHaveProperty("strategy");
    expect(mapped).not.toHaveProperty("rawPayload");
  });

  it("13) quantity padrão segura quando ausente no MasterSignal", () => {
    expect(resolveMasterSignalDispatchQuantity()).toBe(
      MASTER_SIGNAL_DISPATCH_DEFAULT_QUANTITY
    );
  });
});
