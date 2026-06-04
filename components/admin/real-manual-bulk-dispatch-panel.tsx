"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BULK_DISPATCH_CONFIRM_PHRASE,
  BULK_DISPATCH_LIVE_AWARENESS_PHRASE,
  bulkDispatchCountConfirmPhrase,
} from "@/lib/admin/real-manual-bulk-dispatch";
import {
  LIVE_MARKET_EXECUTE_CHECKLIST_ITEMS,
  type LiveMarketChecklistKey,
} from "@/lib/admin/live-market-execute-checklist";
import { createDefaultManagementPlan } from "@/lib/admin/real-manual-management-plan";
import { parseOptionalPositive } from "@/lib/admin/real-manual-dispatch-validation";
import {
  ManagementPlanFormState,
  RealManualManagementPlanFields,
  validateManagementPlanForm,
} from "@/components/admin/real-manual-management-plan-fields";
import { LiveMarketReadinessCard } from "@/components/admin/live-market-readiness-card";

type PreviewEligible = {
  licenseId: string;
  clientName: string;
  email: string;
  accountLogin: string;
  accountServer: string;
  symbol: string;
  magicNumber: number;
  requestedContracts: number;
  maxContracts: number;
  freeMargin: number | null;
  eaOnline: boolean;
  deviceActiveReal: boolean;
  heartbeatAt: string | null;
  approvalId: string;
  accountSnapshotId: string | null;
  status: string;
  links: {
    license: string;
    approval: string;
    snapshots: string;
    instructions: string;
  };
};

type PreviewBlocked = {
  licenseId: string;
  clientName: string;
  email: string;
  accountLogin: string | null;
  accountServer: string | null;
  expectedSymbol: string;
  magicNumber: number | null;
  reasonCode: string;
  reasonDetail: string;
  actionHint: string;
  links: Record<string, string | null>;
};

type PreviewResult = {
  batchPreviewId: string;
  expiresAt: string;
  summary: {
    totalCandidates: number;
    eligibleCount: number;
    blockedCount: number;
  };
  eligible: PreviewEligible[];
  blocked: PreviewBlocked[];
};

type ExecuteResult = {
  batchId: string;
  status: string;
  message?: string;
  links?: {
    batch: string;
    instructions: string;
    protection: string;
  };
  summary: {
    selected: number;
    dispatched: number;
    skipped: number;
    blockedAtExecute?: number;
    failed: number;
  };
  items: Array<{
    licenseId: string;
    status: string;
    instructionId?: string;
    preflightId?: string;
    reasonCode?: string;
    actionHint?: string;
  }>;
};

const EMPTY_CHECKLIST = LIVE_MARKET_EXECUTE_CHECKLIST_ITEMS.reduce(
  (acc, item) => {
    acc[item.key] = false;
    return acc;
  },
  {} as Record<LiveMarketChecklistKey, boolean>
);

