import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import {
  InstructionPurpose,
  OrderLogStatus,
  LicenseStatus,
  SubscriptionStatus,
  TradeMode,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { canAcceptNewEntries } from "@/lib/licensing/flags";
import { mapInstructionToEaPayload } from "@/lib/ea/instructions";

vi.mock("@/lib/risk/real-trade-preflight", () => ({
  runRealTradePreflight: vi.fn().mockResolvedValue({
    passed: true,
    status: "PASSED",
  }),
  hasPreMarketSnapshotToday: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    instruction: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    instructionStatusLog: { create: vi.fn() },
    license: { findUnique: vi.fn() },
    eaHeartbeat: {
      findFirst: vi.fn().mockResolvedValue({ tradeMode: "DEMO" }),
    },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
    execution: { create: vi.fn(), findFirst: vi.fn().mockResolvedValue(null) },
  },
}));

vi.mock("@/lib/audit/log", () => ({
  createAuditLog: vi.fn(),
}));

vi.mock("@/lib/licensing/instruction-policy", () => ({
  assertInstructionAllowed: vi.fn(),
  LicensePolicyError: class LicensePolicyError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock("@/lib/licensing/service", () => ({
  getLicenseOperationalFlags: vi.fn(),
}));

import prisma from "@/lib/prisma";
import {
  auditDeliverableInstructionsForEa,
  countDeliverableInstructionsForEa,
  deliverableInstructionWhere,
  pullInstructionsForEa,
  reportExecution,
  reportIgnored,
} from "@/lib/ea/instructions";
import { assertInstructionAllowed } from "@/lib/licensing/instruction-policy";
import { createAuditLog } from "@/lib/audit/log";

const ctx = {
  device: { id: "dev1", deviceId: "mt5-1", licenseId: "lic1" },
  license: {
    id: "lic1",
    userId: "user1",
    status: LicenseStatus.ACTIVE,
    haltNewEntries: false,
    haltAllTrading: false,
    subscription: { status: SubscriptionStatus.ACTIVE, plan: { allowDemo: false } },
    mt5Account: { login: "123", server: "Broker-Demo" },
    exposureProfile: null,
  },
  requestId: "req-1",
  deviceIdHeader: "mt5-1",
  eaVersion: "1.0.0",
} as const;

afterEach(() => {
  delete process.env.ENABLE_REAL_TRADING;
  delete process.env.REAL_TRADING_ALLOWED_LICENSE_IDS;
  vi.mocked(prisma.eaHeartbeat.findFirst).mockResolvedValue({ tradeMode: TradeMode.DEMO } as never);
});

describe("Sinal recebido", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertInstructionAllowed).mockResolvedValue(undefined);
    vi.mocked(prisma.eaHeartbeat.findFirst).mockResolvedValue({ tradeMode: TradeMode.DEMO } as never);
  });

  it("retorna instrução autorizada no pull", async () => {
    const instruction = {
      id: "inst-1",
      purpose: InstructionPurpose.ENTRY,
      symbol: "PETR4",
      side: "BUY",
      orderType: "MARKET",
      quantity: new Decimal(100),
      stopLoss: new Decimal(28.5),
      takeProfit: new Decimal(30),
      expiresAt: new Date(Date.now() + 60_000),
      idempotencyKey: "key-1",
      currentStatus: OrderLogStatus.RECEIVED,
    };

    vi.mocked(prisma.instruction.findMany).mockResolvedValue([instruction] as never);

    const result = await pullInstructionsForEa(ctx as never);
    expect(result).toHaveLength(1);
    expect(result[0].instruction_id).toBe("inst-1");
    expect(result[0].symbol).toBe("PETR4");
    expect(result[0]).not.toHaveProperty("strategy");
  });

  it("bloqueia entrega quando último heartbeat está em REAL e guard está fechado", async () => {
    vi.mocked(prisma.eaHeartbeat.findFirst).mockResolvedValue({ tradeMode: TradeMode.REAL } as never);
    vi.mocked(prisma.instruction.findMany).mockResolvedValue([
      {
        id: "inst-real",
        purpose: InstructionPurpose.ENTRY,
        symbol: "WDOM26",
        side: "BUY",
        orderType: "MARKET",
        quantity: new Decimal(1),
        stopLoss: null,
        takeProfit: null,
        expiresAt: new Date(Date.now() + 60_000),
        idempotencyKey: "key-real",
        currentStatus: OrderLogStatus.RECEIVED,
      },
    ] as never);

    const result = await pullInstructionsForEa(ctx as never);

    expect(result).toEqual([]);
    expect(prisma.instruction.findMany).not.toHaveBeenCalled();
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ea.instructions_blocked_real_trading",
        entityId: "lic1",
      })
    );
  });

  it("feature flag futura não libera REAL sem allowlist no pull do EA", async () => {
    process.env.ENABLE_REAL_TRADING = "true";
    process.env.REAL_TRADING_ALLOWED_LICENSE_IDS = "other-license";
    vi.mocked(prisma.eaHeartbeat.findFirst).mockResolvedValue({ tradeMode: TradeMode.REAL } as never);

    const result = await pullInstructionsForEa(ctx as never);

    expect(result).toEqual([]);
    expect(prisma.instruction.findMany).not.toHaveBeenCalled();
    delete process.env.ENABLE_REAL_TRADING;
    delete process.env.REAL_TRADING_ALLOWED_LICENSE_IDS;
  });
});

