"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { DailyRiskExistingConfigView } from "@/lib/admin/daily-financial-risk-admin";
import type {
  DailyRiskEligibleLicense,
  DailyRiskOperationalStatus,
} from "@/lib/admin/daily-risk-eligible-licenses";
import { formatDailyRiskLicenseLabel } from "@/lib/admin/daily-risk-eligible-licenses";

const REPORT_STATUS_LABELS = {
  OK: "OK",
  STALE: "STALE",
  MISSING: "MISSING",
} as const;

function formatReportTrace(row: DailyRiskExistingConfigView["reportTrace"]) {
  if (!row.reportReceived) {
    return {
      summary: "Configuração existe, mas nenhum relatório diário foi recebido do EA.",
      lastReport: "—",
      pnl: "—",
    };
  }
  return {
    summary: REPORT_STATUS_LABELS[row.reportStatus],
    lastReport: row.lastReportAt
      ? new Date(row.lastReportAt).toLocaleString("pt-BR")
      : "—",
    pnl: `R$ ${row.realizedPnlBrl?.toFixed(2) ?? "0.00"} / R$ ${row.openPnlBrl?.toFixed(2) ?? "0.00"} / R$ ${row.totalPnlBrl?.toFixed(2) ?? "0.00"}`,
  };
}

const STATUS_LABELS: Record<DailyRiskOperationalStatus, string> = {
  CONFIGURED: "Configurado",
  NOT_CONFIGURED: "Não configurado",
  INACTIVE: "Inativo",
  NO_MT5_ACCOUNT: "Sem conta MT5",
  STRATEGY_NOT_ENABLED: "Estratégia não habilitada",
};

type SaveError = {
  ok: false;
  code: string;
  message: string;
  detail?: string;
  actionHint?: string;
};

