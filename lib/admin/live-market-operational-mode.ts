/** Modo operacional único para envio REAL_MANUAL em mercado ao vivo. */
export const LIVE_MARKET_OPERATIONAL_MODE = "LIVE_MARKET" as const;

export type LiveMarketOperationalMode = typeof LIVE_MARKET_OPERATIONAL_MODE;

export function isLiveMarketOperationalMode(
  value: string | null | undefined
): value is LiveMarketOperationalMode {
  return value === LIVE_MARKET_OPERATIONAL_MODE;
}
