import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getFiboD1GuardOperationCenterView } from "@/lib/admin/fibo-d1-guard-operation-center";

function ClientTable({
  title,
  rows,
}: {
  title: string;
  rows: Awaited<
    ReturnType<typeof getFiboD1GuardOperationCenterView>
  >["clients"]["ready"];
}) {
  if (rows.length === 0) {
    return (
      <Card className="border-gold/20 p-5">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="mt-3 text-sm text-muted-foreground">Nenhum cliente nesta categoria.</p>
      </Card>
    );
  }

  return (
    <Card className="border-gold/20 p-5">
      <CardTitle className="text-base">{title}</CardTitle>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-muted-foreground">
              <th className="py-2 pr-3">Cliente</th>
              <th className="py-2 pr-3">Conta</th>
              <th className="py-2 pr-3">Contratos</th>
              <th className="py-2 pr-3">Risco est.</th>
              <th className="py-2 pr-3">EA</th>
              <th className="py-2 pr-3">Motivo / ação</th>
              <th className="py-2">Links</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.licenseId} className="border-b border-white/5">
                <td className="py-2 pr-3">
                  <div>{row.userName ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{row.userEmail}</div>
                </td>
                <td className="py-2 pr-3 font-mono text-xs">
                  {row.accountLogin ?? "—"}@{row.accountServer ?? "—"}
                  <div>{row.symbol ?? "—"} · magic {row.magicNumber ?? "—"}</div>
                </td>
                <td className="py-2 pr-3">{row.configuredContracts ?? "—"}</td>
                <td className="py-2 pr-3">
                  {row.estimatedRiskBrl != null
                    ? `R$ ${row.estimatedRiskBrl.toFixed(2)}`
                    : "—"}
                </td>
                <td className="py-2 pr-3">{row.eaOnline ? "Online" : "Offline"}</td>
                <td className="py-2 pr-3 text-xs">
                  {row.reasonCodes.length > 0 ? (
                    <div className="space-y-2">
                      <ul>
                        {row.reasonCodes.map((c) => (
                          <li key={c}>
                            <span className="font-mono">{c}</span>
                            {" — "}
                            {row.actionHints[row.reasonCodes.indexOf(c)] ?? ""}
                          </li>
                        ))}
                      </ul>
                      {row.dailyRiskDiagnostic &&
                        row.reasonCodes.some((code) =>
                          code.startsWith("DAILY_FINANCIAL_STOP")
                        ) && (
                          <dl className="rounded border border-white/10 bg-black/20 p-2 text-[11px]">
                            <div>
                              <dt className="text-muted-foreground">Stop diário</dt>
                              <dd>
                                {row.dailyRiskDiagnostic.foundDailyRiskLimit
                                  ? "encontrado"
                                  : "não encontrado"}{" "}
                                · esperado{" "}
                                {row.dailyRiskDiagnostic.expectedStrategyCode}
                                {row.dailyRiskDiagnostic.foundDailyRiskStrategyCode &&
                                  ` · salvo ${row.dailyRiskDiagnostic.foundDailyRiskStrategyCode}`}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">Conta / símbolo</dt>
                              <dd>
                                {row.dailyRiskDiagnostic.accountLogin ?? "—"}@
                                {row.dailyRiskDiagnostic.accountServer ?? "—"} ·{" "}
                                {row.dailyRiskDiagnostic.symbol ?? "—"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">Limite / status</dt>
                              <dd>
                                {row.dailyRiskDiagnostic.dailyLimitBrl != null
                                  ? `R$ ${row.dailyRiskDiagnostic.dailyLimitBrl.toFixed(2)}`
                                  : "—"}{" "}
                                · enabled{" "}
                                {row.dailyRiskDiagnostic.enabled == null
                                  ? "—"
                                  : row.dailyRiskDiagnostic.enabled
                                    ? "sim"
                                    : "não"}{" "}
                                · includeOpenPnL{" "}
                                {row.dailyRiskDiagnostic.includeOpenPnL == null
                                  ? "—"
                                  : row.dailyRiskDiagnostic.includeOpenPnL
                                    ? "sim"
                                    : "não"}
                              </dd>
                            </div>
                            {row.dailyRiskDiagnostic.detailMessage && (
                              <div>
                                <dt className="text-muted-foreground">Diagnóstico</dt>
                                <dd>{row.dailyRiskDiagnostic.detailMessage}</dd>
                              </div>
                            )}
                          </dl>
                        )}
                    </div>
                  ) : (
                    "PRONTO PARA OPERAR"
                  )}
                </td>
                <td className="py-2 text-xs">
                  <Link href={row.licenseHref} className="text-gold hover:underline">
                    Licença
                  </Link>
                  {" · "}
                  <Link
                    href={row.strategyConfigHref}
                    className="text-gold hover:underline"
                  >
                    Configurar parâmetros
                  </Link>
                  {" · "}
                  <Link href={row.approvalHref} className="text-gold hover:underline">
                    Aprovação
                  </Link>
                  {" · "}
                  <Link href={row.dailyRiskHref} className="text-gold hover:underline">
                    Stop diário
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default async function FiboD1GuardOperationCenterPage() {
  const view = await getFiboD1GuardOperationCenterView();

  return (
    <div className="space-y-6">
      <Card className="border-gold/20 p-6">
        <CardHeader className="p-0">
          <CardTitle>MR Fibo D1 Guard — Centro operacional</CardTitle>
          <CardDescription className="mt-2">
            v2 Simple License Guard — configuração, elegibilidade e prontidão EA/MT5 em
            uma única visão. A estratégia executa e gerencia internamente; o site
            autoriza entradas/reversões via can-trade.
          </CardDescription>
        </CardHeader>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">ENABLE_AUTONOMOUS_STRATEGY</dt>
            <dd>{view.global.autonomousStrategyServerEnabled ? "true" : "false"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">ENABLE_REAL_TRADING</dt>
            <dd>{view.global.realTradingEnabled ? "true" : "false"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Atualizado</dt>
            <dd>{new Date(view.generatedAt).toLocaleString("pt-BR")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Prontos</dt>
            <dd className="text-emerald-400">{view.global.readyCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Elegíveis · EA não pronto</dt>
            <dd className="text-amber-300">{view.global.eaNotReadyCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Bloqueados plataforma</dt>
            <dd className="text-red-300">{view.global.blockedCount}</dd>
          </div>
        </dl>
      </Card>

      <Card className="border-gold/20 p-5">
        <CardTitle className="text-base">Configuração padrão (referência)</CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">
          Contratos {view.defaultConfig.risk.loteTotal} · Stop{" "}
          {view.defaultConfig.risk.stopPontos} pts · T1{" "}
          {view.defaultConfig.partialsAndTrailing.alvo1Pontos} / T2{" "}
          {view.defaultConfig.partialsAndTrailing.alvo2Pontos}. Edite e publique por
          licença em Configurar parâmetros.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Percentual Fibo default: {view.defaultConfig.fiboD1.percentualFibo} · Horário{" "}
          {view.defaultConfig.operationalHours.horarioInicio}–
          {view.defaultConfig.operationalHours.horarioFimEntradas}
        </p>
      </Card>

      <ClientTable title="Clientes prontos para operar" rows={view.clients.ready} />
      <ClientTable
        title="Elegíveis pela plataforma, mas EA/MT5 não pronto"
        rows={view.clients.eaNotReady}
      />
      <ClientTable
        title="Não elegíveis pela plataforma"
        rows={view.clients.blocked}
      />

      <Card className="border-gold/20 p-5">
        <CardTitle className="text-base">Últimas autorizações / bloqueios</CardTitle>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-muted-foreground">
                <th className="py-2 pr-3">Quando</th>
                <th className="py-2 pr-3">Cliente</th>
                <th className="py-2 pr-3">Ação</th>
                <th className="py-2 pr-3">Lado</th>
                <th className="py-2 pr-3">Allowed</th>
                <th className="py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {view.recentDecisions.map((d) => (
                <tr key={d.id} className="border-b border-white/5">
                  <td className="py-2 pr-3 text-xs">
                    {new Date(d.createdAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="py-2 pr-3">{d.clientEmail}</td>
                  <td className="py-2 pr-3">{d.action ?? "—"}</td>
                  <td className="py-2 pr-3">{d.side}</td>
                  <td className="py-2 pr-3">{d.allowed ? "true" : "false"}</td>
                  <td className="py-2 font-mono text-xs">{d.reasonCode ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Link
          href="/admin/real-trading/autonomous-strategy"
          className="mt-4 inline-block text-sm text-gold hover:underline"
        >
          Ver auditoria completa →
        </Link>
      </Card>
    </div>
  );
}
