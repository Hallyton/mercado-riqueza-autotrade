import {
  managementPlanSchema,
  type RealManualManagementPlan,
} from "@/lib/admin/real-manual-management-plan";

type SnakeTake = {
  label?: string;
  enabled?: boolean;
  price?: number | null;
  quantity?: number;
};

type SnakePlan = {
  version?: number;
  initial_stop_loss?: number;
  takes?: SnakeTake[];
  break_even?: {
    enabled?: boolean;
    trigger?: string;
    trigger_price?: number | null;
    offset?: number;
  };
  trailing_stop?: {
    enabled?: boolean;
    trigger_price?: number | null;
    distance?: number | null;
    step?: number | null;
  };
};

export function parseEaPlannedManagementPlan(
  raw: unknown
): RealManualManagementPlan | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = raw as SnakePlan;
  const takes = p.takes ?? [];
  const t1 = takes[0] ?? { label: "T1", enabled: false, price: null, quantity: 0 };
  const t2 = takes[1] ?? { label: "T2", enabled: false, price: null, quantity: 0 };

  const mapped = {
    version: 1 as const,
    initialStopLoss: Number(p.initial_stop_loss ?? 0),
    takes: [
      {
        label: "T1" as const,
        enabled: Boolean(t1.enabled),
        price: t1.price != null ? Number(t1.price) : null,
        quantity: Number(t1.quantity ?? 0),
      },
      {
        label: "T2" as const,
        enabled: Boolean(t2.enabled),
        price: t2.price != null ? Number(t2.price) : null,
        quantity: Number(t2.quantity ?? 0),
      },
    ],
    breakEven: {
      enabled: Boolean(p.break_even?.enabled),
      trigger:
        (p.break_even?.trigger as RealManualManagementPlan["breakEven"]["trigger"]) ??
        "MANUAL_DISABLED",
      triggerPrice:
        p.break_even?.trigger_price != null
          ? Number(p.break_even.trigger_price)
          : null,
      offset: Number(p.break_even?.offset ?? 0),
    },
    trailingStop: {
      enabled: Boolean(p.trailing_stop?.enabled),
      triggerPrice:
        p.trailing_stop?.trigger_price != null
          ? Number(p.trailing_stop.trigger_price)
          : null,
      distance:
        p.trailing_stop?.distance != null
          ? Number(p.trailing_stop.distance)
          : null,
      step: p.trailing_stop?.step != null ? Number(p.trailing_stop.step) : null,
    },
  };

  const parsed = managementPlanSchema.safeParse(mapped);
  return parsed.success ? parsed.data : null;
}

export function estimateStopPointsFromPlan(input: {
  side: "BUY" | "SELL";
  entryPrice: number | null;
  initialStopLoss: number;
  tickSize?: number;
}): number {
  const tick = input.tickSize && input.tickSize > 0 ? input.tickSize : 0.5;
  if (input.entryPrice == null || input.entryPrice <= 0) {
    return 7;
  }
  const diff = Math.abs(input.entryPrice - input.initialStopLoss);
  return Math.max(1, Math.round(diff / tick));
}
