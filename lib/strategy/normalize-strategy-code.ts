import { MR_FIBO_D1_GUARD_CODE } from "@/lib/risk/autonomous-strategy-reasons";

const MR_FIBO_ALIASES = new Set([
  "fibo-d1-guard",
  "fibod1guard",
  "fibo_d1_guard",
  "mr-fibo-d1-guard",
  "mrfibod1guard",
  "fibo_d1",
  "fibod1",
  "mr fibo d1 guard",
  "mr_fibo_d1_guard",
  "fibo d1 guard",
]);

function compactStrategyKey(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, "");
}

export function isMrFiboD1GuardStrategyAlias(strategyCode: string): boolean {
  const trimmed = strategyCode.trim();
  if (!trimmed || trimmed === MR_FIBO_D1_GUARD_CODE) return false;
  if (MR_FIBO_ALIASES.has(trimmed.toLowerCase())) return true;
  return compactStrategyKey(trimmed) === "mrfibod1guard";
}

/**
 * Normaliza aliases conhecidos do MR Fibo D1 Guard para MR_FIBO_D1_GUARD.
 * Outros códigos de estratégia permanecem inalterados.
 */
export function normalizeStrategyCode(
  strategyCode: string | null | undefined
): string {
  const trimmed = (strategyCode ?? "").trim();
  if (!trimmed) return MR_FIBO_D1_GUARD_CODE;
  if (trimmed === MR_FIBO_D1_GUARD_CODE) return MR_FIBO_D1_GUARD_CODE;
  if (isMrFiboD1GuardStrategyAlias(trimmed)) return MR_FIBO_D1_GUARD_CODE;
  return trimmed;
}

export function normalizeFiboStrategyCode(
  strategyCode: string | null | undefined
): string {
  return normalizeStrategyCode(strategyCode);
}