export function DailyRiskAdminPanel({
  eligibleLicenses,
  existingConfigs,
  preselectedLicenseId = "",
}: {
  eligibleLicenses: DailyRiskEligibleLicense[];
  existingConfigs: DailyRiskExistingConfigView[];
  preselectedLicenseId?: string;
}) {
  const router = useRouter();
  const selectableLicenses = useMemo(
    () => eligibleLicenses.filter((row) => row.selectable),
    [eligibleLicenses]
  );

  const initialLicenseId =
    preselectedLicenseId &&
    selectableLicenses.some((l) => l.licenseId === preselectedLicenseId)
      ? preselectedLicenseId
      : selectableLicenses[0]?.licenseId ?? "";

  const [selectedLicenseId, setSelectedLicenseId] = useState(initialLicenseId);
  const [limitBrl, setLimitBrl] = useState("500");
  const [enabled, setEnabled] = useState(true);
  const [includeOpen, setIncludeOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<SaveError | null>(null);
  const [highlightLicenseId, setHighlightLicenseId] = useState(
    preselectedLicenseId || ""
  );

  const selected = useMemo(
    () => eligibleLicenses.find((l) => l.licenseId === selectedLicenseId) ?? null,
    [eligibleLicenses, selectedLicenseId]
  );

  const isEditing = Boolean(selected?.existingDailyRiskLimit);

  const applyLicenseSelection = useCallback(
    (licenseId: string) => {
      const license = eligibleLicenses.find((l) => l.licenseId === licenseId);
      if (!license?.selectable) return;
      setSelectedLicenseId(licenseId);
      setHighlightLicenseId(licenseId);
      if (license.existingDailyRiskLimit) {
        setLimitBrl(String(license.existingDailyRiskLimit.dailyLossLimitCents / 100));
        setEnabled(license.existingDailyRiskLimit.enabled);
        setIncludeOpen(license.existingDailyRiskLimit.includeOpenPnL);
      } else {
        setLimitBrl("500");
        setEnabled(true);
        setIncludeOpen(true);
      }
      setMessage(null);
      setError(null);
    },
    [eligibleLicenses]
  );

  useEffect(() => {
    if (preselectedLicenseId) {
      applyLicenseSelection(preselectedLicenseId);
    }
  }, [preselectedLicenseId, applyLicenseSelection]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected?.selectable) return;

    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/real-trading/daily-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_id: selected.licenseId,
          account_login: selected.accountLogin,
          account_server: selected.accountServer,
          symbol: selected.symbol,
          strategy_code: selected.strategyCode,
          enabled,
          daily_loss_limit_brl: Number(limitBrl),
          include_open_pnl: includeOpen,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        setError(data as SaveError);
        return;
      }
      setMessage(
        data.created
          ? "Stop financeiro diário configurado com sucesso."
          : "Stop financeiro diário atualizado com sucesso."
      );
      router.refresh();
    } catch {
      setError({
        ok: false,
        code: "NETWORK_ERROR",
        message: "Falha de rede ao salvar.",
      });
    } finally {
      setLoading(false);
    }
  }

  function scrollToForm() {
    document.getElementById("daily-risk-form")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      <Card className="border-gold/20 p-6">
        <CardHeader className="p-0">
          <CardTitle>Licenças ativas disponíveis</CardTitle>
          <CardDescription className="mt-2">
            Selecione uma licença com conta MT5 vinculada — o sistema preenche conta,
            servidor, símbolo e estratégia automaticamente.
          </CardDescription>
        </CardHeader>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-muted-foreground">
                <th className="px-2 py-2">Cliente</th>
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Licença</th>
                <th className="px-2 py-2">Conta MT5</th>
                <th className="px-2 py-2">Servidor</th>
                <th className="px-2 py-2">Símbolo</th>
                <th className="px-2 py-2">Magic</th>
                <th className="px-2 py-2">Estratégia</th>
                <th className="px-2 py-2">Stop diário</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {eligibleLicenses.map((row) => {
                const limitBrlDisplay = row.existingDailyRiskLimit
                  ? `R$ ${(row.existingDailyRiskLimit.dailyLossLimitCents / 100).toFixed(2)}`
                  : "—";
                const highlighted = row.licenseId === highlightLicenseId;
                return (
                  <tr
                    key={row.licenseId}
                    className={`border-b border-white/5 ${highlighted ? "bg-gold/10" : ""}`}
                  >
                    <td className="px-2 py-2">{row.clientName ?? "—"}</td>
                    <td className="px-2 py-2">{row.clientEmail}</td>
                    <td className="px-2 py-2 font-mono text-xs">
                      {row.licenseId.slice(0, 10)}…
                    </td>
                    <td className="px-2 py-2 font-mono text-xs">
                      {row.accountLogin ?? "—"}
                    </td>
                    <td className="px-2 py-2">{row.accountServer ?? "—"}</td>
                    <td className="px-2 py-2">{row.symbol ?? "—"}</td>
                    <td className="px-2 py-2">{row.magicNumber ?? "—"}</td>
                    <td className="px-2 py-2">{row.strategyCode}</td>
                    <td className="px-2 py-2">{limitBrlDisplay}</td>
                    <td className="px-2 py-2">
                      {STATUS_LABELS[row.operationalStatus]}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-1">
                        {row.selectable && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              applyLicenseSelection(row.licenseId);
                              scrollToForm();
                            }}
                          >
                            {row.existingDailyRiskLimit
                              ? "Editar configuração"
                              : "Configurar stop diário"}
                          </Button>
                        )}
                        <Link
                          href={`/admin/licenses/${row.licenseId}`}
                          className="inline-flex h-8 items-center rounded-md px-2 text-xs text-gold hover:underline"
                        >
                          Licença
                        </Link>
                        <Link
                          href={`/admin/licenses/${row.licenseId}/strategy-config`}
                          className="inline-flex h-8 items-center rounded-md px-2 text-xs text-gold hover:underline"
                        >
                          Estratégia
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {eligibleLicenses.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-2 py-4 text-muted-foreground">
                    Nenhuma licença ativa encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card id="daily-risk-form" className="border-gold/20 p-6">
        <CardHeader className="p-0">
          <CardTitle>
            {isEditing ? "Editar stop financeiro diário" : "Nova configuração"}
          </CardTitle>
          <CardDescription className="mt-2">
            O cliente vê apenas mensagem genérica de risco diário ativo. Campos de
            identidade são preenchidos pela licença selecionada.
          </CardDescription>
        </CardHeader>

        <form onSubmit={onSubmit} className="mt-6 space-y-4 max-w-2xl">
          <div>
            <label htmlFor="license_select" className="text-sm font-medium">
              Selecionar licença ativa
            </label>
            <select
              id="license_select"
              className="mt-1 w-full rounded-md border border-white/10 bg-background px-3 py-2 text-sm"
              value={selectedLicenseId}
              onChange={(e) => applyLicenseSelection(e.target.value)}
            >
              {selectableLicenses.length === 0 && (
                <option value="">Nenhuma licença elegível</option>
              )}
              {selectableLicenses.map((row) => (
                <option key={row.licenseId} value={row.licenseId}>
                  {formatDailyRiskLicenseLabel(row)}
                </option>
              ))}
            </select>
          </div>

          {isEditing && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Já existe stop financeiro diário configurado para esta licença. Ao
              salvar, a configuração existente será atualizada — não será criada
              duplicidade.
            </p>
          )}

          {selected?.strategyCodeMismatch && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              Existe stop diário com strategyCode divergente (
              <span className="font-mono">{selected.storedStrategyCode}</span>).
              O código canônico é{" "}
              <span className="font-mono">MR_FIBO_D1_GUARD</span>. Salve novamente
              para normalizar sem duplicar.
            </p>
          )}

          {selected && (
            <dl className="grid gap-3 rounded-lg border border-white/10 bg-black/20 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Cliente</dt>
                <dd>{selected.clientName ?? selected.clientEmail}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd>{selected.clientEmail}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">License ID (readonly)</dt>
                <dd className="font-mono text-xs">{selected.licenseId}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Estratégia (readonly)</dt>
                <dd>{selected.strategyCode}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Conta login (readonly)</dt>
                <dd className="font-mono text-xs">{selected.accountLogin}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Servidor (readonly)</dt>
                <dd>{selected.accountServer}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Símbolo (readonly)</dt>
                <dd>{selected.symbol}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Magic (readonly)</dt>
                <dd>{selected.magicNumber ?? "—"}</dd>
              </div>
            </dl>
          )}

          <div>
            <label htmlFor="limit" className="text-sm font-medium">
              Limite diário (R$)
            </label>
            <Input
              id="limit"
              type="number"
              min={0.01}
              step="0.01"
              value={limitBrl}
              onChange={(e) => setLimitBrl(e.target.value)}
              required
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Habilitar stop financeiro diário
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeOpen}
              onChange={(e) => setIncludeOpen(e.target.checked)}
            />
            Considerar PnL aberto (includeOpenPnL)
          </label>

          <Button type="submit" disabled={loading || !selected?.selectable}>
            {loading
              ? "Salvando…"
              : isEditing
                ? "Atualizar stop diário"
                : "Salvar stop diário"}
          </Button>

          {message && (
            <p className="text-sm text-emerald-300">{message}</p>
          )}
          {error && (
            <Card className="border-red-500/40 bg-red-500/5 p-4">
              <p className="text-sm font-medium text-red-200">{error.message}</p>
              <dl className="mt-2 space-y-1 text-xs">
                <div>
                  <dt className="text-muted-foreground">Código</dt>
                  <dd className="font-mono">{error.code}</dd>
                </div>
                {error.detail && (
                  <div>
                    <dt className="text-muted-foreground">Detalhe</dt>
                    <dd>{error.detail}</dd>
                  </div>
                )}
                {error.actionHint && (
                  <div>
                    <dt className="text-muted-foreground">Ação</dt>
                    <dd>{error.actionHint}</dd>
                  </div>
                )}
              </dl>
            </Card>
          )}
        </form>
      </Card>

      <Card className="border-gold/20 p-6">
        <CardHeader className="p-0">
          <CardTitle>Configurações existentes</CardTitle>
        </CardHeader>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-muted-foreground">
                <th className="px-2 py-2">Cliente</th>
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Licença</th>
                <th className="px-2 py-2">Conta</th>
                <th className="px-2 py-2">Servidor</th>
                <th className="px-2 py-2">Símbolo</th>
                <th className="px-2 py-2">Estratégia</th>
                <th className="px-2 py-2">Limite diário</th>
                <th className="px-2 py-2">Include open PnL</th>
                <th className="px-2 py-2">Relatório diário</th>
                <th className="px-2 py-2">stateId</th>
                <th className="px-2 py-2">Último report</th>
                <th className="px-2 py-2">requestId</th>
                <th className="px-2 py-2">Chave salva</th>
                <th className="px-2 py-2">PnL (real/open/total)</th>
                <th className="px-2 py-2">Status config</th>
                <th className="px-2 py-2">Atualizado</th>
                <th className="px-2 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {existingConfigs.map((row) => {
                const report = formatReportTrace(row.reportTrace);
                return (
                <tr key={row.id} className="border-b border-white/5">
                  <td className="px-2 py-2">{row.clientName ?? "—"}</td>
                  <td className="px-2 py-2">{row.clientEmail}</td>
                  <td className="px-2 py-2 font-mono text-xs">
                    {row.licenseId.slice(0, 10)}…
                  </td>
                  <td className="px-2 py-2 font-mono text-xs">{row.accountLogin}</td>
                  <td className="px-2 py-2">{row.accountServer}</td>
                  <td className="px-2 py-2">{row.symbol}</td>
                  <td className="px-2 py-2">{row.strategyCode}</td>
                  <td className="px-2 py-2">
                    R$ {row.dailyLossLimitBrl.toFixed(2)}
                  </td>
                  <td className="px-2 py-2">{row.includeOpenPnL ? "Sim" : "Não"}</td>
                  <td className="px-2 py-2 text-xs">
                    <div>{report.summary}</div>
                    <div className="text-muted-foreground">
                      tradeDate {row.reportTrace.tradeDate}
                    </div>
                    {row.mismatchAlert && (
                      <div className="mt-1 text-amber-200">{row.mismatchAlert}</div>
                    )}
                    {row.nearbyStateKey && !row.stateId && (
                      <div className="mt-1 text-amber-200">
                        Chave divergente encontrada: {row.nearbyStateKey}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 font-mono text-[11px]">
                    {row.stateId ?? "—"}
                  </td>
                  <td className="px-2 py-2 text-xs">{report.lastReport}</td>
                  <td className="px-2 py-2 font-mono text-[11px]">
                    {row.lastReportRequestId ?? "—"}
                  </td>
                  <td className="px-2 py-2 text-xs">{row.savedKeyLabel ?? "—"}</td>
                  <td className="px-2 py-2 text-xs">{report.pnl}</td>
                  <td className="px-2 py-2">
                    {row.enabled ? "Ativo" : "Inativo"}
                  </td>
                  <td className="px-2 py-2 text-xs">
                    {new Date(row.updatedAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Link
                        href={`/admin/real-trading/daily-risk?licenseId=${row.licenseId}`}
                        className="inline-flex h-8 items-center rounded-md px-2 text-xs text-gold hover:underline"
                      >
                        Editar
                      </Link>
                      <Link
                        href={`/admin/licenses/${row.licenseId}`}
                        className="inline-flex h-8 items-center rounded-md px-2 text-xs text-gold hover:underline"
                      >
                        Licença
                      </Link>
                      <Link
                        href="/admin/real-trading/fibo-d1-guard"
                        className="inline-flex h-8 items-center rounded-md px-2 text-xs text-gold hover:underline"
                      >
                        Centro Fibo
                      </Link>
                    </div>
                  </td>
                </tr>
              );})}
              {existingConfigs.length === 0 && (
                <tr>
                  <td colSpan={18} className="px-2 py-4 text-muted-foreground">
                    Nenhum registro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