describe("Ordem ignorada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ignora entrada quando licença bloqueia novas operações", async () => {
    const { LicensePolicyError } = await import(
      "@/lib/licensing/instruction-policy"
    );
    vi.mocked(assertInstructionAllowed).mockRejectedValue(
      new LicensePolicyError("Novas entradas bloqueadas", "NEW_ENTRIES_BLOCKED")
    );

    vi.mocked(prisma.instruction.findMany).mockResolvedValue([
      {
        id: "inst-2",
        purpose: InstructionPurpose.ENTRY,
        symbol: "VALE3",
        side: "BUY",
        orderType: "MARKET",
        quantity: new Decimal(50),
        stopLoss: null,
        takeProfit: null,
        expiresAt: new Date(Date.now() + 60_000),
        idempotencyKey: "key-2",
        currentStatus: OrderLogStatus.RECEIVED,
      },
    ] as never);

    const result = await pullInstructionsForEa(ctx as never);
    expect(result).toHaveLength(0);
    expect(prisma.instructionStatusLog.create).toHaveBeenCalled();
  });

  it("registra ignore explícito do EA", async () => {
    vi.mocked(prisma.instruction.findFirst).mockResolvedValue({
      id: "inst-3",
      licenseId: "lic1",
    } as never);

    const result = await reportIgnored(ctx as never, "inst-3", "expirada");
    expect(result.ok).toBe(true);
  });
});

describe("Ordem rejeitada", () => {
  it("persiste execução rejeitada", async () => {
    vi.mocked(prisma.instruction.findFirst).mockResolvedValue({
      id: "inst-4",
      licenseId: "lic1",
      purpose: InstructionPurpose.ENTRY,
    } as never);

    const result = await reportExecution(ctx as never, {
      instruction_id: "inst-4",
      status: "REJECTED",
      error_code: "BROKER_REJECT",
      error_message: "Mercado fechado",
    });

    expect(result.ok).toBe(true);
    expect(prisma.execution.create).toHaveBeenCalled();
  });
});

describe("Contrato GET /instructions", () => {
  it("envelope com array instructions e campos snake_case do EA-API", () => {
    const item = mapInstructionToEaPayload({
      id: "inst-contract",
      purpose: InstructionPurpose.ENTRY,
      symbol: "WDOM26",
      side: "BUY",
      orderType: "MARKET",
      quantity: new Decimal(1),
      stopLoss: null,
      takeProfit: null,
      expiresAt: new Date("2026-05-20T18:00:00.000Z"),
      idempotencyKey: "idem-1",
    });

    const envelope = {
      instructions: [item],
      subscription_active: true,
    };

    expect(envelope.instructions).toHaveLength(1);
    expect(envelope).not.toHaveProperty("data");
    expect(item).toEqual({
      instruction_id: "inst-contract",
      purpose: InstructionPurpose.ENTRY,
      symbol: "WDOM26",
      side: "BUY",
      order_type: "MARKET",
      quantity: 1,
      stop_loss: null,
      take_profit: null,
      expires_at: "2026-05-20T18:00:00.000Z",
      idempotency_key: "idem-1",
    });
  });
});

