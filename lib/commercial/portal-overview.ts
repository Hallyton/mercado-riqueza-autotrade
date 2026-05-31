import {
  AdminPaymentStatus,
  ProtectionStatus,
  RobotInstanceStatus,
  SubscriptionStatus,
  type RobotInstance,
  type RobotProduct,
} from "@prisma/client";
import { listInvoicesForUser } from "@/lib/billing/invoice-service";
import prisma from "@/lib/prisma";
import { resolveSubscriptionDisplayStatus } from "@/lib/licensing/display";
import { getLicenseOperationalFlags } from "@/lib/licensing/service";
import { maskLicenseId } from "@/lib/risk/real-trading-guard-status";
import {
  ADMIN_PAYMENT_STATUS_LABELS,
  ROBOT_INSTANCE_STATUS_LABELS,
} from "./constants";
import { resolveRobotInstanceDisplayStatus } from "./robot-instance";
import { hasCommercialSignupTerms } from "./signup";
import { PORTAL_REAL_ACCOUNT_REQUIREMENTS } from "@/lib/billing/invoice-client-copy";

function maskAccountLogin(login: string | null | undefined): string | null {
  if (!login) return null;
  if (login.length <= 4) return "****";
  return `${login.slice(0, 2)}****${login.slice(-2)}`;
}

const LICENSE_STATUS_LABELS: Record<string, string> = {
  PENDING_ACTIVATION: "Aguardando ativação",
  ACTIVE: "Ativa",
  SUSPENDED: "Suspensa",
  REVOKED: "Revogada",
};

