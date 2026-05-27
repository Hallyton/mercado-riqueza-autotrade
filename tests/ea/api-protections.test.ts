import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LicenseStatus, OrderLogStatus } from "@prisma/client";
import {
  REAL_TRADING_DISABLED_CODE,
  REAL_TRADING_DISABLED_REASON,
} from "@/lib/risk/real-trading-guard";

const {
  routeCtx,
  assertLicenseUsable,
  assertMt5AccountAuthorized,
  assertDemoAllowed,
  assertSubscriptionActive,
  processHeartbeat,
  buildEaConfigResponse,
  evaluateEaRealTradingGuard,
  pullInstructionsForEa,
  auditDeliverableInstructionsForEa,
  reportExecution,
} = vi.hoisted(() => ({
  routeCtx: {
    device: {
      id: "dev-route",
      deviceId: "mt5-route",
      licenseId: "lic-route",
      lastSeenAt: new Date("2026-05-26T20:00:00.000Z"),
    },
    license: {
      id: "lic-route",
      userId: "user-route",
      status: "ACTIVE",
      mt5Account: { login: "52609973", server: "XPMT5-DEMO" },
      subscription: {
        status: "ACTIVE",
        plan: { allowDemo: true },
      },
      exposureProfile: { slug: "conservador", name: "Conservador" },
    },
    requestId: "req-route",
    deviceIdHeader: "mt5-route",
    eaVersion: "1.0.0",
  },
  assertLicenseUsable: vi.fn(),
  assertMt5AccountAuthorized: vi.fn(),
  assertDemoAllowed: vi.fn(),
  assertSubscriptionActive: vi.fn(),
  processHeartbeat: vi.fn(),
  buildEaConfigResponse: vi.fn(),
  evaluateEaRealTradingGuard: vi.fn(),
  pullInstructionsForEa: vi.fn(),
  auditDeliverableInstructionsForEa: vi.fn(),
  reportExecution: vi.fn(),
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
  assertDemoAllowed,
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

vi.mock("@/lib/ea/heartbeat", () => ({
  processHeartbeat,
}));

vi.mock("@/lib/ea/config", () => ({
  buildEaConfigResponse,
}));

vi.mock("@/lib/ea/instructions", () => ({
  evaluateEaRealTradingGuard,
  pullInstructionsForEa,
  auditDeliverableInstructionsForEa,
  reportExecution,
}));

import { POST as heartbeatPost } from "@/app/api/v1/ea/heartbeat/route";
import { GET as configGet } from "@/app/api/v1/ea/config/route";
import { GET as instructionsGet } from "@/app/api/v1/ea/instructions/route";
import { POST as executionsPost } from "@/app/api/v1/ea/executions/route";

const SENSITIVE_VALUES = [
  "AUTH_SECRET",
  "MASTER_EA_API_SECRET",
  "DATABASE_URL",
  "auth-secret-test",
  "master-secret-test",
  "postgres://secret-url",
  "raw-device-token",
];

async function responseText(response: Response): Promise<string> {
  return await response.text();
}

function expectNoSecrets(text: string) {
  for (const value of SENSITIVE_VALUES) {
    expect(text).not.toContain(value);
  }
}

describe("auditoria das rotas /api/v1/ea", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = "auth-secret-test";
    process.env.MASTER_EA_API_SECRET = "master-secret-test";
    process.env.DATABASE_URL = "postgres://secret-url";

    assertSubscriptionActive.mockReturnValue(undefined);
    evaluateEaRealTradingGuard.mockResolvedValue({ allowed: true });
    auditDeliverableInstructionsForEa.mockResolvedValue({
      candidateCount: 0,
      deliverableCount: 0,
      skipped: [],
    });
    pullInstructionsForEa.mockResolvedValue([]);
    processHeartbeat.mockResolvedValue({
      server_time: "2026-05-26T20:00:00.000Z",
      pending_instructions: 0,
      halt_new_entries: false,
      halt_all_trading: false,
      can_accept_new_entries: true,
      can_manage_open_positions: true,
    });
    buildEaConfigResponse.mockResolvedValue({
      min_ea_version: "1.0.0",
      heartbeat_interval_sec: 30,
      license_id: "lic-route",
      license_status: LicenseStatus.ACTIVE,
      halt_new_entries: false,
      halt_all_trading: false,
      can_accept_new_entries: true,
      can_manage_open_positions: true,
      mt5_account: { login: "52609973", server: "XPMT5-DEMO" },
      exposure_profile: { slug: "conservador", name: "Conservador" },
      ea_online: true,
      last_seen_at: "2026-05-26T20:00:00.000Z",
    });
    reportExecution.mockResolvedValue({
      ok: true,
      orderStatus: OrderLogStatus.EXECUTED,
    });
  });

  afterEach(() => {
    delete process.env.AUTH_SECRET;
    delete process.env.MASTER_EA_API_SECRET;
    delete process.env.DATABASE_URL;
  });

  it("heartbeat válido valida licença, MT5, demo e responde sem secrets", async () => {
    const response = await heartbeatPost(
      new Request("http://localhost/api/v1/ea/heartbeat", {
        method: "POST",
        body: JSON.stringify({
          login: "52609973",
          server: "XPMT5-DEMO",
          trade_mode: "DEMO",
          ea_status: "ONLINE",
          equity: 100000,
          balance: 100000,
          pending_orders: [],
          open_positions: [],
        }),
      })
    );
    const text = await responseText(response);

    expect(response.status).toBe(200);
    expect(assertLicenseUsable).toHaveBeenCalledWith(routeCtx);
    expect(assertMt5AccountAuthorized).toHaveBeenCalledWith(
      routeCtx,
      "52609973",
      "XPMT5-DEMO"
    );
    expect(assertDemoAllowed).toHaveBeenCalledWith(routeCtx, "DEMO");
    expect(processHeartbeat).toHaveBeenCalledOnce();
    expect(text).toContain("pending_instructions");
    expectNoSecrets(text);
  });

  it("heartbeat inválido rejeita payload antes de processar", async () => {
    const response = await heartbeatPost(
      new Request("http://localhost/api/v1/ea/heartbeat", {
        method: "POST",
        body: JSON.stringify({
          login: "",
          server: "XPMT5-DEMO",
          equity: 100000,
          balance: 100000,
        }),
      })
    );
    const text = await responseText(response);

    expect(response.status).toBe(400);
    expect(processHeartbeat).not.toHaveBeenCalled();
    expect(text).toContain("VALIDATION_ERROR");
    expectNoSecrets(text);
  });

  it("config de licença ativa retorna flags operacionais sem secrets", async () => {
    const response = await configGet(
      new Request("http://localhost/api/v1/ea/config", { method: "GET" })
    );
    const text = await responseText(response);
    const body = JSON.parse(text);

    expect(response.status).toBe(200);
    expect(assertLicenseUsable).toHaveBeenCalledWith(routeCtx);
    expect(body.license_id).toBe("lic-route");
    expect(body.can_accept_new_entries).toBe(true);
    expect(body).not.toHaveProperty("device_token");
    expectNoSecrets(text);
  });

  it("config reflete assinatura/licença sem permissão para novas entradas", async () => {
    buildEaConfigResponse.mockResolvedValue({
      license_id: "lic-route",
      license_status: LicenseStatus.SUSPENDED,
      halt_new_entries: true,
      halt_all_trading: false,
      can_accept_new_entries: false,
      can_manage_open_positions: true,
    });

    const response = await configGet(
      new Request("http://localhost/api/v1/ea/config", { method: "GET" })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.can_accept_new_entries).toBe(false);
    expect(body.can_manage_open_positions).toBe(true);
  });

  it("pull instructions válido em DEMO entrega instruction", async () => {
    pullInstructionsForEa.mockResolvedValue([
      {
        instruction_id: "inst-demo",
        purpose: "ENTRY",
        symbol: "WDOM26",
        side: "BUY",
        order_type: "MARKET",
        quantity: 1,
        stop_loss: null,
        take_profit: null,
        expires_at: "2026-05-26T20:05:00.000Z",
        idempotency_key: "idem-demo",
      },
    ]);

    const response = await instructionsGet(
      new Request(
        "http://localhost/api/v1/ea/instructions?login=52609973&server=XPMT5-DEMO",
        { method: "GET" }
      )
    );
    const text = await responseText(response);
    const body = JSON.parse(text);

    expect(response.status).toBe(200);
    expect(assertSubscriptionActive).toHaveBeenCalledWith(routeCtx);
    expect(body.instructions).toHaveLength(1);
    expect(body.real_trading_blocked).toBeUndefined();
    expectNoSecrets(text);
  });

  it("pull instructions bloqueado em REAL não entrega instruction", async () => {
    const guardDecision = {
      allowed: false,
      code: REAL_TRADING_DISABLED_CODE,
      reason: REAL_TRADING_DISABLED_REASON,
    };
    evaluateEaRealTradingGuard.mockResolvedValue(guardDecision);
    pullInstructionsForEa.mockResolvedValue([]);

    const response = await instructionsGet(
      new Request(
        "http://localhost/api/v1/ea/instructions?login=52609973&server=XPMT5-DEMO",
        { method: "GET" }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.instructions).toEqual([]);
    expect(body.real_trading_blocked).toBe(true);
    expect(body.block_reason).toBe(REAL_TRADING_DISABLED_CODE);
    expect(pullInstructionsForEa).toHaveBeenCalledWith(routeCtx, {
      realTradingGuard: guardDecision,
    });
  });

  it("execution report válido atualiza status sem expor secrets", async () => {
    const response = await executionsPost(
      new Request("http://localhost/api/v1/ea/executions", {
        method: "POST",
        body: JSON.stringify({
          instruction_id: "inst-demo",
          status: "FILLED",
          broker_ticket: "DEBUG",
          fill_price: 123.45,
          fill_quantity: 1,
          executed_at: "2026-05-26T20:00:00.000Z",
        }),
      })
    );
    const text = await responseText(response);
    const body = JSON.parse(text);

    expect(response.status).toBe(200);
    expect(reportExecution).toHaveBeenCalledOnce();
    expect(body.ok).toBe(true);
    expect(body.order_status).toBe(OrderLogStatus.EXECUTED);
    expectNoSecrets(text);
  });

  it("execution report inválido é rejeitado antes de mutação", async () => {
    const response = await executionsPost(
      new Request("http://localhost/api/v1/ea/executions", {
        method: "POST",
        body: JSON.stringify({
          instruction_id: "inst-demo",
          status: "EXECUTED",
        }),
      })
    );
    const text = await responseText(response);

    expect(response.status).toBe(400);
    expect(reportExecution).not.toHaveBeenCalled();
    expect(text).toContain("VALIDATION_ERROR");
    expectNoSecrets(text);
  });
});
