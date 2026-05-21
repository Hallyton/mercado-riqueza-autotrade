import { afterEach, describe, expect, it, vi } from "vitest";

const ENV_BACKUP = { ...process.env };

function restoreEnv() {
  process.env = { ...ENV_BACKUP };
}

describe("critical env — produção", () => {
  afterEach(() => {
    restoreEnv();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("falha no boot sem BILLING_WEBHOOK_SECRET", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/test");
    vi.stubEnv("AUTH_SECRET", "production-auth-secret-min-32-chars");
    delete process.env.BILLING_WEBHOOK_SECRET;

    const { assertCriticalEnvAtStartup } = await import("@/lib/env/critical");

    expect(() => assertCriticalEnvAtStartup()).toThrow(
      /BILLING_WEBHOOK_SECRET/
    );
  });

  it("falha no boot com placeholder de BILLING_WEBHOOK_SECRET", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/test");
    vi.stubEnv("AUTH_SECRET", "production-auth-secret-min-32-chars");
    vi.stubEnv("BILLING_WEBHOOK_SECRET", "replace-with-webhook-secret");

    const { assertCriticalEnvAtStartup } = await import("@/lib/env/critical");

    expect(() => assertCriticalEnvAtStartup()).toThrow(
      /BILLING_WEBHOOK_SECRET/
    );
  });

  it("passa no boot com envs válidas", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/test");
    vi.stubEnv("AUTH_SECRET", "production-auth-secret-min-32-chars");
    vi.stubEnv("BILLING_WEBHOOK_SECRET", "whsec_live_test_secret");

    const { assertCriticalEnvAtStartup } = await import("@/lib/env/critical");

    expect(() => assertCriticalEnvAtStartup()).not.toThrow();
  });
});

describe("verifyBillingWebhookRequest", () => {
  afterEach(() => {
    restoreEnv();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("em produção sem secret retorna WEBHOOK_MISCONFIGURED", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/test");
    vi.stubEnv("AUTH_SECRET", "production-auth-secret-min-32-chars");
    delete process.env.BILLING_WEBHOOK_SECRET;

    const { verifyBillingWebhookRequest } = await import("@/lib/env/critical");
    const req = new Request("http://localhost/api/webhooks/billing", {
      method: "POST",
    });

    expect(verifyBillingWebhookRequest(req)).toEqual({
      ok: false,
      code: "WEBHOOK_MISCONFIGURED",
    });
  });

  it("em desenvolvimento sem secret aceita requisição", async () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.BILLING_WEBHOOK_SECRET;

    const { verifyBillingWebhookRequest } = await import("@/lib/env/critical");
    const req = new Request("http://localhost/api/webhooks/billing", {
      method: "POST",
    });

    expect(verifyBillingWebhookRequest(req)).toEqual({ ok: true });
  });

  it("com secret exige header correto", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BILLING_WEBHOOK_SECRET", "whsec_dev");

    const { verifyBillingWebhookRequest } = await import("@/lib/env/critical");

    const bad = new Request("http://localhost/api/webhooks/billing", {
      method: "POST",
    });
    expect(verifyBillingWebhookRequest(bad)).toEqual({
      ok: false,
      code: "WEBHOOK_UNAUTHORIZED",
    });

    const good = new Request("http://localhost/api/webhooks/billing", {
      method: "POST",
      headers: { "x-webhook-secret": "whsec_dev" },
    });
    expect(verifyBillingWebhookRequest(good)).toEqual({ ok: true });
  });
});
