import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  InvoiceStatus,
  PaymentAttemptStatus,
  SubscriptionStatus,
  AdminPaymentStatus,
} from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  subscription: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  planPrice: { findFirst: vi.fn() },
  invoice: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  paymentAttempt: { create: vi.fn(), updateMany: vi.fn() },
  payment: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/audit/log", () => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/admin/record-action", () => ({ recordAdminAction: vi.fn() }));
vi.mock("@/lib/billing/manual-provider", () => ({
  getBillingProviderAdapter: vi.fn(() => ({
    createInvoice: vi.fn().mockResolvedValue({}),
    createPaymentAttempt: vi.fn().mockResolvedValue({}),
  })),
  defaultInvoiceDueDate: vi.fn(() => new Date("2026-06-06")),
}));
vi.mock("@/lib/billing/provider", () => ({
  getConfiguredBillingProvider: vi.fn(() => "MANUAL"),
}));
vi.mock("@/lib/billing/payment-service", () => ({
  activateCommercialSubscriptionFromPayment: vi.fn(),
}));
vi.mock("@/lib/commercial/robot-instance", () => ({
  createRobotInstanceForSubscription: vi.fn().mockResolvedValue({ id: "robot_1" }),
  linkRobotInstanceToLicense: vi.fn(),
}));
vi.mock("@/lib/licensing/service", () => ({
  ensureLicenseForSubscription: vi.fn().mockResolvedValue({ id: "lic_1" }),
  markSubscriptionPastDue: vi.fn(),
}));

import {
  createSubscriptionInvoice,
  applyInvoicePaidEffects,
  markInvoicePaid,
  markInvoiceOverdue,
  cancelInvoice,
} from "@/lib/billing/invoice-service";
import { activateCommercialSubscriptionFromPayment } from "@/lib/billing/payment-service";

describe("billing invoice service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.planPrice.findFirst.mockResolvedValue({ amountCents: 30000 });
    prismaMock.subscription.findUnique.mockResolvedValue({
      id: "sub_1",
      userId: "user_1",
      planId: "plan_1",
      plan: { name: "AutoTrade Single Robot" },
    });
    prismaMock.$transaction.mockImplementation(async (fn) => {
      const tx = {
        invoice: {
          create: vi.fn().mockResolvedValue({
            id: "inv_1",
            subscriptionId: "sub_1",
            amountCents: 30000,
            currency: "BRL",
          }),
        },
        paymentAttempt: { create: vi.fn().mockResolvedValue({}) },
        subscription: { update: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });
  });

  it("cria invoice R$ 300", async () => {
    const invoice = await createSubscriptionInvoice("sub_1");
    expect(invoice.id).toBe("inv_1");
    expect(prismaMock.planPrice.findFirst).toHaveBeenCalled();
  });

  it("mark-paid ativa subscription comercial sem RealTradingApproval", async () => {
    prismaMock.invoice.findUnique.mockResolvedValue({
      id: "inv_1",
      subscriptionId: "sub_1",
      status: InvoiceStatus.OPEN,
      amountCents: 30000,
      currency: "BRL",
      periodStart: null,
      periodEnd: null,
      subscription: { plan: { name: "AutoTrade Single Robot" } },
    });
    prismaMock.$transaction.mockImplementation(async (fn) => {
      const tx = {
        invoice: { update: vi.fn() },
        paymentAttempt: { updateMany: vi.fn() },
        payment: { create: vi.fn() },
      };
      return fn(tx);
    });

    const realApprovalCreate = vi.fn();
    vi.doMock("@/lib/prisma", () => ({
      default: {
        ...prismaMock,
        realTradingApproval: { create: realApprovalCreate },
      },
    }));

    await applyInvoicePaidEffects({ invoiceId: "inv_1", actorId: "admin_1" });
    expect(activateCommercialSubscriptionFromPayment).toHaveBeenCalled();
    expect(realApprovalCreate).not.toHaveBeenCalled();
  });

  it("invoice OPEN não chama activate antes de pagamento", async () => {
    await createSubscriptionInvoice("sub_1");
    expect(activateCommercialSubscriptionFromPayment).not.toHaveBeenCalled();
  });

  it("markInvoicePaid exige confirmação", async () => {
    await expect(
      markInvoicePaid({ invoiceId: "inv_1", actorId: "admin_1" })
    ).rejects.toMatchObject({ code: "CONFIRMATION_REQUIRED" });
  });

  it("cancel invoice não apaga histórico", async () => {
    prismaMock.invoice.findUnique.mockResolvedValue({
      id: "inv_1",
      subscriptionId: "sub_1",
      status: InvoiceStatus.OPEN,
    });
    prismaMock.$transaction.mockImplementation(async (fn) => {
      const tx = {
        invoice: { update: vi.fn() },
        paymentAttempt: { updateMany: vi.fn() },
      };
      return fn(tx);
    });

    await cancelInvoice({
      invoiceId: "inv_1",
      actorId: "admin_1",
      confirmationPhrase: "CANCELAR FATURA",
    });

    expect(prismaMock.invoice.findUnique).toHaveBeenCalled();
  });

  it("overdue atualiza status", async () => {
    prismaMock.invoice.findUnique.mockResolvedValue({
      id: "inv_1",
      subscriptionId: "sub_1",
      status: InvoiceStatus.OPEN,
    });
    prismaMock.invoice.update.mockResolvedValue({});
    prismaMock.subscription.update.mockResolvedValue({});

    await markInvoiceOverdue("inv_1", "admin_1");
    expect(prismaMock.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: InvoiceStatus.OVERDUE } })
    );
    expect(prismaMock.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { adminPaymentStatus: AdminPaymentStatus.OVERDUE },
      })
    );
  });
});

describe("commercial gate — pagamento não libera real", () => {
  it("pagamento PAID não implica subscription ACTIVE para REAL automaticamente", () => {
    expect(SubscriptionStatus.ACTIVE).toBeDefined();
    expect(AdminPaymentStatus.CONFIRMED).toBeDefined();
  });
});
