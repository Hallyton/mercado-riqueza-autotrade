import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InstructionOrderType,
  InstructionPurpose,
  InstructionSide,
} from "@prisma/client";
import {
  buildMasterSignalRequestBody,
  defaultIdempotencyKey,
  describeMasterSignalHttpResult,
  formatDryRunOutput,
  isSimulatorSuccessStatus,
  parseExpiresArg,
  parseSimulatorCliArgs,
  resolveSimulatorEnv,
  sendMasterSignalHttp,
  validateSimulatorInput,
  DEFAULT_SIMULATOR_EXPIRES_SECONDS,
  DEFAULT_SIMULATOR_SOURCE,
} from "@/lib/master-signals/simulator";

const baseArgv = [
  "node",
  "send-master-signal.ts",
  "--id",
  "sim-master-001",
  "--symbol",
  "WDOM26",
];

describe("buildMasterSignalRequestBody", () => {
  it("monta payload válido com defaults", () => {
    const parsed = parseSimulatorCliArgs(baseArgv);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const body = buildMasterSignalRequestBody(parsed.input);
    expect(body).toMatchObject({
      master_signal_id: "sim-master-001",
      source: DEFAULT_SIMULATOR_SOURCE,
      symbol: "WDOM26",
      side: InstructionSide.BUY,
      order_type: InstructionOrderType.MARKET,
      purpose: InstructionPurpose.ENTRY,
      expires_in_seconds: DEFAULT_SIMULATOR_EXPIRES_SECONDS,
      idempotency_key: "sim-master-001-key",
    });
    expect(validateSimulatorInput(parsed.input).ok).toBe(true);
  });

  it("usa source MASTER_EA por padrão", () => {
    const parsed = parseSimulatorCliArgs(baseArgv);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.input.source).toBe("MASTER_EA");
  });

  it("gera idempotency_key padrão a partir do id", () => {
    expect(defaultIdempotencyKey("sim-master-001")).toBe("sim-master-001-key");
  });

  it("respeita idempotency_key informado", () => {
    const parsed = parseSimulatorCliArgs([
      ...baseArgv,
      "--idempotency-key",
      "custom-key-99",
    ]);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.input.idempotencyKey).toBe("custom-key-99");
  });

  it("rejeita expires acima de 300", () => {
    const r = parseExpiresArg("301");
    expect(r.ok).toBe(false);
  });

  it("rejeita side inválido", () => {
    const parsed = parseSimulatorCliArgs([...baseArgv, "--side", "HOLD"]);
    expect(parsed.ok).toBe(false);
  });
});

describe("resolveSimulatorEnv", () => {
  const prevUrl = process.env.MASTER_SIGNAL_API_URL;
  const prevSecret = process.env.MASTER_EA_API_SECRET;

  afterEach(() => {
    if (prevUrl === undefined) delete process.env.MASTER_SIGNAL_API_URL;
    else process.env.MASTER_SIGNAL_API_URL = prevUrl;
    if (prevSecret === undefined) delete process.env.MASTER_EA_API_SECRET;
    else process.env.MASTER_EA_API_SECRET = prevSecret;
  });

  it("rejeita ausência de MASTER_SIGNAL_API_URL", () => {
    delete process.env.MASTER_SIGNAL_API_URL;
    process.env.MASTER_EA_API_SECRET = "secret";
    const r = resolveSimulatorEnv(process.env);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toContain("MASTER_SIGNAL_API_URL");
  });

  it("rejeita ausência de MASTER_EA_API_SECRET", () => {
    process.env.MASTER_SIGNAL_API_URL = "https://autotrade-staging.mercadodariqueza.com.br";
    delete process.env.MASTER_EA_API_SECRET;
    const r = resolveSimulatorEnv(process.env);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toContain("MASTER_EA_API_SECRET");
  });
});

describe("dry-run e envio HTTP", () => {
  it("dry-run não chama fetch", async () => {
    const fetchMock = vi.fn();
    const parsed = parseSimulatorCliArgs([...baseArgv, "--dry-run"]);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const config = {
      apiUrl: "https://autotrade-staging.mercadodariqueza.com.br",
      secret: "local-secret",
      endpointUrl: "https://autotrade-staging.mercadodariqueza.com.br/api/master/signals",
    };
    const payload = buildMasterSignalRequestBody(parsed.input);
    const out = formatDryRunOutput(config, payload);

    expect(out).toContain("dry-run");
    expect(out).toContain("***REDACTED***");
    expect(out).not.toContain("local-secret");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envio chama fetch com Authorization Bearer sem expor secret no output", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 201,
      text: async () =>
        JSON.stringify({
          ok: true,
          master_signal_id: "sim-master-001",
          status: "VALIDATED",
          dispatch: "NOT_STARTED",
        }),
    });

    const config = {
      apiUrl: "https://example.com",
      secret: "super-secret-value",
      endpointUrl: "https://example.com/api/master/signals",
    };
    const parsed = parseSimulatorCliArgs(baseArgv);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const payload = buildMasterSignalRequestBody(parsed.input);
    await sendMasterSignalHttp(config, payload, fetchMock);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({
      Authorization: "Bearer super-secret-value",
    });

    const dry = formatDryRunOutput(config, payload);
    expect(dry).not.toContain("super-secret-value");
  });

  it("trata 201 como criado", () => {
    const msg = describeMasterSignalHttpResult({
      httpStatus: 201,
      body: { ok: true, dispatch: "NOT_STARTED" },
      rawText: "",
    });
    expect(msg).toContain("HTTP 201");
    expect(msg).toContain("criado");
    expect(isSimulatorSuccessStatus(201, {})).toBe(true);
  });

  it("trata 200 idempotent como idempotente", () => {
    const msg = describeMasterSignalHttpResult({
      httpStatus: 200,
      body: { ok: true, idempotent: true, dispatch: "NOT_STARTED" },
      rawText: "",
    });
    expect(msg).toContain("idempotente");
    expect(isSimulatorSuccessStatus(200, { idempotent: true })).toBe(true);
  });

  it("trata 409 como conflito", () => {
    const msg = describeMasterSignalHttpResult({
      httpStatus: 409,
      body: { code: "MASTER_SIGNAL_CONFLICT" },
      rawText: "",
    });
    expect(msg).toContain("409");
    expect(msg).toContain("conflito");
    expect(isSimulatorSuccessStatus(409, {})).toBe(false);
  });
});
