import { z } from "zod";

export const LIVE_MARKET_EXECUTE_CHECKLIST_ITEMS = [
  {
    key: "marketOpen",
    label: "Conferi que o mercado está aberto e operacional.",
  },
  {
    key: "selectedEligible",
    label: "Conferi que os clientes selecionados estão elegíveis.",
  },
  {
    key: "blockedExcluded",
    label: "Conferi que bloqueados não receberão instruction.",
  },
  {
    key: "sideConfirmed",
    label: "Conferi o lado BUY/SELL.",
  },
  {
    key: "orderTypeConfirmed",
    label: "Conferi o tipo MARKET/LIMIT/STOP.",
  },
  {
    key: "orderPriceConfirmed",
    label: "Conferi o preço de apregoamento quando LIMIT/STOP.",
  },
  {
    key: "initialStopLossConfirmed",
    label: "Conferi Stop Loss inicial.",
  },
  {
    key: "take1Confirmed",
    label: "Conferi Take 1.",
  },
  {
    key: "take2Confirmed",
    label: "Conferi Take 2, se habilitado.",
  },
  {
    key: "breakEvenConfirmed",
    label: "Conferi Breakeven, se habilitado.",
  },
  {
    key: "trailingStopConfirmed",
    label: "Conferi Trailing Stop, se habilitado.",
  },
  {
    key: "quantityConfirmed",
    label: "Conferi quantidade por cliente.",
  },
  {
    key: "individualInstructionsConfirmed",
    label: "Conferi que cada cliente terá uma instruction individual.",
  },
  {
    key: "liveMarketAwareness",
    label: "Entendo que esta ação é para mercado real ao vivo.",
  },
  {
    key: "monitoringConfirmed",
    label: "Estou acompanhando o MT5/VPS e o painel de proteção.",
  },
] as const;

export type LiveMarketChecklistKey =
  (typeof LIVE_MARKET_EXECUTE_CHECKLIST_ITEMS)[number]["key"];

const checklistShape = LIVE_MARKET_EXECUTE_CHECKLIST_ITEMS.reduce(
  (acc, item) => {
    acc[item.key] = z.literal(true);
    return acc;
  },
  {} as Record<LiveMarketChecklistKey, z.ZodLiteral<true>>
);

export const liveMarketExecuteChecklistSchema = z.object(checklistShape);

export type LiveMarketExecuteChecklist = z.infer<
  typeof liveMarketExecuteChecklistSchema
>;

export function isLiveMarketChecklistComplete(
  checklist: Partial<Record<LiveMarketChecklistKey, boolean>> | null | undefined
): checklist is LiveMarketExecuteChecklist {
  return liveMarketExecuteChecklistSchema.safeParse(checklist).success;
}
