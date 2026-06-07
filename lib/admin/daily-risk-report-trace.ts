import { DailyFinancialRiskStatus, type DailyFinancialRiskState } from "@prisma/client";
import {
  DAILY_RISK_POSITION_PENDING_THRESHOLD_SEC,
  type DailyRiskFreshnessPolicyResult,
  policyStatusLabel,
} from "@/lib/risk/daily-risk-freshness-policy";
import { tradeDateKeySaoPaulo } from "@/lib/risk/daily-financial-risk";

export type DailyRiskReportTraceStatus =
  | "OK"
  | "OK_FOR_DAY"
  | "RECENT_OK"
  | "STALE"
  | "MISSING"
  | "REVALIDATION_REQUIRED";

export type DailyRiskReportTrace = {
  reportReceived: boolean;
  reportStatus: DailyRiskReportTraceStatus;
  policyStatus: string | null;
  policyReasonCode: string | null;
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
  hasOpenPosition: boolean | null;
  pendingOrdersCount: number | null;
  latestExecutionAfterReport: boolean | null;
  latestAdminChangeAfterReport: boolean | null;
};

function mapPolicyToReportStatus(
  policy: DailyRiskFreshnessPolicyResult
): DailyRiskReportTraceStatus {
  const label = policyStatusLabel(policy.status);
  if (label === "OK_FOR_DAY" || label === "RECENT_OK") return label;
  if (label === "REVALIDATION_REQUIRED") return "REVALIDATION_REQUIRED";
  if (label === "MISSING") return "MISSING";
  return "STALE";
}

export function buildDailyRiskReportTrace(
  state: DailyFinancialRiskState | null | undefined,
  tradeDate: string = tradeDateKeySaoPaulo(),
  policy?: DailyRiskFreshnessPolicyResult | null
): DailyRiskReportTrace {
  const staleThresholdSeconds = DAILY_RISK_POSITION_PENDING_THRESHOLD_SEC;

  if (!state || state.tradeDate !== tradeDate) {
    return {
      reportReceived: false,
      reportStatus: "MISSING",
      policyStatus: policy?.status ?? "MISSING",
      policyReasonCode: policy?.reasonCode ?? "DAILY_RISK_REPORT_MISSING",
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
      hasOpenPosition: policy?.details.hasOpenPosition ?? null,
      pendingOrdersCount: policy?.details.pendingOrdersCount ?? null,
      latestExecutionAfterReport:
        policy?.details.latestExecutionAfterReport ?? null,
      latestAdminChangeAfterReport:
        policy?.details.latestAdminChangeAfterReport ?? null,
    };
  }

  const lastReportAt = state.lastReportReceivedAt ?? state.lastUpdatedAt;
  const ageMs = Date.now() - lastReportAt.getTime();
  const reportAgeSeconds = Math.max(0, Math.floor(ageMs / 1000));
  const reportStatus = policy
    ? mapPolicyToReportStatus(policy)
    : reportAgeSeconds > staleThresholdSeconds
      ? "STALE"
      : "OK";

  return {
    reportReceived: true,
    reportStatus,
    policyStatus: policy?.status ?? null,
    policyReasonCode: policy?.reasonCode ?? null,
    tradeDate: state.tradeDate,
    lastReportAt: lastReportAt.toISOString(),
    reportAgeMinutes: Math.max(0, Math.floor(ageMs / 60_000)),
    reportAgeSeconds,
    staleThresholdSeconds,
    stateId: state.id,
    realizedPnlBrl: state.realizedPnlCents / 100,
    openPnlBrl: state.openPnlCents / 100,
    totalPnlBrl: state.totalPnlCents / 100,
    remainingLossBrl: state.remainingLossCents / 100,
    stateStatus: state.status,
    hasOpenPosition: policy?.details.hasOpenPosition ?? null,
    pendingOrdersCount: policy?.details.pendingOrdersCount ?? null,
    latestExecutionAfterReport:
      policy?.details.latestExecutionAfterReport ?? null,
    latestAdminChangeAfterReport:
      policy?.details.latestAdminChangeAfterReport ?? null,
  };
}

