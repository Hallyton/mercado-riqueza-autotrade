import type { SubscriptionDisplayStatus } from "@/lib/licensing/types";

/** Status operacional do dia — visível ao cliente (sem estratégia). */
export type DayOperationalStatus =
  | "ea_offline"
  | "risk_blocked"
  | "positioned"
  | "armed_order"
  | "operation_closed"
  | "awaiting_opportunity"
  | "no_operation_today";

export type DashboardPendingOrder = {
  symbol: string;
  side: string;
  volume: number;
  ticket?: string;
};

export type DashboardOpenPosition = {
  symbol: string;
  quantity: number;
  avgPrice: number;
  unrealizedPnl: number | null;
};

export type DashboardHistoryRow = {
  id: string;
  at: string;
  symbol: string;
  side: string;
  status: string;
  resultLabel: string;
};

export type EquityPoint = {
  date: string;
  equity: number;
};

export type BenchmarkPoint = {
  date: string;
  portfolioPct: number;
  ibovPct: number;
};

export type ClientDashboardData = {
  userEmail: string;
  subscription: {
    displayStatus: SubscriptionDisplayStatus;
    planName: string | null;
    planSlug: string | null;
    periodEnd: string | null;
  };
  license: {
    id: string;
    status: string;
    exposureProfileName: string | null;
    mt5Login: string | null;
    mt5Server: string | null;
    brokerName: string | null;
    haltNewEntries: boolean;
    canAcceptNewEntries: boolean;
  } | null;
  ea: {
    online: boolean;
    lastSyncAt: string | null;
    eaVersion: string | null;
  };
  dayStatus: DayOperationalStatus;
  dayStatusMessage: string;
  positions: DashboardOpenPosition[];
  pendingOrders: DashboardPendingOrder[];
  pnl: {
    day: number | null;
    month: number | null;
    dayLabel: string;
    monthLabel: string;
  };
  equityCurve: EquityPoint[];
  benchmark: BenchmarkPoint[];
  history: DashboardHistoryRow[];
  dailyFinancialRisk: {
    active: boolean;
    message: string | null;
  };
};