describe("Payload EA sem estratégia", () => {
  it("expõe apenas campos de execução", () => {
    const payload = mapInstructionToEaPayload({
      id: "x",
      purpose: InstructionPurpose.EXIT,
      symbol: "PETR4",
      side: "SELL",
      orderType: "MARKET",
      quantity: new Decimal(100),
      stopLoss: null,
      takeProfit: null,
      expiresAt: new Date(),
      idempotencyKey: "k",
    });
    expect(Object.keys(payload).sort()).toEqual(
      [
        "expires_at",
        "idempotency_key",
        "instruction_id",
        "order_type",
        "purpose",
        "quantity",
        "side",
        "stop_loss",
        "symbol",
        "take_profit",
      ].sort()
    );
  });
});

describe("Licença vencida — flags", () => {
  it("não permite novas entradas", () => {
    expect(
      canAcceptNewEntries({
        licenseStatus: LicenseStatus.SUSPENDED,
        subscriptionStatus: SubscriptionStatus.PAST_DUE,
        haltNewEntries: true,
        haltAllTrading: false,
      })
    ).toBe(false);
  });
});

describe("Fila entregável ao EA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertInstructionAllowed).mockResolvedValue(undefined);
  });

  it("consulta RECEIVED ou SENT sem execução e não expiradas", async () => {
    vi.mocked(prisma.instruction.findMany).mockResolvedValue([]);

    await pullInstructionsForEa(ctx as never);

    expect(prisma.instruction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: deliverableInstructionWhere("lic1", expect.any(Date) as Date),
        orderBy: { createdAt: "asc" },
        take: 20,
      })
    );
  });

  it("instrução TEST RECEIVED é entregue no pull", async () => {
    vi.mocked(prisma.instruction.findMany).mockResolvedValue([
      {
        id: "inst-test",
        purpose: InstructionPurpose.ENTRY,
        symbol: "WDOM26",
        side: "BUY",
        orderType: "MARKET",
        quantity: new Decimal(1),
        stopLoss: null,
        takeProfit: null,
        expiresAt: new Date(Date.now() + 3600_000),
        idempotencyKey: "homolog-test",
        currentStatus: OrderLogStatus.RECEIVED,
      },
    ] as never);

    const result = await pullInstructionsForEa(ctx as never);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe("WDOM26");
  });

  it("SENT sem execução continua entregável (retry)", async () => {
    vi.mocked(prisma.instruction.findMany).mockResolvedValue([
      {
        id: "inst-sent",
        purpose: InstructionPurpose.ENTRY,
        symbol: "PETR4",
        side: "BUY",
        orderType: "MARKET",
        quantity: new Decimal(100),
        stopLoss: null,
        takeProfit: null,
        expiresAt: new Date(Date.now() + 60_000),
        idempotencyKey: "k-sent",
        currentStatus: OrderLogStatus.SENT,
      },
    ] as never);

    const result = await pullInstructionsForEa(ctx as never);
    expect(result).toHaveLength(1);
    expect(prisma.instruction.update).not.toHaveBeenCalled();
  });

  it("pull repetido não cria instruction nova e só muda RECEIVED para SENT uma vez", async () => {
    vi.mocked(prisma.instruction.findMany)
      .mockResolvedValueOnce([
        {
          id: "inst-retry",
          purpose: InstructionPurpose.ENTRY,
          symbol: "PETR4",
          side: "BUY",
          orderType: "MARKET",
          quantity: new Decimal(100),
          stopLoss: null,
          takeProfit: null,
          expiresAt: new Date(Date.now() + 60_000),
          idempotencyKey: "k-retry",
          currentStatus: OrderLogStatus.RECEIVED,
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          id: "inst-retry",
          purpose: InstructionPurpose.ENTRY,
          symbol: "PETR4",
          side: "BUY",
          orderType: "MARKET",
          quantity: new Decimal(100),
          stopLoss: null,
          takeProfit: null,
          expiresAt: new Date(Date.now() + 60_000),
          idempotencyKey: "k-retry",
          currentStatus: OrderLogStatus.SENT,
        },
      ] as never);

    const first = await pullInstructionsForEa(ctx as never);
    const second = await pullInstructionsForEa(ctx as never);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(first[0].instruction_id).toBe("inst-retry");
    expect(second[0].instruction_id).toBe("inst-retry");
    expect(prisma.instruction.create).toBeUndefined();
    expect(prisma.instruction.update).toHaveBeenCalledTimes(1);
    expect(prisma.instructionStatusLog.create).toHaveBeenCalledTimes(1);
  });

  it("where de entrega exclui instruction expirada e status terminal", () => {
    expect(deliverableInstructionWhere("lic1", new Date("2026-05-26T20:00:00Z"))).toEqual({
      licenseId: "lic1",
      expiresAt: { gt: new Date("2026-05-26T20:00:00Z") },
      OR: [
        { currentStatus: OrderLogStatus.RECEIVED },
        {
          currentStatus: OrderLogStatus.SENT,
          executions: { none: {} },
        },
      ],
    });
  });

  it("heartbeat deliverable count alinha com pull autorizado", async () => {
    vi.mocked(prisma.instruction.findMany).mockResolvedValue([
      {
        id: "a",
        purpose: InstructionPurpose.ENTRY,
        symbol: "PETR4",
        side: "BUY",
        orderType: "MARKET",
        quantity: new Decimal(1),
        stopLoss: null,
        takeProfit: null,
        expiresAt: new Date(Date.now() + 60_000),
        idempotencyKey: "k-a",
        currentStatus: OrderLogStatus.RECEIVED,
      },
      {
        id: "b",
        purpose: InstructionPurpose.ENTRY,
        symbol: "VALE3",
        side: "BUY",
        orderType: "MARKET",
        quantity: new Decimal(1),
        stopLoss: null,
        takeProfit: null,
        expiresAt: new Date(Date.now() + 60_000),
        idempotencyKey: "k-b",
        currentStatus: OrderLogStatus.RECEIVED,
      },
    ] as never);

    const count = await countDeliverableInstructionsForEa("lic1");
    const pulled = await pullInstructionsForEa(ctx as never);
    expect(count).toBe(2);
    expect(pulled).toHaveLength(2);
  });

  it("SENT bloqueada por política não conta como entregável", async () => {
    const { LicensePolicyError } = await import(
      "@/lib/licensing/instruction-policy"
    );
    vi.mocked(assertInstructionAllowed).mockRejectedValue(
      new LicensePolicyError("Novas entradas bloqueadas", "NEW_ENTRIES_BLOCKED")
    );

    vi.mocked(prisma.instruction.findMany).mockResolvedValue([
      {
        id: "inst-blocked",
        purpose: InstructionPurpose.ENTRY,
        symbol: "PETR4",
        side: "BUY",
        orderType: "MARKET",
        quantity: new Decimal(100),
        stopLoss: null,
        takeProfit: null,
        expiresAt: new Date(Date.now() + 60_000),
        idempotencyKey: "k-blocked",
        currentStatus: OrderLogStatus.SENT,
      },
    ] as never);

    const audit = await auditDeliverableInstructionsForEa("lic1");
    const pulled = await pullInstructionsForEa(ctx as never);

    expect(audit.deliverableCount).toBe(0);
    expect(audit.skipped).toHaveLength(1);
    expect(pulled).toHaveLength(0);
    expect(prisma.instructionStatusLog.create).toHaveBeenCalled();
  });
});

