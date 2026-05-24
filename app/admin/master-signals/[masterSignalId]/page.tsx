import Link from "next/link";
import { notFound } from "next/navigation";
import { MasterSignalStatus } from "@prisma/client";
import { MasterSignalDispatchButton } from "@/components/admin/master-signal-dispatch-button";
import {
  canDispatchMasterSignals,
} from "@/lib/admin/permissions";
import {
  getMasterSignalDetailsForAdmin,
  previewMasterSignalDispatch,
} from "@/lib/master-signals/admin";
import { requireAppRole } from "@/lib/auth/session";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

export default async function AdminMasterSignalDetailPage({
  params,
}: {
  params: Promise<{ masterSignalId: string }>;
}) {
  const session = await requireAppRole("ADMIN");
  const adminRole = session.user.role ?? "";
  const canDispatch = canDispatchMasterSignals(adminRole);
  const { masterSignalId } = await params;

  const [details, preview] = await Promise.all([
    getMasterSignalDetailsForAdmin(masterSignalId),
    previewMasterSignalDispatch(masterSignalId),
  ]);

  if (!details) notFound();

  const { signal, dispatches, instructions } = details;
  const canTriggerDispatch =
    canDispatch && signal.status === MasterSignalStatus.VALIDATED;

  return (
    <div className="space-y-8">
      <p>
        <Link href="/admin/master-signals" className="text-sm text-gold hover:underline">
          ← Voltar para sinais mestre
        </Link>
      </p>

      <Card className="p-6">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="font-mono text-lg">{signal.masterSignalId}</CardTitle>
          <CardDescription>
            Status: {signal.status} · Perfil: {signal.profileSlug ?? "qualquer"} ·
            Expira: {fmtDate(signal.expiresAt)}
          </CardDescription>
        </CardHeader>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Símbolo / lado / ordem</dt>
            <dd>
              {signal.symbol} · {signal.side} · {signal.orderType}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Finalidade / origem</dt>
            <dd>
              {signal.purpose} · {signal.source}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Recebido / validado / disparado</dt>
            <dd>
              {fmtDate(signal.receivedAt)} / {fmtDate(signal.validatedAt)} /{" "}
              {fmtDate(signal.dispatchedAt)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Dispatches / instruções</dt>
            <dd>
              {signal.dispatchCount} / {signal.instructionCount}
            </dd>
          </div>
          {signal.rejectedReason && (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Motivo rejeição</dt>
              <dd>{signal.rejectedReason}</dd>
            </div>
          )}
        </dl>
        {signal.rawPayloadRedacted && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Payload (redigido)
            </p>
            <pre className="mt-2 max-h-48 overflow-auto rounded border border-white/10 bg-black/40 p-3 text-xs">
              {JSON.stringify(signal.rawPayloadRedacted, null, 2)}
            </pre>
          </div>
        )}
      </Card>

      {preview && (
        <Card className="p-6">
          <CardHeader className="p-0 pb-4">
            <CardTitle>Pré-visualização de elegibilidade</CardTitle>
            <CardDescription>
              Somente leitura — não cria instruções nem altera o banco. Candidatos:{" "}
              {preview.candidatesCount} · Elegíveis: {preview.eligibleCount}
            </CardDescription>
          </CardHeader>
          {preview.eligible.length > 0 && (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-4">Licença</th>
                    <th className="py-2 pr-4">Cliente</th>
                    <th className="py-2 pr-4">MT5</th>
                    <th className="py-2">Perfil</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.eligible.map((row) => (
                    <tr key={row.licenseId} className="border-b border-white/5">
                      <td className="py-2 font-mono text-xs">{row.licenseId}</td>
                      <td className="py-2">{row.clientEmail}</td>
                      <td className="py-2">{row.mt5Label ?? "—"}</td>
                      <td className="py-2">{row.exposureProfileSlug ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {preview.skipped.length > 0 && (
            <div className="overflow-x-auto">
              <p className="mb-2 text-xs uppercase text-muted-foreground">
                Ignoradas ({preview.skipped.length})
              </p>
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-4">Licença</th>
                    <th className="py-2 pr-4">Código</th>
                    <th className="py-2">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.skipped.map((row) => (
                    <tr key={row.licenseId} className="border-b border-white/5">
                      <td className="py-2 font-mono text-xs">{row.licenseId}</td>
                      <td className="py-2">{row.code}</td>
                      <td className="py-2 text-muted-foreground">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Card className="p-6">
        <CardHeader className="p-0 pb-4">
          <CardTitle>Disparo para clientes</CardTitle>
        </CardHeader>
        <MasterSignalDispatchButton
          masterSignalId={signal.masterSignalId}
          disabled={!canTriggerDispatch}
          disabledReason={
            !canDispatch
              ? `Papel ${adminRole} não autorizado a disparar.`
              : signal.status !== MasterSignalStatus.VALIDATED
                ? `Status ${signal.status} — disparo só para VALIDATED.`
                : undefined
          }
        />
      </Card>

      <Card className="overflow-hidden p-0">
        <CardHeader className="p-6 pb-0">
          <CardTitle>Dispatches</CardTitle>
          <CardDescription>Trilha sinal × licença</CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase text-muted-foreground">
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Licença</th>
                <th className="px-6 py-3">Cliente</th>
                <th className="px-6 py-3">Instruction</th>
                <th className="px-6 py-3">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {dispatches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-6 text-muted-foreground">
                    Nenhum dispatch registrado.
                  </td>
                </tr>
              ) : (
                dispatches.map((d) => (
                  <tr key={d.id} className="border-b border-white/5">
                    <td className="px-6 py-3">{d.status}</td>
                    <td className="px-6 py-3 font-mono text-xs">{d.licenseId}</td>
                    <td className="px-6 py-3">{d.license.clientEmail}</td>
                    <td className="px-6 py-3 font-mono text-xs">
                      {d.instructionId ?? "—"}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">
                      {d.reason ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <CardHeader className="p-6 pb-0">
          <CardTitle>Instruções e execuções</CardTitle>
        </CardHeader>
        <div className="space-y-4 p-6">
          {instructions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma instrução vinculada.</p>
          ) : (
            instructions.map((inst) => (
              <div
                key={inst.id}
                className="rounded border border-white/10 p-4 text-sm"
              >
                <p>
                  <span className="font-mono text-xs">{inst.id}</span> ·{" "}
                  {inst.currentStatus} · origem {inst.source ?? "—"}
                </p>
                <p className="text-muted-foreground">
                  {inst.symbol} {inst.side} · {inst.purpose} · licença{" "}
                  {inst.licenseId}
                </p>
                {inst.executions.length > 0 && (
                  <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                    {inst.executions.map((ex) => (
                      <li key={ex.id}>
                        {ex.status}
                        {ex.brokerTicket ? ` · ticket ${ex.brokerTicket}` : ""}
                        {ex.executedAt ? ` · ${fmtDate(ex.executedAt)}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
