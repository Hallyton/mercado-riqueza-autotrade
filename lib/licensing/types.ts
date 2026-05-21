import type {
  LicenseStatus,
  SubscriptionStatus,
} from "@prisma/client";

/** Status comercial exibido ao cliente (sem detalhes de estratégia). */
export type SubscriptionDisplayStatus =
  | "active"
  | "past_due"
  | "expired"
  | "cancelled"
  | "pending"
  | "none";

export type LicenseOperationalFlags = {
  licenseId: string;
  licenseStatus: LicenseStatus;
  subscriptionStatus: SubscriptionStatus | null;
  haltNewEntries: boolean;
  haltAllTrading: boolean;
  canAcceptNewEntries: boolean;
  canManageOpenPositions: boolean;
  displayMessage: string;
};

export type LicenseStatusApiResponse = {
  licenseId: string;
  status: LicenseStatus;
  haltNewEntries: boolean;
  haltAllTrading: boolean;
  canAcceptNewEntries: boolean;
  canManageOpenPositions: boolean;
  subscription: {
    id: string;
    status: SubscriptionStatus;
    displayStatus: SubscriptionDisplayStatus;
    planSlug: string;
    planName: string;
    currentPeriodEnd: string | null;
  } | null;
};
