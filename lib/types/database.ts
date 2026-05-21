import type { Prisma, OrderLogStatus } from "@prisma/client";

export type {
  User,
  Account,
  Session,
  Plan,
  PlanPrice,
  PlanFeature,
  Subscription,
  Invoice,
  Payment,
  ExposureProfile,
  Mt5Account,
  License,
  Device,
  ActivationCode,
  Instruction,
  InstructionStatusLog,
  Execution,
  PositionSnapshot,
  DailyPnl,
  RiskEvent,
  KillSwitchLog,
  EquitySnapshot,
  BenchmarkIbovDaily,
  PortfolioMetric,
  EaHeartbeat,
  AuditLog,
  WebhookEvent,
  LicenseExposureProfile,
  PlanExposureProfile,
} from "@prisma/client";

export {
  UserRole,
  SubscriptionStatus,
  LicenseStatus,
  InvoiceStatus,
  PaymentStatus,
  InstructionSide,
  InstructionOrderType,
  InstructionPurpose,
  OrderLogStatus,
  ExecutionStatus,
  RiskEventType,
  KillSwitchScope,
  AuditActorType,
  TradeMode,
} from "@prisma/client";

/** Usuário com assinatura ativa e plano (portal do cliente). */
export type UserWithActiveSubscription = Prisma.UserGetPayload<{
  include: {
    subscriptions: {
      where: { status: "ACTIVE" };
      include: { plan: { include: { planProfiles: { include: { exposureProfile: true } } } } };
      take: 1;
    };
  };
}>;

/** Licença com conta MT5, perfil e dispositivos (dashboard / EA). */
export type LicenseOperational = Prisma.LicenseGetPayload<{
  include: {
    mt5Account: true;
    exposureProfile: true;
    devices: { where: { revokedAt: null } };
    subscription: { include: { plan: true } };
  };
}>;

/** Instrução com trilha de status e execuções (auditoria — admin). */
export type InstructionWithAuditTrail = Prisma.InstructionGetPayload<{
  include: {
    statusLogs: { orderBy: { createdAt: "asc" } };
    executions: true;
  };
}>;

/** Plano com preços, features e perfis permitidos (checkout). */
export type PlanCatalogItem = Prisma.PlanGetPayload<{
  include: {
    prices: { where: { isActive: true } };
    features: true;
    planProfiles: { include: { exposureProfile: true } };
  };
}>;

/** Resumo dashboard cliente — sem dados de estratégia. */
export type ClientDashboardLicense = Prisma.LicenseGetPayload<{
  select: {
    id: true;
    status: true;
    haltNewEntries: true;
    haltAllTrading: true;
    exposureProfile: {
      select: { slug: true; name: true; description: true };
    };
    mt5Account: {
      select: { login: true; server: true; brokerName: true; label: true };
    };
    devices: {
      select: { deviceId: true; lastSeenAt: true; eaVersion: true };
      where: { revokedAt: null };
    };
  };
}>;

export type CreateInstructionInput = Prisma.InstructionCreateInput;
export type UpdateLicenseFlagsInput = Pick<
  Prisma.LicenseUpdateInput,
  "haltNewEntries" | "haltAllTrading" | "status"
>;

/** Estados terminais de ordem (AGENTS.md / documento mestre). */
export const TERMINAL_ORDER_STATUSES = [
  "EXECUTED",
  "REJECTED",
  "IGNORED",
  "CANCELLED",
] as const satisfies readonly OrderLogStatus[];

export type TerminalOrderStatus = (typeof TERMINAL_ORDER_STATUSES)[number];

export function isTerminalOrderStatus(
  status: OrderLogStatus
): status is TerminalOrderStatus {
  return (TERMINAL_ORDER_STATUSES as readonly string[]).includes(status);
}
