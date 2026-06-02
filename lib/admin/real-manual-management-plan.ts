import { z } from "zod";

export const MANAGEMENT_PLAN_VERSION = 1 as const;

export const breakEvenTriggerSchema = z.enum([
  "TAKE1_FILLED",
  "PRICE_REACHED",
  "MANUAL_DISABLED",
]);

export const managementPlanTakeSchema = z.object({
  label: z.enum(["T1", "T2"]),
  enabled: z.boolean(),
  price: z.number().positive().nullable(),
  quantity: z.number().int().nonnegative(),
});

export const managementPlanSchema = z.object({
  version: z.literal(MANAGEMENT_PLAN_VERSION),
  initialStopLoss: z.number().positive(),
  takes: z.tuple([managementPlanTakeSchema, managementPlanTakeSchema]),
  breakEven: z.object({
    enabled: z.boolean(),
    trigger: breakEvenTriggerSchema,
    triggerPrice: z.number().positive().nullable(),
    offset: z.number(),
  }),
  trailingStop: z.object({
    enabled: z.boolean(),
    triggerPrice: z.number().positive().nullable(),
    distance: z.number().positive().nullable(),
    step: z.number().positive().nullable(),
  }),
});

export type RealManualManagementPlan = z.infer<typeof managementPlanSchema>;

export type ManagementPlanValidationError = {
  code: string;
  message: string;
};

export const MANAGEMENT_PLAN_ERROR_MESSAGES: Record<string, string> = {
  INITIAL_STOP_LOSS_REQUIRED: "Informe o Stop Loss inicial.",
  INITIAL_STOP_LOSS_INVALID: "Stop Loss inicial inválido.",
  TAKE1_PRICE_REQUIRED: "Informe o preço do Take 1.",
  TAKE1_QUANTITY_REQUIRED: "Informe a quantidade do Take 1.",
  TAKE2_PRICE_REQUIRED: "Informe o preço do Take 2.",
  TAKE2_QUANTITY_REQUIRED: "Informe a quantidade do Take 2.",
  TAKE_QUANTITY_EXCEEDS_POSITION:
    "A soma das quantidades de Take 1 e Take 2 não pode exceder a quantidade da ordem.",
  TAKE_SPLIT_NOT_AVAILABLE_FOR_ONE_CONTRACT:
    "Com 1 contrato, não é possível dividir a posição entre Take 1 e Take 2.",
  BREAKEVEN_TRIGGER_PRICE_REQUIRED: "Informe o preço de gatilho do Breakeven.",
  TRAILING_TRIGGER_PRICE_REQUIRED: "Informe o preço de gatilho do Trailing Stop.",
  TRAILING_DISTANCE_REQUIRED: "Informe a distância do Trailing Stop.",
  TRAILING_STEP_REQUIRED: "Informe o passo de atualização do Trailing Stop.",
  MANAGEMENT_PLAN_INVALID: "Plano de gestão inválido.",
  TAKE_REQUIRED: "Habilite ao menos Take 1 com preço e quantidade.",
};

export const MANAGEMENT_EVENT_CODES = [
  "ENTRY_ORDER_PLACED",
  "ENTRY_FILLED",
  "TAKE1_ORDER_PLACED",
  "TAKE2_ORDER_PLACED",
  "TAKE1_FILLED",
  "TAKE2_FILLED",
  "BREAKEVEN_ARMED",
  "BREAKEVEN_MOVED",
  "BREAKEVEN_FAILED",
  "TRAILING_ARMED",
  "TRAILING_MOVED",
  "TRAILING_FAILED",
  "MANAGEMENT_PLAN_FAILED",
  "PENDING_ORDER_PLACED",
  "ORDER_REJECTED",
  "TAKE_ORDER_REJECTED",
] as const;

export type ManagementEventCode = (typeof MANAGEMENT_EVENT_CODES)[number];

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function createDefaultManagementPlan(): RealManualManagementPlan {
  return {
    version: MANAGEMENT_PLAN_VERSION,
    initialStopLoss: 0,
    takes: [
      { label: "T1", enabled: true, price: null, quantity: 1 },
      { label: "T2", enabled: false, price: null, quantity: 0 },
    ],
    breakEven: {
      enabled: false,
      trigger: "TAKE1_FILLED",
      triggerPrice: null,
      offset: 0,
    },
    trailingStop: {
      enabled: false,
      triggerPrice: null,
      distance: null,
      step: null,
    },
  };
}

export function deriveLegacyPricesFromPlan(plan: RealManualManagementPlan): {
  stopLossPrice: number;
  takeProfitPrice: number;
} {
  const t1 = plan.takes[0];
  const t2 = plan.takes[1];
  const takeProfitPrice =
    (t1.enabled && t1.price != null ? t1.price : null) ??
    (t2.enabled && t2.price != null ? t2.price : null) ??
    plan.initialStopLoss;

  return {
    stopLossPrice: plan.initialStopLoss,
    takeProfitPrice,
  };
}

