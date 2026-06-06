import { DailyFinancialRiskStatus, type DailyFinancialRiskState } from "@prisma/client";
import {
  isDailyRiskStateStale,
  tradeDateKeySaoPaulo,
} from "@/lib/risk/daily-financial-risk";

export type DailyRiskReportTraceStatus = "OK" | "STALE" | "MISSING";

export type DailyRiskReportTrace = {
  reportReceived: boolean;
  reportStatus: DailyRiskReportTraceStatus;
  tradeDate: string;
  lastReportAt: string | null;
  reportAgeMinutes: number | null;
  realizedPnlBrl: number | null;
  openPnlBrl: number | null;
  totalPnlBrl: number | null;
  remainingLossBrl: number | null;
  stateStatus: DailyFinancialRiskStatus | null;
};

export function buildDailyRiskReportTrace(
  state: DailyFinancialRiskState | null | undefined,
  tradeDate: string = tradeDateKeySaoPaulo()
): DailyRiskReportTrace {
  if (!state || state.tradeDate !== tradeDate) {
    return {
      reportReceived: false,
      reportStatus: "MISSING",
      tradeDate,
      lastReportAt: null,
      reportAgeMinutes: null,
      realizedPnlBrl: null,
      openPnlBrl: null,
      totalPnlBrl: null,
      remainingLossBrl: null,
      stateStatus: null,
    };
  }

  const stale = isDailyRiskStateStale(state.lastUpdatedAt);
  const ageMs = Date.now() - state.lastUpdatedAt.getTime();

  return {
    reportReceived: true,
    reportStatus: stale ? "STALE" : "OK",
    tradeDate: state.tradeDate,
    lastReportAt: state.lastUpdatedAt.toISOString(),
    reportAgeMinutes: Math.max(0, Math.floor(ageMs / 60_000)),
    realizedPnlBrl: state.realizedPnlCents / 100,
    openPnlBrl: state.openPnlCents / 100,
    totalPnlBrl: state.totalPnlCents / 100,
    remainingLossBrl: state.remainingLossCents / 100,
    stateStatus: state.status,
  };
}

export function dailyRiskReportOperationalMessage(input: {
  limitConfigured: boolean;
  report: DailyRiskReportTrace;
}): string | null {
  if (!input.limitConfigured) return null;
  if (input.report.reportStatus === "MISSING") {
    return "Stop diário configurado, mas o EA ainda não enviou o relatório de PnL/risco do dia para esta conta.";
  }
  if (input.report.reportStatus === "STALE") {
    return `Stop diário configurado, mas o último relatório (${input.report.lastReportAt}) está desatualizado.`;
  }
  return null;
}

export function dailyRiskReportActionHint(reportStatus: DailyRiskReportTraceStatus): string {
  if (reportStatus === "MISSING" || reportStatus === "STALE") {
    return "Verificar se o EA atualizado está online e enviando POST /api/v1/ea/daily-risk/report.";
  }
  return "Relatório diário recebido.";
}
