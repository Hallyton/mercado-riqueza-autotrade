import { describe, expect, it, vi, beforeEach } from "vitest";
import { AdminPaymentStatus, SubscriptionStatus } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  subscription: { findUnique: vi.fn() },
  invoice: { findFirst: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import {
  isCommercialPaymentOk,
  isSubscriptionCommerciallyActive,
} from "@/lib/risk/real-trading-commercial";

describe("real trading commercial gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.invoice.findFirst.mockResolvedValue(null);
  });

  it("pagamento pendente não libera comercialmente", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue({
      status: SubscriptionStatus.ACTIVE,
      adminPaymentStatus: AdminPaymentStatus.PENDING,
    });
    expect(await isCommercialPaymentOk("sub_1")).toBe(false);
  });

  it("pagamento confirmado com assinatura ativa libera pagamento comercial", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue({
      status: SubscriptionStatus.ACTIVE,
      adminPaymentStatus: AdminPaymentStatus.CONFIRMED,
    });
    expect(await isCommercialPaymentOk("sub_1")).toBe(true);
  });

  it("assinatura ativa não implica operação real automática", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue({
      status: SubscriptionStatus.ACTIVE,
    });
    expect(await isSubscriptionCommerciallyActive("sub_1")).toBe(true);
  });
});
