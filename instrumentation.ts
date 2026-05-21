/**
 * Executado na inicialização do servidor Next.js (deploy / start).
 * Garante falha explícita em produção sem envs críticas.
 */
export async function register() {
  const { assertCriticalEnvAtStartup } = await import("@/lib/env/critical");
  assertCriticalEnvAtStartup();
}
