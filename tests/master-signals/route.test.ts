import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MasterSignalStatus } from "@prisma/client";

const {
  masterFindUnique,
  masterCreate,
  dispatchCreate,
  instructionCreate,
} = vi.hoisted(() => ({
  masterFindUnique: vi.fn(),
  masterCreate: vi.fn(),
  dispatchCreate: vi.fn(),
  instructionCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    masterSignal: {
      findUnique: masterFindUnique,
      create: masterCreate,
    },
    masterSignalDispatch: { create: dispatchCreate },
    instruction: { create: instructionCreate },
  },
}));

import { POST } from "@/app/api/master/signals/route";

const SECRET = "test-master-secret-do-not-log";

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    master_signal_id: "msig-route-001",
    source: "MASTER_EA",
    symbol: "WDOM26",
    side: "BUY",
    order_type: "MARKET",
    purpose: "ENTRY",
    profile: "start",
    expires_in_seconds: 60,
    idempotency_key: "idem-route-001",
    ...overrides,
  };
}

function makeRequest(
  body: unknown,
  headers: Record<string, string> = {}
): Request {
  const h = new Headers({
    "content-type": "application/json",
    Authorization: `Bearer ${SECRET}`,
    ...headers,
  });
  return new Request("http://localhost/api/master/signals", {
    method: "POST",
    headers: h,
    body: JSON.stringify(body),
  });
}

function existingRow(overrides: Record<string, unknown> = {}) {
  const {
    rawPayloadRedacted: rawOverride,
    expiresAt: expiresAtOverride,
    ...rowOverrides
  } = overrides;

  return {
    id: "row-1",
    masterSignalId: "msig-route-001",
    idempotencyKey: "idem-route-001",
    source: "MASTER_EA",
    symbol: "WDOM26",
    side: "BUY",
    orderType: "MARKET",
    purpose: "ENTRY",
    profileSlug: "start",
    status: MasterSignalStatus.VALIDATED,
    expiresAt:
      expiresAtOverride !== undefined
        ? expiresAtOverride
        : new Date(Date.now() - 120_000),
    rawPayloadRedacted: {
      master_signal_id: "msig-route-001",
      source: "MASTER_EA",
      symbol: "WDOM26",
      side: "BUY",
      order_type: "MARKET",
      purpose: "ENTRY",
      profile: "start",
      expires_in_seconds: 60,
      idempotency_key: "idem-route-001",
      ...(typeof rawOverride === "object" && rawOverride !== null ? rawOverride : {}),
    },
    ...rowOverrides,
  };
}