const subscriptionInclude = {
  plan: { include: { prices: { where: { isActive: true }, take: 1 } } },
  licenses: {
    include: {
      mt5Account: true,
      exposureProfile: true,
      devices: {
        where: { revokedAt: null },
        orderBy: { lastSeenAt: "desc" as const },
        take: 5,
        select: {
          id: true,
          deviceId: true,
          status: true,
          eaVersion: true,
          lastSeenAt: true,
        },
      },
    },
  },
  robotInstances: {
    include: { robotProduct: true },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

export function pickPortalSubscription<
  T extends { status: SubscriptionStatus; adminPaymentStatus: AdminPaymentStatus },
>(subscriptions: T[]): T | null {
  if (subscriptions.length === 0) return null;
  return (
    subscriptions.find((s) => s.status === SubscriptionStatus.ACTIVE) ??
    subscriptions.find((s) => s.adminPaymentStatus === AdminPaymentStatus.CONFIRMED) ??
    subscriptions[0]
  );
}

async function resolveSubscriptionRobotInstances(
  userId: string,
  subscriptionId: string,
  fromRelation: Array<RobotInstance & { robotProduct: RobotProduct }>
) {
  if (fromRelation.length > 0) return fromRelation;

  return prisma.robotInstance.findMany({
    where: { userId, subscriptionId },
    include: { robotProduct: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getCommercialPortalOverview(userId: string) {
  const subscriptions = await prisma.subscription.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: subscriptionInclude,
  });

  const subscription = pickPortalSubscription(subscriptions);

  const termsAccepted = await hasCommercialSignupTerms(userId);
  const invoices = await listInvoicesForUser(userId).catch(() => []);
  const currentInvoice = invoices[0] ?? null;

  if (!subscription) {
    return {
      subscription: null,
      displayStatus: resolveSubscriptionDisplayStatus(null),
      termsAccepted,
      invoices,
      currentInvoice,
      robots: [],
      licenses: [],
      alerts: [
        "Nenhuma assinatura encontrada. Solicite o plano AutoTrade Single Robot.",
      ],
    };
  }

  const displayStatus = resolveSubscriptionDisplayStatus(subscription);
  const price = subscription.plan.prices[0];

  const robotInstances = await resolveSubscriptionRobotInstances(
    userId,
    subscription.id,
    subscription.robotInstances
  );

  const robots = await Promise.all(
    robotInstances.map(async (instance) => {
      const displayRobotStatus = await resolveRobotInstanceDisplayStatus(
        instance
      );
      const license = subscription.licenses.find(
        (l) => l.id === instance.licenseId
      );

      let lastHeartbeat: Date | null = null;
      let lastProtectionStatus: string | null = null;
      let deviceStatusLabel: string | null = null;

      if (license) {
        const hb = await prisma.eaHeartbeat.findFirst({
          where: { licenseId: license.id },
          orderBy: { receivedAt: "desc" },
          select: { receivedAt: true, tradeMode: true, eaStatus: true },
        });
        lastHeartbeat = hb?.receivedAt ?? null;

        const protection = await prisma.executionProtectionReport.findFirst({
          where: { licenseId: license.id, magicNumber: instance.magicNumber ?? undefined },
          orderBy: { reportedAt: "desc" },
          select: { protectionStatus: true, reportedAt: true },
        });
        lastProtectionStatus = protection?.protectionStatus ?? null;

        const activeDevice = license.devices.find((d) => d.status === "ACTIVE");
        deviceStatusLabel = activeDevice
          ? "Device ativo"
          : license.devices.length > 0
            ? "Device registrado — offline"
            : "Sem device vinculado";
      }

      return {
        id: instance.id,
        productName: instance.robotProduct.name,
        magicNumber: instance.magicNumber,
        symbol: instance.symbol,
        displayStatus: displayRobotStatus,
        displayStatusLabel:
          ROBOT_INSTANCE_STATUS_LABELS[displayRobotStatus] ?? displayRobotStatus,
        licenseIdMasked: instance.licenseId
          ? maskLicenseId(instance.licenseId)
          : null,
        licenseStatus: license?.status ?? null,
        licenseStatusLabel: license
          ? (LICENSE_STATUS_LABELS[license.status] ?? license.status)
          : null,
        deviceStatusLabel,
        lastHeartbeat,
        lastProtectionStatus,
      };
    })
  );

  const licensesWithFlags = await Promise.all(
    subscription.licenses.map(async (lic) => {
      const flags = await getLicenseOperationalFlags(lic.id);
      const activeDevices = lic.devices.filter((d) => d.status === "ACTIVE");
      return {
        id: lic.id,
        idMasked: maskLicenseId(lic.id),
        status: lic.status,
        mt5LoginMasked: maskAccountLogin(lic.mt5Account?.login),
        mt5Server: lic.mt5Account?.server ?? null,
        expectedMagicNumber: lic.expectedMagicNumber,
        deviceCount: activeDevices.length,
        maxDevices: subscription.plan.maxDevices,
        lastDeviceSeenAt: lic.devices[0]?.lastSeenAt ?? null,
        flags,
      };
    })
  );

  const alerts: string[] = [];

  if (subscription.adminPaymentStatus === "PENDING") {
    alerts.push(
      "Pagamento pendente de confirmação administrativa. A operação não será liberada automaticamente."
    );
  }

  if (subscription.adminPaymentStatus === "OVERDUE") {
    alerts.push("Pagamento em atraso. Novas entradas permanecem bloqueadas.");
  }

  if (!termsAccepted) {
    alerts.push("Termos comerciais pendentes de aceite.");
  }

  alerts.push(PORTAL_REAL_ACCOUNT_REQUIREMENTS);

  return {
    subscription: {
      id: subscription.id,
      status: subscription.status,
      adminPaymentStatus: subscription.adminPaymentStatus,
      adminPaymentStatusLabel:
        ADMIN_PAYMENT_STATUS_LABELS[subscription.adminPaymentStatus] ??
        subscription.adminPaymentStatus,
      displayStatus,
      planName: subscription.plan.name,
      planSlug: subscription.plan.slug,
      monthlyPriceCents: price?.amountCents ?? null,
      robotCount: subscription.robotCount,
      maxRobots: subscription.plan.maxRobots,
      currentPeriodEnd: subscription.currentPeriodEnd,
    },
    termsAccepted,
    invoices,
    currentInvoice,
    robots,
    licenses: licensesWithFlags,
    alerts,
  };
}

export function isProtectionStatusAlert(
  status: ProtectionStatus | string | null
): boolean {
  return (
    status === ProtectionStatus.PROTECTION_FAILED ||
    status === ProtectionStatus.PROTECTION_PENDING
  );
}
