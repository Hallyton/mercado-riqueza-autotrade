"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  mrFiboD1GuardConfigSchema,
  type MrFiboD1GuardConfig,
} from "@/lib/strategy/mr-fibo-d1-guard-config";
import type { getStrategyConfigAdminView } from "@/lib/admin/strategy-runtime-config";

type AdminView = NonNullable<Awaited<ReturnType<typeof getStrategyConfigAdminView>>>;

type HistoryRow = {
  id: string;
  action: string;
  version: number;
  status: string;
  configHash: string;
  notes: string | null;
  createdAt: string;
  actor: { name: string | null; email: string };
};

function FieldRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 border-b border-white/5 py-3 sm:grid-cols-[220px_1fr]">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

function GroupCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-gold/20 p-5">
      <CardHeader className="p-0">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <div className="mt-3">{children}</div>
    </Card>
  );
}

export function LicenseStrategyConfigForm({ view }: { view: AdminView }) {
  const router = useRouter();
  const [config, setConfig] = useState<MrFiboD1GuardConfig>(view.config);
  const [notes, setNotes] = useState(view.draft?.notes ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const validation = useMemo(() => {
    const parsed = mrFiboD1GuardConfigSchema.safeParse(config);
    if (!parsed.success) {
      return parsed.error.issues.map((i) => i.message);
    }
    if (config.risk.loteTotal > view.identification.maxContracts) {
      return [
        `Lote total excede maxContracts (${view.identification.maxContracts}).`,
      ];
    }
    return [];
  }, [config, view.identification.maxContracts]);

  function patchConfig(updater: (prev: MrFiboD1GuardConfig) => MrFiboD1GuardConfig) {
    setConfig((prev) => updater(prev));
    setError(null);
  }

  async function loadHistory() {
    const res = await fetch(
      `/api/admin/licenses/${view.licenseId}/strategy-config/history`
    );
    const data = await res.json();
    if (res.ok) {
      setHistory(data.history ?? []);
      setHistoryLoaded(true);
    }
  }

  async function postAction(
    action: "draft" | "publish" | "reset-default" | "archive",
    body?: Record<string, unknown>
  ) {
    setBusy(action);
    setError(null);
    setMessage(null);
    try {
      const path =
        action === "draft"
          ? "draft"
          : action === "publish"
            ? "publish"
            : action === "reset-default"
              ? "reset-default"
              : "archive";
      const res = await fetch(
        `/api/admin/licenses/${view.licenseId}/strategy-config/${path}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body ?? {}),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Falha na operação.");
        return;
      }
      if (action === "draft" && data.draft?.config) {
        setConfig(data.draft.config);
        setMessage("Rascunho salvo.");
      } else if (action === "publish") {
        setMessage(
          data.warnings?.length
            ? `Publicado com avisos: ${data.warnings.join(" ")}`
            : "Configuração publicada."
        );
      } else if (action === "reset-default" && data.draft?.config) {
        setConfig(data.draft.config);
        setMessage("Padrão restaurado no rascunho.");
      } else if (action === "archive") {
        setMessage("Rascunho arquivado.");
      }
      router.refresh();
    } catch {
      setError("Falha de rede.");
    } finally {
      setBusy(null);
    }
  }

  const daily = view.dailyRisk[0];

  return (
    <div className="space-y-6">
      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        {view.eaSyncNotice}
      </p>

      {view.blockers.length > 0 && (
        <ul className="rounded-lg border border-amber-500/20 p-4 text-sm text-amber-200">
          {view.blockers.map((code) => (
            <li key={code} className="font-mono text-xs">
              {code}
            </li>
          ))}
        </ul>
      )}

      {validation.length > 0 && (
        <ul className="rounded-lg border border-red-500/30 p-4 text-sm text-red-300">
          {validation.map((msg) => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
      )}

      <GroupCard title="01 — Identificação">
        <FieldRow label="Nome da estratégia">
          <Input value={view.strategyName} readOnly disabled />
        </FieldRow>
        <FieldRow label="Código">
          <Input value={view.strategyCode} readOnly disabled className="font-mono" />
        </FieldRow>
        <FieldRow label="RobotInstanceId">
          <Input value={view.identification.robotInstanceId ?? "—"} readOnly disabled />
        </FieldRow>
        <FieldRow label="LicenseId">
          <Input value={view.identification.licenseId} readOnly disabled className="font-mono text-xs" />
        </FieldRow>
        <FieldRow label="Conta MT5">
          <Input value={view.identification.mt5Account ?? "—"} readOnly disabled />
        </FieldRow>
        <FieldRow label="Símbolo">
          <Input value={view.identification.symbol ?? "—"} readOnly disabled />
        </FieldRow>
        <FieldRow label="MagicNumber">
          <Input value={String(view.identification.magicNumber ?? "—")} readOnly disabled />
        </FieldRow>
        <FieldRow label="MaxContracts">
          <Input value={String(view.identification.maxContracts)} readOnly disabled />
        </FieldRow>
      </GroupCard>

      <GroupCard title="02 — Estratégia Fibo D1">
        <FieldRow
          label="Percentual Fibo"
          description="Percentual usado para cálculo dos níveis internos da estratégia."
        >
          <Input
            type="number"
            step="0.01"
            min={0.01}
            max={0.99}
            value={config.fiboD1.percentualFibo}
            onChange={(e) =>
              patchConfig((prev) => ({
                ...prev,
                fiboD1: { percentualFibo: Number(e.target.value) },
              }))
            }
          />
        </FieldRow>
      </GroupCard>

      <GroupCard title="03 — Gestão de Risco">
        <FieldRow label="Lote total / contratos">
          <Input
            type="number"
            min={1}
            value={config.risk.loteTotal}
            onChange={(e) =>
              patchConfig((prev) => ({
                ...prev,
                risk: { ...prev.risk, loteTotal: Number(e.target.value) },
              }))
            }
          />
        </FieldRow>
        <FieldRow label="Stop em pontos">
          <Input
            type="number"
            min={1}
            value={config.risk.stopPontos}
            onChange={(e) =>
              patchConfig((prev) => ({
                ...prev,
                risk: { ...prev.risk, stopPontos: Number(e.target.value) },
              }))
            }
          />
        </FieldRow>
      </GroupCard>

      <GroupCard title="04 — Parciais e Trailing">
        {(
          [
            ["Alvo 1 em pontos", "alvo1Pontos"],
            ["Alvo 2 em pontos", "alvo2Pontos"],
            ["Lote Alvo 1", "loteAlvo1"],
            ["Lote Alvo 2", "loteAlvo2"],
            ["Lote final", "loteFinal"],
            ["Trail step (pontos)", "trailStepPontos"],
            ["Trail offset (pontos)", "trailOffsetPontos"],
          ] as const
        ).map(([label, key]) => (
          <FieldRow key={key} label={label}>
            <Input
              type="number"
              value={config.partialsAndTrailing[key]}
              onChange={(e) =>
                patchConfig((prev) => ({
                  ...prev,
                  partialsAndTrailing: {
                    ...prev.partialsAndTrailing,
                    [key]: Number(e.target.value),
                  },
                }))
              }
            />
          </FieldRow>
        ))}
      </GroupCard>

      <GroupCard title="05 — Horários Operacionais">
        <FieldRow label="Horário início">
          <Input
            value={config.operationalHours.horarioInicio}
            onChange={(e) =>
              patchConfig((prev) => ({
                ...prev,
                operationalHours: {
                  ...prev.operationalHours,
                  horarioInicio: e.target.value,
                },
              }))
            }
          />
        </FieldRow>
        <FieldRow label="Horário fim entradas">
          <Input
            value={config.operationalHours.horarioFimEntradas}
            onChange={(e) =>
              patchConfig((prev) => ({
                ...prev,
                operationalHours: {
                  ...prev.operationalHours,
                  horarioFimEntradas: e.target.value,
                },
              }))
            }
          />
        </FieldRow>
        <FieldRow label="Horário zeragem">
          <Input
            value={config.operationalHours.horarioZeragem}
            onChange={(e) =>
              patchConfig((prev) => ({
                ...prev,
                operationalHours: {
                  ...prev.operationalHours,
                  horarioZeragem: e.target.value,
                },
              }))
            }
          />
        </FieldRow>
        <FieldRow label="Minutos antes para preparar">
          <Input
            type="number"
            min={0}
            value={config.operationalHours.minutosAntesParaPreparar}
            onChange={(e) =>
              patchConfig((prev) => ({
                ...prev,
                operationalHours: {
                  ...prev.operationalHours,
                  minutosAntesParaPreparar: Number(e.target.value),
                },
              }))
            }
          />
        </FieldRow>
      </GroupCard>

      <GroupCard title="06 — Execução e Spread">
        <FieldRow label="Slippage points">
          <Input
            type="number"
            min={0}
            value={config.executionAndSpread.slippagePoints}
            onChange={(e) =>
              patchConfig((prev) => ({
                ...prev,
                executionAndSpread: {
                  ...prev.executionAndSpread,
                  slippagePoints: Number(e.target.value),
                },
              }))
            }
          />
        </FieldRow>
        <FieldRow label="Max spread (pontos)" description="0 = sem bloqueio por spread.">
          <Input
            type="number"
            min={0}
            value={config.executionAndSpread.maxSpreadPontos}
            onChange={(e) =>
              patchConfig((prev) => ({
                ...prev,
                executionAndSpread: {
                  ...prev.executionAndSpread,
                  maxSpreadPontos: Number(e.target.value),
                },
              }))
            }
          />
        </FieldRow>
      </GroupCard>

      <GroupCard title="07 — Dólar B3 / Normalização">
        <FieldRow label="Tick operacional dólar">
          <Input
            type="number"
            step="0.1"
            min={0.1}
            value={config.b3DollarNormalization.tickOperacionalDolar}
            onChange={(e) =>
              patchConfig((prev) => ({
                ...prev,
                b3DollarNormalization: {
                  ...prev.b3DollarNormalization,
                  tickOperacionalDolar: Number(e.target.value),
                },
              }))
            }
          />
        </FieldRow>
        <FieldRow label="Dígitos preço operacional">
          <Input
            type="number"
            min={0}
            value={config.b3DollarNormalization.digitosPrecoOperacional}
            onChange={(e) =>
              patchConfig((prev) => ({
                ...prev,
                b3DollarNormalization: {
                  ...prev.b3DollarNormalization,
                  digitosPrecoOperacional: Number(e.target.value),
                },
              }))
            }
          />
        </FieldRow>
      </GroupCard>

      <GroupCard title="08 — Segurança / Ambiente">
        <FieldRow label="Políticas da plataforma (readonly)">
          <ul className="text-sm text-muted-foreground">
            <li>Demo: permitido</li>
            <li>Real: somente via site</li>
            <li>
              Daily Financial Stop:{" "}
              {view.platformPolicy.requerDailyFinancialStop ? "obrigatório" : "opcional"}
            </li>
            <li>PRE_MARKET: {view.platformPolicy.requerPreMarket ? "sim" : "não"}</li>
            <li>Approval: {view.platformPolicy.requerApproval ? "sim" : "não"}</li>
          </ul>
        </FieldRow>
      </GroupCard>

      <GroupCard title="11 — Stop financeiro diário">
        {daily ? (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Habilitado</dt>
              <dd>{daily.enabled ? "Sim" : "Não"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Limite diário (R$)</dt>
              <dd>{daily.dailyLossLimitBrl.toFixed(2)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">PnL atual</dt>
              <dd>{daily.currentPnlBrl.toFixed(2)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Perda restante</dt>
              <dd>{daily.remainingLossBrl.toFixed(2)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd>{daily.status}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">Stop diário não configurado.</p>
        )}
        <Link
          href={`/admin/real-trading/daily-risk?license_id=${view.licenseId}`}
          className="mt-4 inline-block text-sm text-gold hover:underline"
        >
          Configurar stop financeiro diário →
        </Link>
      </GroupCard>

      <GroupCard title="12 — Publicação / versão da configuração">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Rascunho</dt>
            <dd>{view.draft?.status ?? "—"} v{view.draft?.version ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Publicada</dt>
            <dd>
              {view.published
                ? `${view.published.status} v${view.published.version}`
                : "Nenhuma"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Publicado em</dt>
            <dd>
              {view.published?.publishedAt
                ? new Date(view.published.publishedAt).toLocaleString("pt-BR")
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Publicado por</dt>
            <dd>{view.published?.publishedBy?.email ?? "—"}</dd>
          </div>
        </dl>
        <FieldRow label="Notas da versão">
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas opcionais para auditoria"
          />
        </FieldRow>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={busy !== null || validation.length > 0}
            onClick={() => postAction("draft", { config, notes })}
          >
            {busy === "draft" ? "Salvando…" : "Salvar rascunho"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null || validation.length > 0}
            onClick={() => postAction("publish", { notes })}
          >
            {busy === "publish" ? "Publicando…" : "Publicar configuração"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null}
            onClick={() => postAction("reset-default")}
          >
            Restaurar padrão
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy !== null || !view.draft}
            onClick={() => postAction("archive")}
          >
            Arquivar rascunho
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (!historyLoaded) void loadHistory();
            }}
          >
            {historyLoaded ? "Histórico carregado" : "Carregar histórico"}
          </Button>
        </div>
        {historyLoaded && history.length > 0 && (
          <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
            {history.map((row) => (
              <li key={row.id} className="rounded border border-white/10 p-2">
                {new Date(row.createdAt).toLocaleString("pt-BR")} · {row.action} · v
                {row.version} · {row.configHash.slice(0, 12)}… · {row.actor.email}
              </li>
            ))}
          </ul>
        )}
      </GroupCard>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-emerald-400">{message}</p>}
    </div>
  );
}