describe("POST /api/master/signals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MASTER_EA_API_SECRET = SECRET;
    masterFindUnique.mockResolvedValue(null);
    masterCreate.mockImplementation(async ({ data }) => ({
      id: "new-row",
      masterSignalId: data.masterSignalId,
      status: data.status,
    }));
  });

  afterEach(() => {
    delete process.env.MASTER_EA_API_SECRET;
    delete process.env.AUTH_SECRET;
  });

  it("1) retorna 503 se MASTER_EA_API_SECRET ausente", async () => {
    delete process.env.MASTER_EA_API_SECRET;
    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("MASTER_SECRET_NOT_CONFIGURED");
  });

  it("2) retorna 401 se Authorization ausente", async () => {
    const res = await POST(
      new Request("http://localhost/api/master/signals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validPayload()),
      })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("MASTER_AUTH_REQUIRED");
    expect(masterCreate).not.toHaveBeenCalled();
    expect(dispatchCreate).not.toHaveBeenCalled();
    expect(instructionCreate).not.toHaveBeenCalled();
  });

  it("3) retorna 401 se secret inválido", async () => {
    const res = await POST(makeRequest(validPayload(), { Authorization: "Bearer wrong" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("MASTER_AUTH_INVALID");
  });

  it("4) aceita Authorization Bearer válido", async () => {
    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.master_signal_id).toBe("msig-route-001");
  });

  it("5) aceita X-Master-EA-Secret válido", async () => {
    const res = await POST(
      makeRequest(validPayload(), {
        Authorization: "",
        "X-Master-EA-Secret": SECRET,
      })
    );
    expect(res.status).toBe(201);
  });

  it("6) rejeita payload inválido", async () => {
    const res = await POST(makeRequest({ ...validPayload(), side: "LONG" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(masterCreate).not.toHaveBeenCalled();
    expect(dispatchCreate).not.toHaveBeenCalled();
    expect(instructionCreate).not.toHaveBeenCalled();
  });

  it("7) cria MasterSignal válido", async () => {
    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(201);
    expect(masterCreate).toHaveBeenCalledTimes(1);
    expect(masterCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          masterSignalId: "msig-route-001",
          status: MasterSignalStatus.VALIDATED,
          symbol: "WDOM26",
        }),
      })
    );
  });

  it("8) não cria dispatch", async () => {
    await POST(makeRequest(validPayload()));
    expect(dispatchCreate).not.toHaveBeenCalled();
  });

  it("9) não cria instruction", async () => {
    await POST(makeRequest(validPayload()));
    expect(instructionCreate).not.toHaveBeenCalled();
  });

  it("10) retry idempotente retorna 200", async () => {
    masterFindUnique.mockImplementation(async ({ where }) => {
      if ("masterSignalId" in where && where.masterSignalId === "msig-route-001") {
        return existingRow();
      }
      if ("idempotencyKey" in where && where.idempotencyKey === "idem-route-001") {
        return existingRow();
      }
      return null;
    });

    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.idempotent).toBe(true);
    expect(masterCreate).not.toHaveBeenCalled();
  });

  it("11) idempotency_key igual com payload diferente retorna 409", async () => {
    masterFindUnique.mockImplementation(async ({ where }) => {
      if ("idempotencyKey" in where && where.idempotencyKey === "idem-route-001") {
        return existingRow({ symbol: "PETR4" });
      }
      return null;
    });

    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("MASTER_SIGNAL_CONFLICT");
  });

  it("12) master_signal_id igual com payload diferente retorna 409", async () => {
    masterFindUnique.mockImplementation(async ({ where }) => {
      if ("masterSignalId" in where && where.masterSignalId === "msig-route-001") {
        return existingRow({ idempotencyKey: "idem-other", symbol: "PETR4" });
      }
      return null;
    });

    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(409);
  });

  it("13) rawPayloadRedacted não contém token/secret/strategy", async () => {
    await POST(
      makeRequest({
        ...validPayload(),
        api_token: "leak",
        nested: { strategy_name: "hidden" },
        note: "ok",
      })
    );
    const createArg = masterCreate.mock.calls[0][0];
    const redacted = JSON.stringify(createArg.data.rawPayloadRedacted);
    expect(redacted).not.toContain("leak");
    expect(redacted).not.toContain("strategy_name");
    expect(redacted).not.toContain("api_token");
    expect(redacted).toContain("note");
  });

  it("14) não expõe secret em resposta", async () => {
    process.env.AUTH_SECRET = "test-auth-secret-do-not-log";
    const res = await POST(makeRequest(validPayload()));
    const text = await res.text();
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("test-auth-secret-do-not-log");
    expect(text).not.toContain("MASTER_EA_API_SECRET");
    expect(text).not.toContain("AUTH_SECRET");
    delete process.env.AUTH_SECRET;
  });

  it("15) retorna dispatch NOT_STARTED", async () => {
    const res = await POST(makeRequest(validPayload()));
    const body = await res.json();
    expect(body.dispatch).toBe("NOT_STARTED");
  });

  it("16) retry do mesmo payload com expires_in_seconds retorna 200 idempotent:true", async () => {
    masterFindUnique.mockImplementation(async ({ where }) => {
      if ("masterSignalId" in where && where.masterSignalId === "msig-route-001") {
        return existingRow();
      }
      if ("idempotencyKey" in where && where.idempotencyKey === "idem-route-001") {
        return existingRow();
      }
      return null;
    });

    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.idempotent).toBe(true);
    expect(body.ok).toBe(true);
    expect(masterCreate).not.toHaveBeenCalled();
  });

  it("17) retry não falha por expiresAt recalculado no servidor", async () => {
    masterFindUnique.mockImplementation(async ({ where }) => {
      if ("masterSignalId" in where || "idempotencyKey" in where) {
        return existingRow({
          expiresAt: new Date(Date.now() + 999_999),
          rawPayloadRedacted: { expires_in_seconds: 60 },
        });
      }
      return null;
    });

    const res = await POST(makeRequest(validPayload({ expires_in_seconds: 60 })));
    expect(res.status).toBe(200);
    expect((await res.json()).idempotent).toBe(true);
    expect(masterCreate).not.toHaveBeenCalled();
  });

  it("18) mesmo idempotency_key com side diferente retorna 409", async () => {
    masterFindUnique.mockImplementation(async ({ where }) => {
      if ("idempotencyKey" in where && where.idempotencyKey === "idem-route-001") {
        return existingRow({ side: "SELL" });
      }
      return null;
    });

    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("MASTER_SIGNAL_CONFLICT");
  });

  it("19) mesmo master_signal_id com payload de negócio diferente retorna 409", async () => {
    masterFindUnique.mockImplementation(async ({ where }) => {
      if ("masterSignalId" in where && where.masterSignalId === "msig-route-001") {
        return existingRow({
          symbol: "PETR4",
          rawPayloadRedacted: { expires_in_seconds: 60, symbol: "PETR4" },
        });
      }
      return null;
    });

    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(409);
  });

  it("20) retorno idempotente mantém dispatch NOT_STARTED", async () => {
    masterFindUnique.mockImplementation(async () => existingRow());

    const res = await POST(makeRequest(validPayload()));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.idempotent).toBe(true);
    expect(body.dispatch).toBe("NOT_STARTED");
  });

  it("20b) retry idempotente preserva status DISPATCHED existente sem novo dispatch", async () => {
    masterFindUnique.mockImplementation(async () =>
      existingRow({ status: MasterSignalStatus.DISPATCHED })
    );

    const res = await POST(makeRequest(validPayload()));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.idempotent).toBe(true);
    expect(body.status).toBe(MasterSignalStatus.DISPATCHED);
    expect(body.dispatch).toBe("NOT_STARTED");
    expect(masterCreate).not.toHaveBeenCalled();
    expect(dispatchCreate).not.toHaveBeenCalled();
    expect(instructionCreate).not.toHaveBeenCalled();
  });

  it("21) retry idempotente não cria MasterSignalDispatch", async () => {
    masterFindUnique.mockImplementation(async () => existingRow());
    await POST(makeRequest(validPayload()));
    expect(dispatchCreate).not.toHaveBeenCalled();
  });

  it("22) retry idempotente não cria Instruction", async () => {
    masterFindUnique.mockImplementation(async () => existingRow());
    await POST(makeRequest(validPayload()));
    expect(instructionCreate).not.toHaveBeenCalled();
  });
});