export function validateManagementPlan(input: {
  plan: RealManualManagementPlan;
  requestedContracts: number;
  side?: "BUY" | "SELL";
  entryPrice?: number | null;
}): ManagementPlanValidationError | null {
  const raw = input.plan;

  if (raw.initialStopLoss == null || raw.initialStopLoss === 0) {
    return {
      code: "INITIAL_STOP_LOSS_REQUIRED",
      message: MANAGEMENT_PLAN_ERROR_MESSAGES.INITIAL_STOP_LOSS_REQUIRED,
    };
  }
  if (!isPositiveNumber(raw.initialStopLoss)) {
    return {
      code: "INITIAL_STOP_LOSS_INVALID",
      message: MANAGEMENT_PLAN_ERROR_MESSAGES.INITIAL_STOP_LOSS_INVALID,
    };
  }

  const parsed = managementPlanSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      code: "MANAGEMENT_PLAN_INVALID",
      message: MANAGEMENT_PLAN_ERROR_MESSAGES.MANAGEMENT_PLAN_INVALID,
    };
  }

  const plan = parsed.data;

  const [t1, t2] = plan.takes;

  if (t1.enabled) {
    if (t1.price == null || !isPositiveNumber(t1.price)) {
      return {
        code: "TAKE1_PRICE_REQUIRED",
        message: MANAGEMENT_PLAN_ERROR_MESSAGES.TAKE1_PRICE_REQUIRED,
      };
    }
    if (!Number.isInteger(t1.quantity) || t1.quantity <= 0) {
      return {
        code: "TAKE1_QUANTITY_REQUIRED",
        message: MANAGEMENT_PLAN_ERROR_MESSAGES.TAKE1_QUANTITY_REQUIRED,
      };
    }
  }

  if (t2.enabled) {
    if (t2.price == null || !isPositiveNumber(t2.price)) {
      return {
        code: "TAKE2_PRICE_REQUIRED",
        message: MANAGEMENT_PLAN_ERROR_MESSAGES.TAKE2_PRICE_REQUIRED,
      };
    }
    if (!Number.isInteger(t2.quantity) || t2.quantity <= 0) {
      return {
        code: "TAKE2_QUANTITY_REQUIRED",
        message: MANAGEMENT_PLAN_ERROR_MESSAGES.TAKE2_QUANTITY_REQUIRED,
      };
    }
  }

  if (!t1.enabled && !t2.enabled) {
    return {
      code: "TAKE_REQUIRED",
      message: MANAGEMENT_PLAN_ERROR_MESSAGES.TAKE_REQUIRED,
    };
  }

  const activeTakeQty =
    (t1.enabled ? t1.quantity : 0) + (t2.enabled ? t2.quantity : 0);

  if (
    input.requestedContracts === 1 &&
    t1.enabled &&
    t2.enabled &&
    t1.quantity >= 1 &&
    t2.quantity >= 1
  ) {
    return {
      code: "TAKE_SPLIT_NOT_AVAILABLE_FOR_ONE_CONTRACT",
      message: MANAGEMENT_PLAN_ERROR_MESSAGES.TAKE_SPLIT_NOT_AVAILABLE_FOR_ONE_CONTRACT,
    };
  }

  if (activeTakeQty > input.requestedContracts) {
    return {
      code: "TAKE_QUANTITY_EXCEEDS_POSITION",
      message: MANAGEMENT_PLAN_ERROR_MESSAGES.TAKE_QUANTITY_EXCEEDS_POSITION,
    };
  }

  if (plan.breakEven.enabled && plan.breakEven.trigger === "PRICE_REACHED") {
    if (
      plan.breakEven.triggerPrice == null ||
      !isPositiveNumber(plan.breakEven.triggerPrice)
    ) {
      return {
        code: "BREAKEVEN_TRIGGER_PRICE_REQUIRED",
        message: MANAGEMENT_PLAN_ERROR_MESSAGES.BREAKEVEN_TRIGGER_PRICE_REQUIRED,
      };
    }
  }

  if (plan.trailingStop.enabled) {
    if (
      plan.trailingStop.triggerPrice == null ||
      !isPositiveNumber(plan.trailingStop.triggerPrice)
    ) {
      return {
        code: "TRAILING_TRIGGER_PRICE_REQUIRED",
        message: MANAGEMENT_PLAN_ERROR_MESSAGES.TRAILING_TRIGGER_PRICE_REQUIRED,
      };
    }
    if (
      plan.trailingStop.distance == null ||
      !isPositiveNumber(plan.trailingStop.distance)
    ) {
      return {
        code: "TRAILING_DISTANCE_REQUIRED",
        message: MANAGEMENT_PLAN_ERROR_MESSAGES.TRAILING_DISTANCE_REQUIRED,
      };
    }
    if (plan.trailingStop.step == null || !isPositiveNumber(plan.trailingStop.step)) {
      return {
        code: "TRAILING_STEP_REQUIRED",
        message: MANAGEMENT_PLAN_ERROR_MESSAGES.TRAILING_STEP_REQUIRED,
      };
    }
  }

  const entry = input.entryPrice;
  if (entry != null && isPositiveNumber(entry) && input.side) {
    const { side } = input;
    const sl = plan.initialStopLoss;
    const checkAbove = (price: number | null | undefined) =>
      price != null && isPositiveNumber(price) && price <= entry;
    const checkBelow = (price: number | null | undefined) =>
      price != null && isPositiveNumber(price) && price >= entry;

    if (side === "BUY") {
      if (sl >= entry) {
        return {
          code: "INITIAL_STOP_LOSS_INVALID",
          message: MANAGEMENT_PLAN_ERROR_MESSAGES.INITIAL_STOP_LOSS_INVALID,
        };
      }
      if (t1.enabled && checkAbove(t1.price)) {
        return { code: "TAKE1_PRICE_REQUIRED", message: MANAGEMENT_PLAN_ERROR_MESSAGES.TAKE1_PRICE_REQUIRED };
      }
      if (t2.enabled && checkAbove(t2.price)) {
        return { code: "TAKE2_PRICE_REQUIRED", message: MANAGEMENT_PLAN_ERROR_MESSAGES.TAKE2_PRICE_REQUIRED };
      }
      if (
        plan.trailingStop.enabled &&
        checkAbove(plan.trailingStop.triggerPrice)
      ) {
        return {
          code: "TRAILING_TRIGGER_PRICE_REQUIRED",
          message: MANAGEMENT_PLAN_ERROR_MESSAGES.TRAILING_TRIGGER_PRICE_REQUIRED,
        };
      }
    } else {
      if (sl <= entry) {
        return {
          code: "INITIAL_STOP_LOSS_INVALID",
          message: MANAGEMENT_PLAN_ERROR_MESSAGES.INITIAL_STOP_LOSS_INVALID,
        };
      }
      if (t1.enabled && checkBelow(t1.price)) {
        return { code: "TAKE1_PRICE_REQUIRED", message: MANAGEMENT_PLAN_ERROR_MESSAGES.TAKE1_PRICE_REQUIRED };
      }
      if (t2.enabled && checkBelow(t2.price)) {
        return { code: "TAKE2_PRICE_REQUIRED", message: MANAGEMENT_PLAN_ERROR_MESSAGES.TAKE2_PRICE_REQUIRED };
      }
      if (
        plan.trailingStop.enabled &&
        checkBelow(plan.trailingStop.triggerPrice)
      ) {
        return {
          code: "TRAILING_TRIGGER_PRICE_REQUIRED",
          message: MANAGEMENT_PLAN_ERROR_MESSAGES.TRAILING_TRIGGER_PRICE_REQUIRED,
        };
      }
    }
  }

  return null;
}

