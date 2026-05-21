import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";

const { auditCreate } = vi.hoisted(() => ({
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/audit/log", () => ({
  createAuditLog: auditCreate,
}));

import {
  buildEaRateLimitKey,
  checkEaRateLimit,
  rateLimitProblemResponse,
  recordEaRateLimitBlocked,
  resetEaRateLimitStoreForTests,
} from "@/lib/ea/rate-limit";

function makeRequest(
  path: string,
  init?: { ip?: string; deviceId?: string }
): Request {
  const headers = new Headers();
  if (init?.ip) headers.set("x-forwarded-for", init.ip);
  if (init?.deviceId) headers.set("x-device-id", init.deviceId);
  return new Request(`http://localhost${path}`, { method: "POST", headers });
}

describe("checkEaRateLimit", () => {
  beforeEach(() => {
    resetEaRateLimitStoreForTests();
    vi.clearAllMocks();
    delete process.env.EA_RATE_LIMIT_ACTIVATE_MAX;
  });

  afterEach(() => {
    resetEaRateLimitStoreForTests();
  });

  it("bloqueia activate após exceder limite por IP", () => {
    const req = makeRequest("/api/v1/ea/activate", { ip: "203.0.113.10" });

    for (let i = 0; i < 10; i++) {
      const r = checkEaRateLimit(req, "activate");
      expect(r.allowed).toBe(true);
    }

    const blocked = checkEaRateLimit(req, "activate");
    expect(blocked.allowed).toBe(false);
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

  it("retorna problem+json 429 com Retry-After", async () => {
    const req = makeRequest("/api/v1/ea/activate", { ip: "203.0.113.99" });
    for (let i = 0; i < 10; i++) {
      checkEaRateLimit(req, "activate");
    }
    const blocked = checkEaRateLimit(req, "activate");
    const res = rateLimitProblemResponse(blocked);

    expect(res.status).toBe(429);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
    expect(res.headers.get("Retry-After")).toBeTruthy();

    const body = await res.json();
    expect(body.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(body.status).toBe(429);
  });

  it("registra audit log ao bloquear", async () => {
    const req = makeRequest("/api/v1/ea/activate", { ip: "203.0.113.55" });
    for (let i = 0; i < 10; i++) {
      checkEaRateLimit(req, "activate");
    }
    const blocked = checkEaRateLimit(req, "activate");
    await recordEaRateLimitBlocked(req, blocked);

    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ea.rate_limit_exceeded",
        entityType: "ea_rate_limit",
      })
    );
  });
});