describe("Licença vencida — pull de saída", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertInstructionAllowed).mockResolvedValue(undefined);
  });

  it("entrega instrução EXIT mesmo com política de entrada bloqueada", async () => {
    const { LicensePolicyError } = await import(
      "@/lib/licensing/instruction-policy"
    );
    vi.mocked(assertInstructionAllowed).mockImplementation(
      async (_licenseId, purpose) => {
        if (purpose === InstructionPurpose.ENTRY) {
          throw new LicensePolicyError("Bloqueado", "NEW_ENTRIES_BLOCKED");
        }
      }
    );

    vi.mocked(prisma.instruction.findMany).mockResolvedValue([
      {
        id: "inst-entry",
        purpose: InstructionPurpose.ENTRY,
        symbol: "PETR4",
        side: "BUY",
        orderType: "MARKET",
        quantity: new Decimal(100),
        stopLoss: null,
        takeProfit: null,
        expiresAt: new Date(Date.now() + 60_000),
        idempotencyKey: "k1",
        currentStatus: OrderLogStatus.RECEIVED,
      },
      {
        id: "inst-exit",
        purpose: InstructionPurpose.EXIT,
        symbol: "PETR4",
        side: "SELL",
        orderType: "MARKET",
        quantity: new Decimal(100),
        stopLoss: null,
        takeProfit: null,
        expiresAt: new Date(Date.now() + 60_000),
        idempotencyKey: "k2",
        currentStatus: OrderLogStatus.RECEIVED,
      },
    ] as never);

    const result = await pullInstructionsForEa(ctx as never);
    expect(result).toHaveLength(1);
    expect(result[0].purpose).toBe(InstructionPurpose.EXIT);
  });
});