export function formatManagementPlanListSummary(
  plan: RealManualManagementPlan | null | undefined
): string {
  if (!plan) return "—";
  const parts = [`SL ${plan.initialStopLoss}`];
  const t1 = plan.takes[0];
  const t2 = plan.takes[1];
  parts.push(t1.enabled ? `T1@${t1.price ?? "?"}` : "T1 off");
  parts.push(t2.enabled ? `T2@${t2.price ?? "?"}` : "T2 off");
  parts.push(plan.breakEven.enabled ? `BE:${plan.breakEven.trigger}` : "BE off");
  parts.push(plan.trailingStop.enabled ? "TS on" : "TS off");
  return parts.join(" · ");
}

export function parseManagementPlanFromJson(
  value: unknown
): RealManualManagementPlan | null {
  const parsed = managementPlanSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function extractManagementEventsFromLogs(
  logs: { metadata: unknown; createdAt: Date }[]
): Array<{ event: string; createdAt: Date }> {
  const events: Array<{ event: string; createdAt: Date }> = [];
  for (const log of logs) {
    if (!log.metadata || typeof log.metadata !== "object" || Array.isArray(log.metadata)) {
      continue;
    }
    const meta = log.metadata as Record<string, unknown>;
    const event =
      typeof meta.event === "string"
        ? meta.event
        : typeof meta.managementEvent === "string"
          ? meta.managementEvent
          : null;
    if (event && MANAGEMENT_EVENT_CODES.includes(event as ManagementEventCode)) {
      events.push({ event, createdAt: log.createdAt });
    }
  }
  return events;
}
