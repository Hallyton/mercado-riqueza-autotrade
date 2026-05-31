import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminPaymentStatus,
  InvoiceStatus,
  RobotInstanceStatus,
  SubscriptionStatus,
} from "@prisma/client";

function readRepoFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const prismaMock = vi.hoisted(() => ({
  subscription: { findMany: vi.fn() },
  robotInstance: { findMany: vi.fn() },
  eaHeartbeat: { findFirst: vi.fn() },
  executionProtectionReport: { findFirst: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/billing/invoice-service", () => ({
  listInvoicesForUser: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/commercial/signup", () => ({
  hasCommercialSignupTerms: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/licensing/display", () => ({
  resolveSubscriptionDisplayStatus: vi.fn(() => "active"),
}));
vi.mock("@/lib/licensing/service", () => ({
  getLicenseOperationalFlags: vi.fn().mockResolvedValue({
    displayMessage: "Operação controlada.",
  }),
}));
vi.mock("@/lib/commercial/robot-instance", () => ({
  resolveRobotInstanceDisplayStatus: vi.fn(async () => RobotInstanceStatus.AWAITING_APPROVAL),
}));

import { getCommercialPortalOverview, pickPortalSubscription } from "@/lib/commercial/portal-overview";

describe("pickPortalSubscription", () => {
  it("prioriza subscription ACTIVE", () => {
    const picked = pickPortalSubscription([
      {
        status: SubscriptionStatus.INCOMPLETE,
        adminPaymentStatus: AdminPaymentStatus.PENDING,
      },
      {
        status: SubscriptionStatus.ACTIVE,
        adminPaymentStatus: AdminPaymentStatus.CONFIRMED,
      },
    ]);
    expect(picked?.status).toBe(SubscriptionStatus.ACTIVE);
  });
});

describe("portal billing UI — fontes", () => {
  const invoiceDetailSource = readRepoFile(
    "app/dashboard/comercial/faturas/[invoiceId]/page.tsx"
  );
  const comercialSource = readRepoFile("app/dashboard/comercial/page.tsx");
  const invoicesSectionSource = readRepoFile(
    "components/billing/commercial-invoices-section.tsx"
  );

  it("detalhe PAID usa getInvoiceStatusClientMessage e não Aguardando confirmação fixo", () => {
    expect(invoiceDetailSource).toContain("getInvoiceStatusClientMessage");
    expect(invoiceDetailSource).toContain("invoiceIsPaid");
    expect(invoiceDetailSource).not.toContain(
      "Aguardando confirmação administrativa do pagamento."
    );
  });

  it("portal comercial mostra magicNumber somente leitura", () => {
    expect(comercialSource).toContain('aria-readonly="true"');
    expect(comercialSource).not.toMatch(/type="number".*magic/i);
    expect(comercialSource).not.toMatch(/editar.*magic/i);
  });

  it("portal não promete conta real liberada por pagamento", () => {
    expect(comercialSource).toContain("Nenhum robô provisionado ainda");
    expect(invoicesSectionSource).toContain("invoiceIsPaid");
    expect(invoicesSectionSource).toContain("Pagamento confirmado");
  });

  it("portal-overview inclui aviso de conta real com preflight", () => {
    const overviewSource = readRepoFile("lib/commercial/portal-overview.ts");
    expect(overviewSource).toContain("PORTAL_REAL_ACCOUNT_REQUIREMENTS");
  });
});

describe("getCommercialPortalOverview — robôs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.eaHeartbeat.findFirst.mockResolvedValue(null);
    prismaMock.executionProtectionReport.findFirst.mockResolvedValue(null);
  });

  it("mostra RobotInstance AWAITING_APPROVAL quando existe na assinatura", async () => {
    prismaMock.subscription.findMany.mockResolvedValue([
      {
        id: "sub_1",
        userId: "user_1",
        status: SubscriptionStatus.ACTIVE,
        adminPaymentStatus: AdminPaymentStatus.CONFIRMED,
        robotCount: 1,
        currentPeriodEnd: new Date(),
        plan: {
          name: "AutoTrade Single Robot",
          slug: "autotrade-single-robot",
          maxRobots: 1,
          maxDevices: 1,
          prices: [{ amountCents: 30000 }],
        },
        licenses: [],
        robotInstances: [
          {
            id: "robot_1",
            licenseId: null,
            magicNumber: 910001,
            symbol: "WINM26",
            status: RobotInstanceStatus.AWAITING_APPROVAL,
            subscriptionId: "sub_1",
            robotProduct: { name: "AutoTrade Single Robot" },
          },
        ],
      },
    ]);

    const overview = await getCommercialPortalOverview("user_1");
    expect(overview.robots).toHaveLength(1);
    expect(overview.robots[0]?.displayStatusLabel).toBe("Aguardando aprovação");
    expect(overview.robots[0]?.magicNumber).toBe(910001);
  });

  it("não retorna lista vazia quando RobotInstance existe via fallback query", async () => {
    prismaMock.subscription.findMany.mockResolvedValue([
      {
        id: "sub_1",
        userId: "user_1",
        status: SubscriptionStatus.ACTIVE,
        adminPaymentStatus: AdminPaymentStatus.CONFIRMED,
        robotCount: 1,
        currentPeriodEnd: new Date(),
        plan: {
          name: "AutoTrade Single Robot",
          slug: "autotrade-single-robot",
          maxRobots: 1,
          maxDevices: 1,
          prices: [{ amountCents: 30000 }],
        },
        licenses: [],
        robotInstances: [],
      },
    ]);
    prismaMock.robotInstance.findMany.mockResolvedValue([
      {
        id: "robot_1",
        licenseId: null,
        magicNumber: 910002,
        symbol: null,
        status: RobotInstanceStatus.AWAITING_APPROVAL,
        subscriptionId: "sub_1",
        robotProduct: { name: "AutoTrade Single Robot" },
      },
    ]);

    const overview = await getCommercialPortalOverview("user_1");
    expect(overview.robots).toHaveLength(1);
    expect(prismaMock.robotInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user_1", subscriptionId: "sub_1" } })
    );
  });
});

describe("admin billing mark-paid", () => {
  it("mark-paid PENDING → PAID coberto no invoice-service", () => {
    const source = readRepoFile("lib/billing/invoice-service.ts");
    expect(source).toContain("applyInvoicePaidEffects");
    expect(source).toContain("fulfillCommercialEntitlements");
    expect(source).toContain("billing.invoice_marked_paid");
  });
});
