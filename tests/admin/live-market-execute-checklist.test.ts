import { describe, expect, it } from "vitest";
import {
  isLiveMarketChecklistComplete,
  LIVE_MARKET_EXECUTE_CHECKLIST_ITEMS,
  liveMarketExecuteChecklistSchema,
} from "@/lib/admin/live-market-execute-checklist";

describe("live market execute checklist", () => {
  it("exige 15 itens marcados", () => {
    expect(LIVE_MARKET_EXECUTE_CHECKLIST_ITEMS).toHaveLength(15);
  });

  it("valida checklist completo", () => {
    const complete = LIVE_MARKET_EXECUTE_CHECKLIST_ITEMS.reduce(
      (acc, item) => {
        acc[item.key] = true;
        return acc;
      },
      {} as Record<string, boolean>
    );
    expect(liveMarketExecuteChecklistSchema.safeParse(complete).success).toBe(true);
    expect(isLiveMarketChecklistComplete(complete)).toBe(true);
  });

  it("rejeita checklist incompleto", () => {
    expect(isLiveMarketChecklistComplete({ marketOpen: true })).toBe(false);
  });
});
