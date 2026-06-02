import type { RealManualManagementPlan } from "@/lib/admin/real-manual-management-plan";

export type EaManagementPlanPayload = {
  version: number;
  initial_stop_loss: number;
  takes: Array<{
    label: string;
    enabled: boolean;
    price: number | null;
    quantity: number;
  }>;
  break_even: {
    enabled: boolean;
    trigger: string;
    trigger_price: number | null;
    offset: number;
  };
  trailing_stop: {
    enabled: boolean;
    trigger_price: number | null;
    distance: number | null;
    step: number | null;
  };
};

export function mapManagementPlanToEaPayload(
  plan: RealManualManagementPlan
): EaManagementPlanPayload {
  return {
    version: plan.version,
    initial_stop_loss: plan.initialStopLoss,
    takes: plan.takes.map((t) => ({
      label: t.label,
      enabled: t.enabled,
      price: t.price,
      quantity: t.quantity,
    })),
    break_even: {
      enabled: plan.breakEven.enabled,
      trigger: plan.breakEven.trigger,
      trigger_price: plan.breakEven.triggerPrice,
      offset: plan.breakEven.offset,
    },
    trailing_stop: {
      enabled: plan.trailingStop.enabled,
      trigger_price: plan.trailingStop.triggerPrice,
      distance: plan.trailingStop.distance,
      step: plan.trailingStop.step,
    },
  };
}

export function parseManagementPlanFromInstruction(
  value: unknown
): RealManualManagementPlan | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const plan = value as RealManualManagementPlan;
  if (plan.version !== 1 || !Array.isArray(plan.takes) || plan.takes.length !== 2) {
    return null;
  }
  return plan;
}