export function dailyRiskReportOperationalMessage(input: {
  limitConfigured: boolean;
  report: DailyRiskReportTrace;
  policyMessage?: string | null;
}): string | null {
  if (!input.limitConfigured) return null;
  if (input.report.reportStatus === "MISSING") {
    return "Stop financeiro diário configurado, mas o EA ainda não enviou o relatório de PnL/risco do dia para esta conta.";
  }
  if (
    input.report.reportStatus === "OK_FOR_DAY" ||
    input.report.reportStatus === "RECENT_OK" ||
    input.report.reportStatus === "OK"
  ) {
    return (
      input.policyMessage ??
      "DailyRisk OK para o pregão. Último report recebido hoje. Sem posição aberta, sem ordens pendentes e sem execução após o report."
    );
  }
  if (input.report.reportStatus === "REVALIDATION_REQUIRED") {
    return (
      input.policyMessage ??
      "DailyRisk precisa ser reenviado após evento operacional ou alteração administrativa."
    );
  }
  return (
    input.policyMessage ??
    "O DailyRisk precisa ser atualizado — posição aberta, ordens pendentes ou report desatualizado para o contexto operacional."
  );
}

export function dailyRiskReportActionHint(
  reportStatus: DailyRiskReportTraceStatus
): string {
  if (reportStatus === "MISSING") {
    return "Use Atualizar status ou verifique se o EA recompilado está rodando com o módulo DailyRisk contínuo.";
  }
  if (reportStatus === "OK_FOR_DAY" || reportStatus === "RECENT_OK" || reportStatus === "OK") {
    return "Relatório diário válido para o pregão enquanto não houver operação ou evento invalidante.";
  }
  if (reportStatus === "REVALIDATION_REQUIRED") {
    return "Aguardar novo report após o evento ou usar HEALTH_CHECK.";
  }
  return "Use Atualizar status ou aguarde DailyRisk recente enquanto houver exposição operacional.";
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
    report?.policyStatus ??
    (report?.reportStatus === "OK" ||
    report?.reportStatus === "OK_FOR_DAY" ||
    report?.reportStatus === "RECENT_OK"
      ? report.reportStatus
      : report?.reportStatus === "REVALIDATION_REQUIRED"
        ? "REVALIDATION_REQUIRED"
        : report?.reportStatus === "STALE"
          ? "STALE"
          : "MISSING");

  return {
    configuredLabel: input.stopConfigured ? "Sim" : "Não",
    reportLabel,
    blockLabel:
      reportLabel === "STALE" || reportLabel === "REVALIDATION_REQUIRED"
        ? `Report ${reportLabel.toLowerCase()}`
        : reportLabel === "MISSING"
          ? "Report ausente"
          : null,
  };
}

export function isDailyRiskPlatformBlockReason(reasonCode: string): boolean {
  return [
    "DAILY_FINANCIAL_STOP_NOT_CONFIGURED",
    "DAILY_FINANCIAL_STOP_STRATEGY_MISMATCH",
    "DAILY_FINANCIAL_STOP_REACHED",
    "DAILY_FINANCIAL_STOP_WOULD_BE_EXCEEDED",
    "DAILY_RISK_REPORT_MISSING",
    "DAILY_RISK_REPORT_STALE",
    "DAILY_RISK_REPORT_DATE_MISMATCH",
    "DAILY_RISK_TRADE_DATE_MISMATCH",
    "POSITION_RISK_REPORT_STALE",
    "PENDING_ORDERS_RISK_REPORT_STALE",
    "DAILY_RISK_REVALIDATION_REQUIRED_AFTER_TRADE",
    "DAILY_RISK_REVALIDATION_REQUIRED_AFTER_ADMIN_CHANGE",
  ].includes(reasonCode);
}
