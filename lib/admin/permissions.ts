/** Papéis com permissão para ações de emergência (cancelar ordens na fila). */
export const EMERGENCY_ADMIN_ROLES = new Set(["SUPERADMIN", "OPS"]);

export function canRunEmergencyActions(adminRole: string): boolean {
  return EMERGENCY_ADMIN_ROLES.has(adminRole);
}

export function canRunStandardAdminActions(adminRole: string): boolean {
  return ["SUPERADMIN", "SUPPORT", "OPS", "FINANCE"].includes(adminRole);
}

/** Despacho manual de instruções de teste/homologação (fila interna — não estratégia). */
export const INSTRUCTION_DISPATCH_ROLES = new Set(["SUPERADMIN", "OPS"]);

export function canDispatchAdminInstructions(adminRole: string): boolean {
  return INSTRUCTION_DISPATCH_ROLES.has(adminRole);
}

/** Disparo manual de sinais mestre validados (Fase 2.7 — mesmos papéis que fila de instruções). */
export function canDispatchMasterSignals(adminRole: string): boolean {
  return canDispatchAdminInstructions(adminRole);
}
