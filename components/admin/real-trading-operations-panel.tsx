"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FiboHealthCheckButton } from "@/components/admin/fibo-health-check-button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  RealTradingOperationRow,
  RealTradingOperationSummary,
} from "@/lib/admin/real-trading-operation-center";
import {
  OPERATIONAL_COMMAND_CONFIRMATIONS,
  OPERATIONAL_COMMAND_LABELS,
} from "@/lib/operations/operational-command-constants";
import type { EAOperationalCommandType } from "@prisma/client";

function formatBrl(value: number): string {
  return `R$ ${value.toFixed(2)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

function Badge({ label }: { label: string }) {
  const tone =
    label.includes("ONLINE") || label.includes("OK")
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : label.includes("OFFLINE") || label.includes("FALHOU") || label.includes("ATINGIDO")
        ? "border-red-500/40 bg-red-500/10 text-red-300"
        : label.includes("PAUSADO") || label.includes("PENDENTE")
          ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
          : "border-gold/30 bg-gold/10 text-gold";
  return (
    <span className={`mr-1 inline-block rounded-full border px-2 py-0.5 text-[10px] ${tone}`}>
      {label}
    </span>
  );
}

type CommandError = {
  ok: false;
  code: string;
  message: string;
  detail?: string;
};

export function RealTradingOperationsPanel({
  summary,
  rows,
}: {
  summary: RealTradingOperationSummary;
  rows: RealTradingOperationRow[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<{
    licenseId: string;
    row: RealTradingOperationRow;
    commandType: EAOperationalCommandType;
  } | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<CommandError | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const expectedConfirmation = useMemo(() => {
    if (!modal) return "";
    return OPERATIONAL_COMMAND_CONFIRMATIONS[modal.commandType];
  }, [modal]);

  async function submitCommand() {
    if (!modal) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/real-trading/operations/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseId: modal.licenseId,
          commandType: modal.commandType,
          adminConfirmation: confirmation,
          adminNote: adminNote || undefined,
        }),
      });
      const data = (await res.json()) as
        | { ok: true; warning?: string | null; command?: { id: string; status: string } }
        | CommandError;

      if (!res.ok || !("ok" in data) || !data.ok) {
        setError(data as CommandError);
        return;
      }

      setMessage(
        data.warning
          ? `Comando ${data.command?.status}: ${data.warning}`
          : `Comando ${data.command?.status} registrado.`
      );
      setModal(null);
      setConfirmation("");
      setAdminNote("");
      router.refresh();
    } catch {
      setError({
        ok: false,
        code: "NETWORK_ERROR",
        message: "Falha ao enviar comando.",
      });
    } finally {
      setLoading(false);
    }
  }

  function openModal(row: RealTradingOperationRow, commandType: EAOperationalCommandType) {
    setModal({ licenseId: row.licenseId, row, commandType });
    setConfirmation("");
    setAdminNote("");
    setError(null);
  }

  return (
    <div className="space-y-6">
      <Card className="border-gold/20 p-6">
        <CardHeader className="p-0">
          <CardTitle>Resumo geral</CardTitle>
          <CardDescription className="mt-2">
            Monitoramento operacional MR Fibo D1 Guard — status agregado e comandos
            administrativos remotos (sem instruções REAL_MANUAL).
          </CardDescription>
        </CardHeader>
        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Clientes monitorados</dt>
            <dd className="text-lg font-semibold">{summary.monitoredClients}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">EAs online / offline</dt>
            <dd className="text-lg font-semibold">
              {summary.easOnline} / {summary.easOffline}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Em operação</dt>
            <dd className="text-lg font-semibold">{summary.clientsInOperation}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Posições / pendentes</dt>
            <dd className="text-lg font-semibold">
              {summary.openPositions} / {summary.pendingOrders}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">PnL dia consolidado</dt>
            <dd className="text-lg font-semibold">{formatBrl(summary.consolidatedPnlDayBrl)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">PnL mês consolidado</dt>
            <dd className="text-lg font-semibold">{formatBrl(summary.consolidatedPnlMonthBrl)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Limite diário alocado</dt>
            <dd className="text-lg font-semibold">{formatBrl(summary.dailyLimitTotalBrl)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Usado / restante</dt>
            <dd className="text-lg font-semibold">
              {formatBrl(summary.dailyUsedTotalBrl)} / {formatBrl(summary.dailyRemainingTotalBrl)}
            </dd>
          </div>
        </dl>
      </Card>

      {message && (
        <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </div>
      )}

      <Card className="border-gold/20 p-5">
        <CardTitle className="text-base">Operações por cliente</CardTitle>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1200px] text-xs">
            <thead>
              <tr className="border-b border-white/10 text-left text-muted-foreground">
                <th className="py-2 pr-2">Cliente</th>
                <th className="py-2 pr-2">Conta MT5</th>
                <th className="py-2 pr-2">Símbolo</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Posição</th>
                <th className="py-2 pr-2">PnL dia</th>
                <th className="py-2 pr-2">PnL mês</th>
                <th className="py-2 pr-2">Stop diário</th>
                <th className="py-2 pr-2">Pendentes</th>
                <th className="py-2 pr-2">DailyRisk pregão</th>
                <th className="py-2 pr-2">Liveness</th>
                <th className="py-2 pr-2">Heartbeat</th>
                <th className="py-2 pr-2">Último comando</th>
                <th className="py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.licenseId} className="border-b border-white/5 align-top">
                  <td className="py-2 pr-2">
                    <div>{row.userName ?? "—"}</div>
                    <div className="text-muted-foreground">{row.userEmail}</div>
                    <Link href={row.detailHref} className="text-gold hover:underline">
                      Detalhe
                    </Link>
                  </td>
                  <td className="py-2 pr-2 font-mono">
                    {row.accountLogin ?? "—"}@{row.accountServer ?? "—"}
                    <div>magic {row.magicNumber ?? "—"}</div>
                  </td>
                  <td className="py-2 pr-2">{row.symbol ?? "—"}</td>
                  <td className="py-2 pr-2">
                    {row.badges.map((b) => (
                      <Badge key={b} label={b} />
                    ))}
                  </td>
                  <td className="py-2 pr-2">
                    {row.hasOpenPosition ? (
                      <>
                        {row.positionSide} {row.positionVolume ?? "—"} @{" "}
                        {row.positionAveragePrice ?? "—"}
                        <div>{formatBrl(row.positionOpenPnlBrl)} aberto</div>
                      </>
                    ) : (
                      "Sem posição"
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    <div>{formatBrl(row.totalPnlDayBrl)}</div>
                    <div className="text-muted-foreground">
                      real. {formatBrl(row.realizedPnlDayBrl)}
                    </div>
                  </td>
                  <td className="py-2 pr-2">{formatBrl(row.totalPnlMonthBrl)}</td>
                  <td className="py-2 pr-2">
                    <div>{formatBrl(row.dailyLimitBrl)}</div>
                    <div className="text-muted-foreground">
                      usado {formatBrl(row.dailyUsedBrl)} · rest. {formatBrl(row.dailyRemainingBrl)}
                    </div>
                  </td>
                  <td className="py-2 pr-2">{row.pendingOrdersCount}</td>
                  <td className="py-2 pr-2">
                    <div className="font-mono">{row.dailyRiskPolicyStatus ?? "—"}</div>
                    <div className="text-muted-foreground">{row.dailyRiskPolicyReason ?? "—"}</div>
                  </td>
                  <td className="py-2 pr-2">
                    <div className="font-mono">{row.livenessStatus}</div>
                    <div className="text-muted-foreground">{row.livenessMessage}</div>
                    <div className="mt-1 text-muted-foreground">
                      {row.lastActivitySource ?? "—"}
                      {row.lastActivityAgeSeconds != null
                        ? ` · há ${row.lastActivityAgeSeconds}s`
                        : ""}
                    </div>
                    <div className="mt-2">
                      <FiboHealthCheckButton
                        licenseId={row.licenseId}
                        latestStatus={
                          row.lastCommandType === "HEALTH_CHECK"
                            ? row.lastCommandStatus
                            : null
                        }
                      />
                    </div>
                  </td>
                  <td className="py-2 pr-2">{formatDate(row.lastHeartbeatAt)}</td>
                  <td className="py-2 pr-2">
                    {row.lastCommandType ?? "—"}
                    <div className="text-muted-foreground">{row.lastCommandStatus ?? "—"}</div>
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      {(
                        [
                          "PAUSE_NEW_ENTRIES",
                          "RESUME_TRADING",
                          "CANCEL_PENDING_ORDERS",
                          "CLOSE_OPEN_POSITION",
                          "FLATTEN_AND_PAUSE",
                          "REFRESH_STATUS",
                        ] as EAOperationalCommandType[]
                      ).map((type) => (
                        <Button
                          key={type}
                          type="button"
                          variant="outline"
                          className="h-7 border-gold/30 px-2 text-[10px]"
                          onClick={() => openModal(row, type)}
                        >
                          {OPERATIONAL_COMMAND_LABELS[type].split(" ")[0]}
                        </Button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto border-gold/30 p-6">
            <CardTitle className="text-lg">
              {OPERATIONAL_COMMAND_LABELS[modal.commandType]}
            </CardTitle>
            <CardDescription className="mt-2">
              {modal.commandType === "FLATTEN_AND_PAUSE"
                ? "Esta ação tentará cancelar ordens pendentes, encerrar posições abertas e pausar novas entradas para esta licença."
                : "Comando operacional remoto — não cria instrução REAL_MANUAL."}
            </CardDescription>

            <dl className="mt-4 space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Cliente</dt>
                <dd>
                  {modal.row.userName ?? modal.row.userEmail} — {modal.row.symbol}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Posição</dt>
                <dd>
                  {modal.row.hasOpenPosition
                    ? `${modal.row.positionSide} ${modal.row.positionVolume} · PnL ${formatBrl(modal.row.positionOpenPnlBrl)}`
                    : "Sem posição aberta"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Pendentes</dt>
                <dd>{modal.row.pendingOrdersCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Limite diário restante</dt>
                <dd>{formatBrl(modal.row.dailyRemainingBrl)}</dd>
              </div>
            </dl>

            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                Confirmação textual
                <Input
                  className="mt-1"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder={expectedConfirmation}
                />
              </label>
              <label className="block text-sm">
                Nota admin (opcional)
                <Input
                  className="mt-1"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                />
              </label>
            </div>

            {error && (
              <p className="mt-3 text-sm text-red-300">
                {error.message}
                {error.detail ? ` — ${error.detail}` : ""}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setModal(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={loading || confirmation.trim() !== expectedConfirmation}
                onClick={submitCommand}
              >
                {loading ? "Enviando…" : "Confirmar comando"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
