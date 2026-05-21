import type { Subscription, SubscriptionStatus } from "@prisma/client";
import type { SubscriptionDisplayStatus } from "./types";

const LABELS: Record<SubscriptionDisplayStatus, string> = {
  active: "Assinatura ativa",
  past_due: "Pagamento em atraso",
  expired: "Assinatura vencida",
  cancelled: "Assinatura cancelada",
  pending: "Aguardando pagamento",
  none: "Sem assinatura",
};

export function getSubscriptionDisplayLabel(status: SubscriptionDisplayStatus) {
  return LABELS[status];
}

export function resolveSubscriptionDisplayStatus(
  subscription: Pick<
    Subscription,
    "status" | "currentPeriodEnd" | "cancelAtPeriodEnd"
  > | null
): SubscriptionDisplayStatus {
  if (!subscription) return "none";

  const now = new Date();

  if (subscription.status === "CANCELLED") {
    return "cancelled";
  }

  if (subscription.status === "PAST_DUE") {
    return "past_due";
  }

  if (subscription.status === "ACTIVE") {
    if (
      subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd < now
    ) {
      return "expired";
    }
    return "active";
  }

  if (
    subscription.status === "INCOMPLETE" ||
    subscription.status === "TRIALING"
  ) {
    return "pending";
  }

  if (subscription.status === "PAUSED") {
    return "cancelled";
  }

  return "none";
}

export function subscriptionStatusBadgeClass(
  status: SubscriptionDisplayStatus
): string {
  switch (status) {
    case "active":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    case "past_due":
      return "border-amber-500/40 bg-amber-500/10 text-amber-300";
    case "expired":
      return "border-red-500/40 bg-red-500/10 text-red-300";
    case "cancelled":
      return "border-zinc-500/40 bg-zinc-500/10 text-zinc-400";
    case "pending":
      return "border-gold/40 bg-gold/10 text-gold";
    default:
      return "border-white/10 bg-white/5 text-muted-foreground";
  }
}

export function licenseStatusBadgeClass(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    case "PENDING_ACTIVATION":
      return "border-gold/40 bg-gold/10 text-gold";
    case "SUSPENDED":
      return "border-amber-500/40 bg-amber-500/10 text-amber-300";
    case "REVOKED":
      return "border-red-500/40 bg-red-500/10 text-red-300";
    default:
      return "border-white/10 bg-white/5 text-muted-foreground";
  }
}

export type SubscriptionStatusLabel = SubscriptionStatus;
