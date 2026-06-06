import { EAOperationalCommandType } from "@prisma/client";

export const OPERATIONAL_COMMAND_CONFIRMATIONS: Record<
  EAOperationalCommandType,
  string
> = {
  PAUSE_NEW_ENTRIES: "PAUSAR NOVAS ENTRADAS",
  RESUME_TRADING: "RETOMAR OPERACOES",
  CANCEL_PENDING_ORDERS: "CANCELAR ORDENS PENDENTES",
  CLOSE_OPEN_POSITION: "ENCERRAR POSICAO ABERTA",
  CLOSE_ALL_POSITIONS: "ENCERRAR TODAS AS POSICOES",
  FLATTEN_AND_PAUSE: "ENCERRAR TUDO E PAUSAR",
  REFRESH_STATUS: "ATUALIZAR STATUS",
};

export const OPERATIONAL_COMMAND_EXPIRY_MS = 2 * 60 * 1000;

export const CRITICAL_OPERATIONAL_COMMANDS = new Set<EAOperationalCommandType>([
  EAOperationalCommandType.CANCEL_PENDING_ORDERS,
  EAOperationalCommandType.CLOSE_OPEN_POSITION,
  EAOperationalCommandType.CLOSE_ALL_POSITIONS,
  EAOperationalCommandType.FLATTEN_AND_PAUSE,
]);

export const OPERATIONAL_COMMAND_LABELS: Record<EAOperationalCommandType, string> = {
  PAUSE_NEW_ENTRIES: "Pausar novas entradas",
  RESUME_TRADING: "Retomar operações",
  CANCEL_PENDING_ORDERS: "Cancelar ordens pendentes",
  CLOSE_OPEN_POSITION: "Encerrar posição aberta",
  CLOSE_ALL_POSITIONS: "Encerrar todas as posições",
  FLATTEN_AND_PAUSE: "Encerrar tudo e pausar",
  REFRESH_STATUS: "Atualizar status",
};
