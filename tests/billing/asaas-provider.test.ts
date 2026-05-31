import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/billing/asaas-config", () => ({
  assertAsaasChargeAllowed: vi.fn(),
  getAsaasApiKey: vi.fn(() => "sandbox_key"),
  getAsaasBaseUrl: vi.fn(() => "https://api-sandbox.asaas.com/v3"),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import {
  createAsaasCustomer,
  createAsaasPixPayment,
  getAsaasPixQrCode,
} from "@/lib/billing/asaas-client";
import { assertAsaasChargeAllowed } from "@/lib/billing/asaas-config";

describe("asaas client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "pay_123",
        customer: "cus_123",
        billingType: "PIX",
        value: 300,
        status: "PENDING",
        invoiceUrl: "https://sandbox.asaas.com/i/123",
      }),
    });
  });

  it("cria customer com externalReference", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "cus_123", email: "a@b.com" }),
    });

    await createAsaasCustomer({
      name: "Cliente",
      email: "a@b.com",
      cpfCnpj: "24971563792",
      externalReference: "user_1",
    });

    expect(assertAsaasChargeAllowed).toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0];
    expect(String(init?.headers?.access_token)).toBe("sandbox_key");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      name: "Cliente",
      email: "a@b.com",
      externalReference: "user_1",
    });
  });

  it("cria payment Pix com valor e dueDate", async () => {
    await createAsaasPixPayment({
      customerId: "cus_123",
      value: 300,
      dueDate: "2026-06-01",
      description: "Mercado da Riqueza AutoTrade — AutoTrade Single Robot",
      externalReference: "inv_1",
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      customer: "cus_123",
      billingType: "PIX",
      value: 300,
      dueDate: "2026-06-01",
      description: "Mercado da Riqueza AutoTrade — AutoTrade Single Robot",
      externalReference: "inv_1",
    });
  });

  it("busca pixQrCode", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ payload: "00020126", encodedImage: "abc" }),
    });

    const pix = await getAsaasPixQrCode("pay_123");
    expect(pix.payload).toBe("00020126");
    expect(fetchMock.mock.calls[0][0]).toContain("/payments/pay_123/pixQrCode");
  });

  it("safeAsaasLogContext não inclui api key", async () => {
    const { safeAsaasLogContext } = await import("@/lib/billing/asaas-client");
    const logged = JSON.stringify(
      safeAsaasLogContext({ access_token: "sandbox_key", payment: { value: 300 } })
    );
    expect(logged).not.toContain("sandbox_key");
  });
});

describe("asaas production guard", () => {
  it("bloqueia produção sem BILLING_REAL_PAYMENTS_ENABLED", async () => {
    vi.resetModules();
    vi.doMock("@/lib/billing/asaas-config", () => ({
      getAsaasEnvironment: () => "production",
      isRealBillingEnabled: () => false,
      getAsaasApiKey: () => "key",
      getAsaasBaseUrl: () => "https://api.asaas.com/v3",
      assertAsaasChargeAllowed: () => {
        throw new Error("REAL_BILLING_DISABLED");
      },
    }));
    const { assertAsaasChargeAllowed: guard } = await import("@/lib/billing/asaas-config");
    expect(() => guard()).toThrow("REAL_BILLING_DISABLED");
  });
});
