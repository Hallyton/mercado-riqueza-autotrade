import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";

const { auditCreate } = vi.hoisted(() => ({
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/audit/log", () => ({
  createAuditLog: auditCreate,
}));

import {
  applyEaRateLimitHeaders,
  buildEaRateLimitKey,
  checkEaRateLimit,
  rateLimitProblemResponse,
  recordEaRateLimitBlocked,
  resetEaRateLimitStoreForTests,
} from "@/lib/ea/rate-limit";
import { NextResponse } from "next/server";

function makeRequest(
  path: string,
  init?: { ip?: string; deviceId?: string; method?: string }
): Request {
  const headers = new Headers();
  if (init?.ip) headers.set("x-forwarded-for", init.ip);
  if (init?.deviceId) headers.set("x-device-id", init.deviceId);
  return new Request(`http://localhost${path}`, {
    method: init?.method ?? "POST",
    headers,
  });
}

function exhaustScope(
  req: Request,
  scope: Parameters<typeof checkEaRateLimit>[1],
  limit: number
) {
  for (let i = 0; i < limit; i++) {
    const r = checkEaRateLimit(req, scope);
    expect(r.allowed).toBe(true);
  }
}

describe("checkEaRateLimit", () => {
  beforeEach(() => {
    resetEaRateLimitStoreForTests();
    vi.clearAllMocks();
    delete process.env.EA_RATE_LIMIT_ACTIVATE_MAX;
    delete process.env.EA_RATE_LIMIT_CONFIG_MAX;
    delete process.env.EA_RATE_LIMIT_EXECUTIONS_MAX;
    delete process.env.EA_RATE_LIMIT_IGNORE_MAX;
  });

  afterEach(() => {
    resetEaRateLimitStoreForTests();
  });

  it("bloqueia activate após exceder limite por IP", () => {
    const req = makeRequest("/api/v1/ea/activate", { ip: "203.0.113.10" });

    exhaustScope(req, "activate", 10);

    const blocked = checkEaRateLimit(req, "activate");
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(buildEaRateLimitKey("activate", req)).toContain("203.0.113.10");
  });

  it("heartbeat usa chave IP + device", () => {
    const req = makeRequest("/api/v1/ea/heartbeat", {
      ip: "203.0.113.20",
      deviceId: "vps-001",
    });
    expect(buildEaRateLimitKey("heartbeat", req)).toBe(
      "ea:heartbeat:ip:203.0.113.20:device:vps-001"
    );
  });

  it("bloqueia config após exceder limite", () => {
    process.env.EA_RATE_LIMIT_CONFIG_MAX = "3";
    const req = makeRequest("/api/v1/ea/config", {
      ip: "203.0.113.30",
      deviceId: "vps-config",
      method: "GET",
    });

    exhaustScope(req, "config", 3);

    const blocked = checkEaRateLimit(req, "config");
    expect(blocked.allowed).toBe(false);
    expect(blocked.scope).toBe("config");
    expect(buildEaRateLimitKey("config", req)).toContain("vps-config");
  });

  it("bloqueia executions após exceder limite", () => {
    process.env.EA_RATE_LIMIT_EXECUTIONS_MAX = "2";
    const req = makeRequest("/api/v1/ea/executions", {
      ip: "203.0.113.40",
      deviceId: "vps-exec",
    });

    exhaustScope(req, "executions", 2);

    const blocked = checkEaRateLimit(req, "executions");
    expect(blocked.allowed).toBe(false);
    expect(blocked.scope).toBe("executions");
  });

  it("bloqueia ignore após exceder limite", () => {
    process.env.EA_RATE_LIMIT_IGNORE_MAX = "2";
    const req = makeRequest("/api/v1/ea/instructions/ignore", {
      ip: "203.0.113.50",
      deviceId: "vps-ignore",
    });

    exhaustScope(req, "ignore", 2);

    const blocked = checkEaRateLimit(req, "ignore");
    expect(blocked.allowed).toBe(false);
    expect(blocked.scope).toBe("ignore");
  });

  it("retorna problem+json 429 com Retry-After e X-RateLimit-*", async () => {
    const req = makeRequest("/api/v1/ea/activate", { ip: "203.0.113.99" });
    exhaustScope(req, "activate", 10);
    const blocked = checkEaRateLimit(req, "activate");
    const res = rateLimitProblemResponse(blocked);

    expect(res.status).toBe(429);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");

    const body = await res.json();
    expect(body.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(body.status).toBe(429);
  });

  it("applyEaRateLimitHeaders em resposta 200", () => {
    const res = applyEaRateLimitHeaders(
      NextResponse.json({ ok: true }),
      {
        allowed: true,
        scope: "config",
        key: "k",
        limit: 120,
        remaining: 119,
        retryAfterSec: 0,
      }
    );
    expect(res.headers.get("X-RateLimit-Limit")).toBe("120");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("119");
  });

  it("registra audit log sem contexto (activate)", async () => {
    const req = makeRequest("/api/v1/ea/activate", { ip: "203.0.113.55" });
    exhaustScope(req, "activate", 10);
    const blocked = checkEaRateLimit(req, "activate");
    await recordEaRateLimitBlocked(req, blocked);

    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ea.rate_limit_exceeded",
        entityType: "ea_rate_limit",
        actorType: "SYSTEM",
      })
    );
  });

  it("registra audit log com licença quando contexto autenticado", async () => {
    const req = makeRequest("/api/v1/ea/config", {
      ip: "203.0.113.60",
      deviceId: "vps-audit",
      method: "GET",
    });
    process.env.EA_RATE_LIMIT_CONFIG_MAX = "1";
    checkEaRateLimit(req, "config");
    const blocked = checkEaRateLimit(req, "config");

    await recordEaRateLimitBlocked(req, blocked, {
      license: { id: "lic_1", userId: "user_1" },
      device: { id: "dev_rec_1", deviceId: "vps-audit" },
    });

    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ea.rate_limit_exceeded",
        entityType: "license",
        entityId: "lic_1",
        actorType: "EA",
        actorId: "user_1",
        metadata: expect.objectContaining({
          licenseDeviceId: "vps-audit",
          deviceRecordId: "dev_rec_1",
        }),
      })
    );
  });
});
