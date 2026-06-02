export const REAL_MANUAL_PREFLIGHT_MAX_AGE_MS = 15 * 60 * 1000;

export type RealManualOrderType = "MARKET" | "LIMIT" | "STOP";

export type RealManualOrderInput = {
  orderType: RealManualOrderType;
  orderPrice?: number | null;
  stopLossPrice?: number | null;
  takeProfitPrice?: number | null;
};

export type RealManualOrderValidationError = {
  code: string;
  message: string;
};

const ERROR_MESSAGES: Record<string, string> = {
  ORDER_PRICE_REQUIRED_FOR_PENDING_ORDER:
    "Informe o preço de apregoamento para ordens LIMIT ou STOP.",
  ORDER_PRICE_INVALID: "Preço de apregoamento inválido.",
  ORDER_PRICE_NOT_ALLOWED_FOR_MARKET:
    "Ordem a mercado não deve conter preço de apregoamento.",
  STOP_LOSS_REQUIRED: "Informe o preço do Stop Loss.",
  TAKE_PROFIT_REQUIRED: "Informe o preço do Take Profit.",
  STOP_LOSS_INVALID: "Preço de Stop Loss inválido.",
  TAKE_PROFIT_INVALID: "Preço de Take Profit inválido.",
  ORDER_TYPE_INVALID: "Tipo de ordem inválido.",
};

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function validateRealManualOrderFields(
  input: RealManualOrderInput
): RealManualOrderValidationError | null {
  const orderType = input.orderType;
  if (!["MARKET", "LIMIT", "STOP"].includes(orderType)) {
    return { code: "ORDER_TYPE_INVALID", message: ERROR_MESSAGES.ORDER_TYPE_INVALID };
  }

  if (orderType === "MARKET" && input.orderPrice != null) {
    return {
      code: "ORDER_PRICE_NOT_ALLOWED_FOR_MARKET",
      message: ERROR_MESSAGES.ORDER_PRICE_NOT_ALLOWED_FOR_MARKET,
    };
  }

  if ((orderType === "LIMIT" || orderType === "STOP") && input.orderPrice == null) {
    return {
      code: "ORDER_PRICE_REQUIRED_FOR_PENDING_ORDER",
      message: ERROR_MESSAGES.ORDER_PRICE_REQUIRED_FOR_PENDING_ORDER,
    };
  }

  if (input.orderPrice != null && !isPositiveNumber(input.orderPrice)) {
    return { code: "ORDER_PRICE_INVALID", message: ERROR_MESSAGES.ORDER_PRICE_INVALID };
  }

  if (input.stopLossPrice == null) {
    return { code: "STOP_LOSS_REQUIRED", message: ERROR_MESSAGES.STOP_LOSS_REQUIRED };
  }
  if (!isPositiveNumber(input.stopLossPrice)) {
    return { code: "STOP_LOSS_INVALID", message: ERROR_MESSAGES.STOP_LOSS_INVALID };
  }

  if (input.takeProfitPrice == null) {
    return { code: "TAKE_PROFIT_REQUIRED", message: ERROR_MESSAGES.TAKE_PROFIT_REQUIRED };
  }
  if (!isPositiveNumber(input.takeProfitPrice)) {
    return { code: "TAKE_PROFIT_INVALID", message: ERROR_MESSAGES.TAKE_PROFIT_INVALID };
  }

  return null;
}

export function parseOptionalPositive(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

export function slTpDirectionHint(
  side: "BUY" | "SELL",
  entryPrice?: number
): string {
  if (side === "BUY") {
    return entryPrice
      ? "BUY: stop geralmente abaixo do preço de entrada; take geralmente acima."
      : "BUY: stop geralmente abaixo do preço de entrada; take geralmente acima.";
  }
  return entryPrice
    ? "SELL: stop geralmente acima do preço de entrada; take geralmente abaixo."
    : "SELL: stop geralmente acima do preço de entrada; take geralmente abaixo.";
}
