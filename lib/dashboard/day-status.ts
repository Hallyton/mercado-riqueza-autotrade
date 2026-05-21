import type { DayOperationalStatus } from "./types";

export const DAY_STATUS_LABELS: Record<DayOperationalStatus, string> = {
  ea_offline: "EA offline",
  risk_blocked: "Bloqueado por proteção de risco",
  positioned: "Posicionado",
  armed_order: "Ordem armada",
  operation_closed: "Operação encerrada",
  awaiting_opportunity: "Aguardando oportunidade",
  no_operation_today: "Sem operação hoje",
};

export const DAY_STATUS_DESCRIPTIONS: Record<DayOperationalStatus, string> = {
  ea_offline:
    "O executor não sincronizou recentemente. Verifique o MT5 e a conexão.",
  risk_blocked:
    "Novas entradas pausadas conforme assinatura, licença ou proteção de capital.",
  positioned: "Há posição aberta na conta vinculada.",
  armed_order: "Há ordem pendente ou instrução aguardando execução.",
  operation_closed:
    "Operações realizadas hoje; no momento sem posição aberta.",
  awaiting_opportunity:
    "Sistema ativo e aguardando próxima instrução autorizada.",
  no_operation_today: "Nenhuma operação registrada na sessão de hoje.",
};

export function dayStatusBadgeClass(status: DayOperationalStatus): string {
  switch (status) {
    case "positioned":
    case "operation_closed":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    case "armed_order":
    case "awaiting_opportunity":
      return "border-gold/40 bg-gold/10 text-gold";
    case "risk_blocked":
      return "border-amber-500/40 bg-amber-500/10 text-amber-300";
    case "ea_offline":
      return "border-red-500/40 bg-red-500/10 text-red-300";
    default:
      return "border-zinc-500/40 bg-zinc-500/10 text-zinc-400";
  }
}

export type DayStatusInput = {
  eaOnline: boolean;
  riskBlocked: boolean;
  hasOpenPosition: boolean;
  hasArmedOrder: boolean;
  hadExecutionToday: boolean;
  canAcceptNewEntries: boolean;
};

export function resolveDayOperationalStatus(
  input: DayStatusInput
): DayOperationalStatus {
  if (!input.eaOnline) return "ea_offline";
  if (input.riskBlocked) return "risk_blocked";
  if (input.hasOpenPosition) return "positioned";
  if (input.hasArmedOrder) return "armed_order";
  if (input.hadExecutionToday && !input.hasOpenPosition) {
    return "operation_closed";
  }
  if (input.canAcceptNewEntries && !input.hasArmedOrder) {
    return "awaiting_opportunity";
  }
  return "no_operation_today";
}
