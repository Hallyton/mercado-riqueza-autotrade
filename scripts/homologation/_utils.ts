/**
 * Utilitários compartilhados — scripts de homologação local AutoTrade apenas.
 * Não usar em produção. Não altera a ferramenta DARF.
 */

export function assertHomologationNotProduction(scriptName: string): void {
  if (process.env.NODE_ENV === "production") {
    console.error(
      `[homologation:${scriptName}] Abortado: NODE_ENV=production. Estes scripts são apenas para homologação local/demo.`
    );
    process.exit(1);
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`[homologation] Variável obrigatória ausente: ${name}`);
    process.exit(1);
  }
  return value;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
