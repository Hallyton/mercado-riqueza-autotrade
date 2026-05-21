import {
  getSubscriptionDisplayLabel,
  licenseStatusBadgeClass,
  subscriptionStatusBadgeClass,
} from "@/lib/licensing/display";
import type { SubscriptionDisplayStatus } from "@/lib/licensing/types";
import { cn } from "@/lib/utils";

export function SubscriptionStatusBadge({
  status,
  className,
}: {
  status: SubscriptionDisplayStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-3 py-1 text-xs font-medium",
        subscriptionStatusBadgeClass(status),
        className
      )}
    >
      {getSubscriptionDisplayLabel(status)}
    </span>
  );
}

export function LicenseStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const labels: Record<string, string> = {
    ACTIVE: "Licença ativa",
    PENDING_ACTIVATION: "Aguardando ativação EA",
    SUSPENDED: "Licença suspensa",
    REVOKED: "Licença revogada",
  };

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-3 py-1 text-xs font-medium",
        licenseStatusBadgeClass(status),
        className
      )}
    >
      {labels[status] ?? status}
    </span>
  );
}
