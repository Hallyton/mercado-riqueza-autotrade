import { describe, expect, it, vi, beforeEach } from "vitest";
import { UserStatus } from "@prisma/client";

const hashMock = vi.hoisted(() => vi.fn().mockResolvedValue("hashed"));
const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), create: vi.fn() },
  plan: { findUnique: vi.fn() },
  subscription: { create: vi.fn() },
  termsAcceptance: { create: vi.fn(), count: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("bcryptjs", () => ({ hash: hashMock }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/audit/log", () => ({ createAuditLog: vi.fn() }));

import {
  commercialSignup,
  hasCommercialSignupTerms,
} from "@/lib/commercial/signup";

describe("commercial signup", () => {
  const baseInput = {
    name: "Cliente Teste",
    email: "novo@test.com",
    password: "senha-segura-123",
    acceptTerms: true,
    acceptRisk: true,
    acceptNoReturnGuarantee: true,
    acceptRealRequiresApproval: true,
    acceptBlackBox: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.plan.findUnique.mockResolvedValue({
      id: "plan_1",
      slug: "autotrade-single-robot",
      name: "AutoTrade Single Robot",
      isActive: true,
      prices: [{ amountCents: 30000 }],
    });
    prismaMock.$transaction.mockImplementation(async (fn) => {
      const tx = {
        user: {
          create: vi.fn().mockResolvedValue({
            id: "user_1",
            email: "novo@test.com",
          }),
        },
        subscription: {
          create: vi.fn().mockResolvedValue({ id: "sub_1" }),
        },
        termsAcceptance: { create: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });
  });

  it("falha sem aceite de termos", async () => {
    await expect(
      commercialSignup({ ...baseInput, acceptTerms: false })
    ).rejects.toMatchObject({ code: "TERMS_REQUIRED" });
  });

  it("falha com e-mail duplicado", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "existing" });
    await expect(commercialSignup(baseInput)).rejects.toMatchObject({
      code: "EMAIL_EXISTS",
      status: 409,
    });
  });

  it("cria user CLIENT com assinatura INCOMPLETE", async () => {
    const result = await commercialSignup(baseInput);
    expect(result.planSlug).toBe("autotrade-single-robot");
    expect(result.subscriptionId).toBe("sub_1");
    expect(hashMock).toHaveBeenCalledWith(baseInput.password, 12);
  });
});

describe("hasCommercialSignupTerms", () => {
  beforeEach(() => {
    prismaMock.termsAcceptance.count.mockReset();
  });

  it("requer todos os tipos de termo", async () => {
    prismaMock.termsAcceptance.count.mockResolvedValue(5);
    expect(await hasCommercialSignupTerms("user_1")).toBe(true);
    prismaMock.termsAcceptance.count.mockResolvedValue(3);
    expect(await hasCommercialSignupTerms("user_1")).toBe(false);
  });
});

describe("user access for commercial clients", () => {
  it("usuário bloqueado não autentica", async () => {
    const { canUserAuthenticate } = await import("@/lib/auth/user-access");
    expect(
      canUserAuthenticate({
        status: UserStatus.BLOCKED,
        passwordHash: "hash",
      })
    ).toBe(false);
  });
});