export function RealManualBulkDispatchPanel() {
  const router = useRouter();
  const [symbol, setSymbol] = useState("WDON26");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT" | "STOP">("LIMIT");
  const [orderPrice, setOrderPrice] = useState("");
  const [requestedContracts, setRequestedContracts] = useState("1");
  const [managementPlan, setManagementPlan] = useState<ManagementPlanFormState>(
    createDefaultManagementPlan()
  );
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [checklist, setChecklist] =
    useState<Record<LiveMarketChecklistKey, boolean>>(EMPTY_CHECKLIST);
  const [confirm1, setConfirm1] = useState("");
  const [confirm2, setConfirm2] = useState("");
  const [confirm3, setConfirm3] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [executeResult, setExecuteResult] = useState<ExecuteResult | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  const selectedKey = useMemo(() => [...selected].sort().join(","), [selected]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setConfirm1("");
    setConfirm2("");
    setConfirm3("");
    setChecklist({ ...EMPTY_CHECKLIST });
  }, [selectedKey]);

  const previewExpired = preview
    ? new Date(preview.expiresAt).getTime() <= nowMs
    : false;

  const minutesLeft = preview
    ? Math.max(0, Math.ceil((new Date(preview.expiresAt).getTime() - nowMs) / 60000))
    : 0;

  const selectedCount = selected.size;
  const expectedConfirm2 = bulkDispatchCountConfirmPhrase(selectedCount);

  const checklistComplete = LIVE_MARKET_EXECUTE_CHECKLIST_ITEMS.every(
    (item) => checklist[item.key]
  );

  const parsedContracts = useMemo(() => {
    const n = Number.parseInt(requestedContracts, 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }, [requestedContracts]);

  const entryHintPrice =
    orderType !== "MARKET" ? parseOptionalPositive(orderPrice) : undefined;

  function toggleLicense(licenseId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(licenseId)) next.delete(licenseId);
      else next.add(licenseId);
      return next;
    });
  }

  function buildLiveMarketChecklistPayload() {
    return LIVE_MARKET_EXECUTE_CHECKLIST_ITEMS.reduce(
      (acc, item) => {
        acc[item.key] = true as const;
        return acc;
      },
      {} as Record<LiveMarketChecklistKey, true>
    );
  }

  function buildPreviewPayload() {
    const parsedOrderPrice =
      orderType === "MARKET" ? undefined : parseOptionalPositive(orderPrice);
    const planError = validateManagementPlanForm({
      plan: managementPlan,
      requestedContracts: parsedContracts,
      side,
      entryPrice: parsedOrderPrice,
    });
    if (planError) {
      setMessage(planError);
      return null;
    }
    return {
      symbol: symbol.trim().toUpperCase(),
      side,
      orderType,
      orderPrice: parsedOrderPrice,
      requestedContracts: parsedContracts,
      managementPlan: {
        ...managementPlan,
        initialStopLoss: managementPlan.initialStopLoss,
      },
    };
  }

  async function onPreview() {
    setMessage(null);
    setExecuteResult(null);
    const payload = buildPreviewPayload();
    if (!payload) return;

    setBusy(true);
    try {
      const res = await fetch("/api/admin/real-trading/bulk-dispatch/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Falha na pré-validação.");
        return;
      }
      setPreview(data);
      setSelected(new Set(data.eligible.map((e: PreviewEligible) => e.licenseId)));
    } catch {
      setMessage("Erro de rede ao validar elegibilidade.");
    } finally {
      setBusy(false);
    }
  }

  async function onExecute() {
    if (!preview || previewExpired) {
      setMessage("Preview expirado. Revalide a elegibilidade.");
      return;
    }
    if (selectedCount === 0) {
      setMessage("Selecione ao menos um cliente elegível.");
      return;
    }
    if (!checklistComplete) {
      setMessage("Marque todos os itens do checklist final.");
      return;
    }
    if (confirm1.trim() !== BULK_DISPATCH_CONFIRM_PHRASE) {
      setMessage(`Digite exatamente: ${BULK_DISPATCH_CONFIRM_PHRASE}`);
      return;
    }
    if (confirm2.trim() !== expectedConfirm2) {
      setMessage(`Digite exatamente: ${expectedConfirm2}`);
      return;
    }
    if (confirm3.trim() !== BULK_DISPATCH_LIVE_AWARENESS_PHRASE) {
      setMessage(`Digite exatamente: ${BULK_DISPATCH_LIVE_AWARENESS_PHRASE}`);
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/real-trading/bulk-dispatch/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchPreviewId: preview.batchPreviewId,
          selectedLicenseIds: [...selected],
          adminConfirmation: confirm1.trim(),
          adminConfirmationCount: confirm2.trim(),
          adminConfirmationLiveAwareness: confirm3.trim(),
          liveMarketChecklist: buildLiveMarketChecklistPayload(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Falha no disparo em lote.");
        return;
      }
      setExecuteResult(data);
      router.refresh();
    } catch {
      setMessage("Erro de rede ao executar disparo.");
    } finally {
      setBusy(false);
    }
  }

  const executeEnabled =
    !busy &&
    !previewExpired &&
    selectedCount > 0 &&
    checklistComplete &&
    confirm1.trim() === BULK_DISPATCH_CONFIRM_PHRASE &&
    confirm2.trim() === expectedConfirm2 &&
    confirm3.trim() === BULK_DISPATCH_LIVE_AWARENESS_PHRASE;

  return (
    <div className="space-y-8">
      <LiveMarketReadinessCard
        previewBatchId={preview?.batchPreviewId ?? null}
        previewExpiresAt={preview?.expiresAt ?? null}
        eligibleCount={preview?.summary.eligibleCount ?? null}
        blockedCount={preview?.summary.blockedCount ?? null}
        selectedCount={selectedCount}
      />

      <section className="rounded-lg border border-gold/20 bg-black/30 p-5 space-y-4">
        <h2 className="text-lg font-semibold text-gold">Bloco 1 — Parâmetros da ordem</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-sm">
            <span className="text-muted-foreground">Símbolo</span>
            <input
              className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Lado</span>
            <select
              className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2"
              value={side}
              onChange={(e) => setSide(e.target.value as "BUY" | "SELL")}
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Tipo de ordem</span>
            <select
              className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2"
              value={orderType}
              onChange={(e) =>
                setOrderType(e.target.value as "MARKET" | "LIMIT" | "STOP")
              }
            >
              <option value="MARKET">MARKET</option>
              <option value="LIMIT">LIMIT</option>
              <option value="STOP">STOP</option>
            </select>
          </label>
          {orderType !== "MARKET" && (
            <label className="block text-sm">
              <span className="text-muted-foreground">Preço de apregoamento</span>
              <input
                className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono"
                value={orderPrice}
                onChange={(e) => setOrderPrice(e.target.value)}
              />
            </label>
          )}
          <label className="block text-sm">
            <span className="text-muted-foreground">Contratos por cliente</span>
            <input
              className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono"
              value={requestedContracts}
              onChange={(e) => setRequestedContracts(e.target.value)}
            />
          </label>
        </div>
        <RealManualManagementPlanFields
          plan={managementPlan}
          onChange={setManagementPlan}
          side={side}
          entryPrice={entryHintPrice}
          requestedContracts={parsedContracts}
        />
      </section>

      <section className="rounded-lg border border-white/10 bg-black/20 p-5 space-y-3">
        <h2 className="text-lg font-semibold">Bloco 2 — Pré-validação de elegibilidade</h2>
        <p className="text-sm text-muted-foreground">
          Este passo lista e classifica clientes. Não cria instruction.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={onPreview}
          className="rounded bg-gold px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          Validar clientes elegíveis
        </button>
      </section>

      {preview && (
        <section className="rounded-lg border border-white/10 bg-black/20 p-5 space-y-4">
          <h2 className="text-lg font-semibold">Bloco 3 — Resultado do preview</h2>
          <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <p>Total analisado: {preview.summary.totalCandidates}</p>
            <p className="text-emerald-300">Elegíveis: {preview.summary.eligibleCount}</p>
            <p className="text-amber-200">Bloqueados: {preview.summary.blockedCount}</p>
            <p className={previewExpired ? "text-red-300" : "text-muted-foreground"}>
              Preview expira em {previewExpired ? "0 (expirado)" : `${minutesLeft} min`}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onPreview}
            className="rounded border border-gold/40 px-3 py-1.5 text-sm text-gold"
          >
            Revalidar elegibilidade
          </button>

          <div className="space-y-4">
            <h3 className="font-medium text-emerald-300">Clientes elegíveis</h3>
            <div className="overflow-x-auto rounded border border-white/10">
              <table className="w-full min-w-[1400px] text-left text-xs">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-2 py-2">Sel.</th>
                    <th className="px-2 py-2">Cliente</th>
                    <th className="px-2 py-2">E-mail</th>
                    <th className="px-2 py-2">LicenseId</th>
                    <th className="px-2 py-2">Conta</th>
                    <th className="px-2 py-2">Servidor</th>
                    <th className="px-2 py-2">Símbolo</th>
                    <th className="px-2 py-2">Magic</th>
                    <th className="px-2 py-2">Contratos</th>
                    <th className="px-2 py-2">Max</th>
                    <th className="px-2 py-2">Margem</th>
                    <th className="px-2 py-2">EA</th>
                    <th className="px-2 py-2">Device</th>
                    <th className="px-2 py-2">Heartbeat</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Links</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.eligible.map((row) => (
                    <tr key={row.licenseId} className="border-t border-white/5">
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(row.licenseId)}
                          onChange={() => toggleLicense(row.licenseId)}
                        />
                      </td>
                      <td className="px-2 py-2">{row.clientName}</td>
                      <td className="px-2 py-2">{row.email}</td>
                      <td className="px-2 py-2 font-mono">{row.licenseId}</td>
                      <td className="px-2 py-2 font-mono">{row.accountLogin}</td>
                      <td className="px-2 py-2 font-mono">{row.accountServer}</td>
                      <td className="px-2 py-2">{row.symbol}</td>
                      <td className="px-2 py-2">{row.magicNumber}</td>
                      <td className="px-2 py-2">{row.requestedContracts}</td>
                      <td className="px-2 py-2">{row.maxContracts}</td>
                      <td className="px-2 py-2">{row.freeMargin ?? "—"}</td>
                      <td className="px-2 py-2">{row.eaOnline ? "ONLINE" : "OFF"}</td>
                      <td className="px-2 py-2">
                        {row.deviceActiveReal ? "ACTIVE+REAL" : "—"}
                      </td>
                      <td className="px-2 py-2 font-mono">
                        {row.heartbeatAt
                          ? new Date(row.heartbeatAt).toLocaleTimeString("pt-BR")
                          : "—"}
                      </td>
                      <td className="px-2 py-2 text-emerald-300">{row.status}</td>
                      <td className="px-2 py-2 space-x-1">
                        <Link href={row.links.license} className="text-gold hover:underline">
                          Lic.
                        </Link>
                        <Link href={row.links.approval} className="text-gold hover:underline">
                          Appr.
                        </Link>
                        <Link href={row.links.snapshots} className="text-gold hover:underline">
                          Snap.
                        </Link>
                        <Link href={row.links.instructions} className="text-gold hover:underline">
                          Instr.
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="font-medium text-amber-200">
              Clientes bloqueados / regularizar antes do envio
            </h3>
            <div className="overflow-x-auto rounded border border-white/10">
              <table className="w-full min-w-[1100px] text-left text-xs">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-2 py-2">Cliente</th>
                    <th className="px-2 py-2">Reason</th>
                    <th className="px-2 py-2">Motivo</th>
                    <th className="px-2 py-2">Ação</th>
                    <th className="px-2 py-2">Regularização</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.blocked.map((row) => (
                    <tr key={row.licenseId} className="border-t border-white/5">
                      <td className="px-2 py-2">
                        {row.clientName}
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {row.licenseId}
                        </div>
                      </td>
                      <td className="px-2 py-2 font-mono">{row.reasonCode}</td>
                      <td className="px-2 py-2">{row.reasonDetail}</td>
                      <td className="px-2 py-2">{row.actionHint}</td>
                      <td className="px-2 py-2 space-x-2">
                        {row.links.user && (
                          <Link href={row.links.user} className="text-gold hover:underline">
                            Usuário
                          </Link>
                        )}
                        {row.links.license && (
                          <Link href={row.links.license} className="text-gold hover:underline">
                            Licença
                          </Link>
                        )}
                        <Link href={row.links.approvals ?? "#"} className="text-gold hover:underline">
                          Approval
                        </Link>
                        <Link href={row.links.snapshots ?? "#"} className="text-gold hover:underline">
                          Snapshots
                        </Link>
                        <Link href={row.links.protection ?? "#"} className="text-gold hover:underline">
                          Proteção
                        </Link>
                        {row.links.instruction && (
                          <Link href={row.links.instruction} className="text-gold hover:underline">
                            Instruction
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {preview && (
        <section className="rounded-lg border border-red-500/30 bg-red-950/20 p-5 space-y-4">
          <h2 className="text-lg font-semibold text-red-200">
            Bloco 4 — Disparo controlado (mercado ao vivo)
          </h2>
          <p className="text-sm">
            Você está prestes a criar instructions REAL_MANUAL individuais para{" "}
            <strong>{selectedCount}</strong> clientes elegíveis selecionados. Clientes bloqueados
            não receberão ordem.
          </p>

          <div className="space-y-2 rounded border border-white/10 bg-black/20 p-4">
            <h3 className="text-sm font-medium">Checklist final de envio real</h3>
            {LIVE_MARKET_EXECUTE_CHECKLIST_ITEMS.map((item) => (
              <label key={item.key} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checklist[item.key]}
                  onChange={(e) =>
                    setChecklist((prev) => ({ ...prev, [item.key]: e.target.checked }))
                  }
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>

          <label className="block text-sm">
            <span className="text-muted-foreground">Confirmação 1</span>
            <input
              className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono text-xs"
              placeholder={BULK_DISPATCH_CONFIRM_PHRASE}
              value={confirm1}
              onChange={(e) => setConfirm1(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Confirmação 2</span>
            <input
              className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono text-xs"
              placeholder={expectedConfirm2}
              value={confirm2}
              onChange={(e) => setConfirm2(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Confirmação 3</span>
            <input
              className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono text-xs"
              placeholder={BULK_DISPATCH_LIVE_AWARENESS_PHRASE}
              value={confirm3}
              onChange={(e) => setConfirm3(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={!executeEnabled}
            onClick={onExecute}
            className="rounded bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Criar instructions REAL_MANUAL selecionadas
          </button>
          {previewExpired && (
            <p className="text-sm text-red-300">
              Preview expirado — revalide antes de disparar.
            </p>
          )}
        </section>
      )}

      {message && (
        <p className="rounded border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          {message}
        </p>
      )}

      {executeResult && (
        <section className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-5 space-y-3">
          <h3 className="font-semibold text-emerald-200">Resultado do batch</h3>
          <p className="text-sm">{executeResult.message}</p>
          <p className="text-sm">
            Batch{" "}
            <Link
              href={`/admin/real-trading/bulk-dispatch/${executeResult.batchId}`}
              className="font-mono text-gold hover:underline"
            >
              {executeResult.batchId}
            </Link>{" "}
            — {executeResult.status}
          </p>
          <p className="text-sm">
            Selecionados: {executeResult.summary.selected} · Disparados:{" "}
            {executeResult.summary.dispatched} · Ignorados: {executeResult.summary.skipped}
            {executeResult.summary.blockedAtExecute != null
              ? ` · BlockedAtExecute: ${executeResult.summary.blockedAtExecute}`
              : ""}{" "}
            · Falhas: {executeResult.summary.failed}
          </p>
          {executeResult.links && (
            <p className="text-sm space-x-3">
              <Link href={executeResult.links.instructions} className="text-gold hover:underline">
                Instructions do batch
              </Link>
              <Link href={executeResult.links.protection} className="text-gold hover:underline">
                Proteção
              </Link>
            </p>
          )}
          <ul className="space-y-1 text-xs font-mono">
            {executeResult.items.map((item) => (
              <li key={item.licenseId}>
                {item.licenseId} → {item.status}
                {item.instructionId ? (
                  <>
                    {" "}
                    (
                    <Link
                      href={`/admin/real-trading/instructions/${item.instructionId}`}
                      className="text-gold hover:underline"
                    >
                      {item.instructionId}
                    </Link>
                    )
                  </>
                ) : null}
                {item.reasonCode ? ` [${item.reasonCode}]` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
