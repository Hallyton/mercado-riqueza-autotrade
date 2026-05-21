/** Limite padrão para considerar EA offline (sem heartbeat). */
export const EA_OFFLINE_THRESHOLD_SEC = 120;

export function isEaOffline(
  lastSeenAt: Date | null | undefined,
  thresholdSec = EA_OFFLINE_THRESHOLD_SEC,
  now = new Date()
): boolean {
  if (!lastSeenAt) return true;
  const diffMs = now.getTime() - lastSeenAt.getTime();
  return diffMs > thresholdSec * 1000;
}
