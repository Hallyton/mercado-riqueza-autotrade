import { DailyFinancialRiskStatus, type DailyFinancialRiskState } from "@prisma/client";
import {
  getDailyRiskStaleThresholdSeconds,
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
  reportAgeSeconds: number | null;
  staleThresholdSeconds: number;
  stateId: string | null;
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
  const staleThresholdSeconds = getDailyRiskStaleThresholdSeconds();

  if (!state || state.tradeDate !== tradeDate) {
    return {
      reportReceived: false,
      reportStatus: "MISSING",
      tradeDate,
      lastReportAt: null,
      reportAgeMinutes: null,
      reportAgeSeconds: null,
      staleThresholdSeconds,
      stateId: null,
      realizedPnlBrl: null,
      openPnlBrl: null,
      totalPnlBrl: null,
      remainingLossBrl: null,
      stateStatus: null,
    };
  }

  const stale = isDailyRiskStateStale(state.lastUpdatedAt);
  const ageMs = Date.now() - state.lastUpdatedAt.getTime();
  const reportAgeSeconds = Math.max(0, Math.floor(ageMs / 1000));

  return {
    reportReceived: true,
    reportStatus: stale ? "STALE" : "OK",
    tradeDate: state.tradeDate,
    lastReportAt: state.lastUpdatedAt.toISOString(),
    reportAgeMinutes: Math.max(0, Math.floor(ageMs / 60_000)),
    reportAgeSeconds,
    staleThresholdSeconds,
    stateId: state.id,
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
    return "Stop financeiro diário configurado, mas o EA ainda não enviou o relatório de PnL/risco do dia para esta conta.";
  }
  if (input.report.reportStatus === "STALE") {
    return "O relatório de risco foi recebido, mas não foi atualizado dentro da janela de segurança. O EA precisa reenviar POST /api/v1/ea/daily-risk/report.";
  }
  return null;
}

export function dailyRiskReportActionHint(reportStatus: DailyRiskReportTraceStatus): string {
  if (reportStatus === "MISSING" || reportStatus === "STALE") {
    return "Use Atualizar status ou verifique se o EA recompilado está rodando com o módulo DailyRisk contínuo.";
  }
  return "Relatório diário recebido e dentro da janela de segurança.";
}

export function formatDailyRiskCompositeStatus(input: {
  stopConfigured: boolean;
  report: DailyRiskReportTrace | null;
}): {
  configuredLabel: string;
  reportLabel: string;
  blockLabel: string | null;
} {
  const report = input.report;
  const reportLabel =
    report?.reportStatus === "OK"
      ? "OK"
      : report?.reportStatus === "STALE"
        ? "STALE"
        : "MISSING";

  return {
    configuredLabel: input.stopConfigured ? "Sim" : "Não",
    reportLabel,
    blockLabel:
      report?.reportStatus === "STALE"
        ? "Report stale"
        : report?.reportStatus === "MISSING"
          ? "Report ausente"
          : null,
  };
}
