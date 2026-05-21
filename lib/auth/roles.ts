/** Papéis expostos na sessão da aplicação (requisito: ADMIN | CLIENT). */
export type AppRole = "ADMIN" | "CLIENT";

/** Roles Prisma mapeadas para ADMIN (sem importar @prisma/client no middleware Edge). */
const ADMIN_ROLE_NAMES = new Set([
  "SUPERADMIN",
  "SUPPORT",
  "OPS",
  "FINANCE",
  "STRATEGY_OPS",
]);

export function toAppRole(role: string): AppRole {
  return ADMIN_ROLE_NAMES.has(role) ? "ADMIN" : "CLIENT";
}

export function isAdminRole(role: string): boolean {
  return ADMIN_ROLE_NAMES.has(role);
}

/** Rotas internas — cliente nunca acessa (estratégia / vault / APIs internas). */
export const INTERNAL_ROUTE_PREFIXES = [
  "/admin/strategy",
  "/admin/vault",
  "/api/internal",
  "/api/admin/strategy",
] as const;

export function isInternalRoute(pathname: string): boolean {
  return INTERNAL_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
