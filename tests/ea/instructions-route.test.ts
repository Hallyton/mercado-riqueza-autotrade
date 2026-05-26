import { beforeEach, describe, expect, it, vi } from "vitest";
import { InstructionPurpose } from "@prisma/client";
import {
  REAL_TRADING_DISABLED_CODE,
  REAL_TRADING_DISABLED_REASON,
} from "@/lib/risk/real-trading-guard";

const {
  routeCtx,
  pullInstructionsForEa,
  evaluateEaRealTradingGuard,
  auditDeliverableInstructionsForEa,
  assertLicenseUsable,
  assertMt5AccountAuthorized,
  assertSubscriptionActive,
} = vi.hoisted(() => ({
  routeCtx: {
    device: { id: "dev-1", deviceId: "mt5-1", licenseId: "lic-route" },
    license: {
      id: "lic-route",
      userId: "user-route",
      mt5Account: { login: "123", server: "Broker-Demo" },
      subscription: { status: "ACTIVE" },
    },
    requestId: "req-route",
    deviceIdHeader: "mt5-1",
    eaVersion: "1.0.0",
  },
  pullInstructionsForEa: vi.fn(),
  evaluateEaRealTradingGuard: vi.fn(),
  auditDeliverableInstructionsForEa: vi.fn(),
  assertLicenseUsable: vi.fn(),
  assertMt5AccountAuthorized: vi.fn(),
  assertSubscriptionActive: vi.fn(),
}));

vi.mock("@/lib/ea/handler", () => ({
  withEaAuth:
    (handler: (ctx: typeof routeCtx, request: Request) => Promise<Response>) =>
    async (request: Request) =>
      handler(routeCtx, request),
}));

vi.mock("@/lib/ea/auth", () => ({
  assertLicenseUsable,
  assertMt5AccountAuthorized,
  assertSubscriptionActive,
  EaAuthError: class EaAuthError extends Error {
    constructor(
      message: string,
      public readonly code: string,
      public readonly status: number
    ) {
      super(message);
    }
  },
}));

vi.mock("@/lib/ea/instructions", () => ({
  pullInstructionsForEa,
  evaluateEaRealTradingGuard,
  auditDeliverableInstructionsForEa,
}));

import { GET } from "@/app/api/v1/ea/instructions/route";

describe("GET /api/v1/ea/instructions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    evaluateEaRealTradingGuard.mockResolvedValue({ allowed: true });
    pullInstructionsForEa.mockResolvedValue([]);
    auditDeliverableInstructionsForEa.mockResolvedValue({
      candidateCount: 0,
      deliverableCount: 0,
      skipped: [],
    });
  });

  it("retorna HTTP 200 com instructions vazias quando Real Trading Guard bloqueia REAL", async () => {
    const guardDecision = {
      allowed: false,
      code: REAL_TRADING_DISABLED_CODE,
      reason: REAL_TRADING_DISABLED_REASON,
    };
    evaluateEaRealTradingGuard.mockResolvedValue(guardDecision);
    pullInstructionsForEa.mockResolvedValue([]);

    const response = await GET(
      new Request("http://localhost/api/v1/ea/instructions?login=123&server=Broker-Demo")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.instructions).toEqual([]);
    expect(body.subscription_active).toBe(true);
    expect(body.real_trading_blocked).toBe(true);
    expect(body.block_reason).toBe(REAL_TRADING_DISABLED_CODE);
    expect(pullInstructionsForEa).toHaveBeenCalledWith(routeCtx, {
      realTradingGuard: guardDecision,
    });
  });

  it("entrega instructions normalmente quando o guard permite DEMO", async () => {
    pullInstructionsForEa.mockResolvedValue([
      {
        instruction_id: "inst-demo",
        purpose: InstructionPurpose.ENTRY,
        symbol: "WDOM26",
        side: "BUY",
        order_type: "MARKET",
        quantity: 1,
        stop_loss: null,
        take_profit: null,
        expires_at: "2026-05-20T18:00:00.000Z",
        idempotency_key: "idem-demo",
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/v1/ea/instructions?login=123&server=Broker-Demo")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.instructions).toHaveLength(1);
    expect(body.instructions[0].instruction_id).toBe("inst-demo");
    expect(body.real_trading_blocked).toBeUndefined();
  });
});
