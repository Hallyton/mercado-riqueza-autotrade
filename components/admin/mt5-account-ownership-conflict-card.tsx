"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  MT5_OWNERSHIP_RELEASE_CONFIRM_PHRASE,
  MT5_OWNERSHIP_TRANSFER_CONFIRM_PHRASE,
} from "@/lib/admin/mt5-account-ownership";

type OwnershipDetail = {
  accountLogin: string;
  accountServer: string;
  ownerSummary?: {
    userId?: string;
    email?: string;
    userStatus?: string;
    licenseId?: string | null;
    licenseStatus?: string | null;
    subscriptionStatus?: string | null;
    deviceId?: string | null;
    deviceStatus?: string | null;
    lastHeartbeatAt?: string | null;
    lastActivityAt?: string | null;
  } | null;
  risk?: {
    hasRecentEaActivity: boolean;
    hasOpenPositionSnapshot: boolean;
    hasPendingOrdersSnapshot: boolean;
    hasPendingOperationalCommand: boolean;
    hasActiveRealApproval: boolean;
  };
  reasonCode?: string;
  canRelease?: boolean;
  canTransfer?: boolean;
  recommendedAction?: string | null;
  blockReasons?: string[];
  actionHint?: string;
  traceLink?: string;
};

type TraceResponse = OwnershipDetail & {
  currentOwner?: OwnershipDetail["ownerSummary"];
  message?: string;
};

function formatDt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function Mt5AccountOwnershipConflictCard({
  licenseId,
  detail,
  accountLogin,
  accountServer,
  symbol,
  magicNumber,
  environment,
}: {
  licenseId: string;
  detail: OwnershipDetail;
  accountLogin: string;
  accountServer: string;
  symbol: string;
  magicNumber: number | null;
  environment: string;
}) {
  const router = useRouter();
  const [trace, setTrace] = useState<TraceResponse | null>(detail);
  const [loadingTrace, setLoadingTrace] = useState(false);
  const [modal, setModal] = useState<"release" | "transfer" | null>(null);
  const [confirm, setConfirm] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const owner = trace?.currentOwner ?? trace?.ownerSummary ?? detail.ownerSummary;

  async function loadTrace() {
    setLoadingTrace(true);
    setError(null);
    try {
      const params = new URLSearchParams({ accountLogin, accountServer });
      const res = await fetch(
        `/api/admin/mt5-accounts/ownership/trace?${params.toString()}`
      );
      const data = (await res.json()) as TraceResponse & { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Falha ao diagnosticar vínculo.");
        return;
      }
      setTrace(data);
    } catch {
      setError("Erro de rede ao diagnosticar.");
    } finally {
      setLoadingTrace(false);
    }
  }

  async function submitAction() {
    if (!modal) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const endpoint =
        modal === "release"
          ? "/api/admin/mt5-accounts/ownership/release"
          : "/api/admin/mt5-accounts/ownership/transfer";

      const body =
        modal === "release"
          ? {
              accountLogin,
              accountServer,
              adminConfirmation: confirm.trim(),
              adminNote: adminNote.trim(),
            }
          : {
              fromLicenseId: owner?.licenseId,
              toLicenseId: licenseId,
              accountLogin,
              accountServer,
              symbol: symbol.trim() || "WDON26",
              magicNumber: magicNumber ?? 910003,
              environment,
              adminConfirmation: confirm.trim(),
              adminNote: adminNote.trim(),
            };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        code?: string;
        detail?: { blockReasons?: string[] };
      };

      if (!res.ok || !data.ok) {
        const extra =
          data.detail?.blockReasons?.length
            ? ` ${data.detail.blockReasons.join(" ")}`
            : "";
        setError((data.message ?? "Ação bloqueada.") + extra);
        return;
      }

      setSuccess(
        modal === "release"
          ? "Conta MT5 liberada. Tente salvar o vínculo novamente."
          : "Conta MT5 transferida para esta licença."
      );
      setModal(null);
      setConfirm("");
      setAdminNote("");
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setBusy(false);
    }
  }

  const expectedPhrase =
    modal === "release"
      ? MT5_OWNERSHIP_RELEASE_CONFIRM_PHRASE
      : MT5_OWNERSHIP_TRANSFER_CONFIRM_PHRASE;

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-4 text-sm">
      <div>
        <h4 className="font-semibold text-amber-200">Conflito de propriedade MT5</h4>
        <p className="mt-1 text-muted-foreground">
          {detail.actionHint ??
            "A conta informada ainda está registrada para outro usuário/licença."}
        </p>
      </div>

      <dl className="grid gap-2 sm:grid-cols-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Conta informada</dt>
          <dd className="font-mono">{accountLogin}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Servidor informado</dt>
          <dd className="font-mono">{accountServer}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Dono atual</dt>
          <dd>{owner?.email ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Status do usuário</dt>
          <dd>{owner?.userStatus ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Licença atual</dt>
          <dd className="font-mono">{owner?.licenseStatus ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Assinatura</dt>
          <dd>{owner?.subscriptionStatus ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Último heartbeat</dt>
          <dd>{formatDt(owner?.lastHeartbeatAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Última activity</dt>
          <dd>{formatDt(owner?.lastActivityAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Reason code</dt>
          <dd className="font-mono">{trace?.reasonCode ?? detail.reasonCode ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Ação recomendada</dt>
          <dd>{trace?.recommendedAction ?? detail.recommendedAction ?? "—"}</dd>
        </div>
      </dl>

      {(trace?.blockReasons ?? detail.blockReasons)?.length ? (
        <ul className="list-disc pl-5 text-xs text-red-300">
          {(trace?.blockReasons ?? detail.blockReasons)?.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {owner?.licenseId && (
          <Link
            href={`/admin/licenses/${owner.licenseId}`}
            className="text-gold hover:underline text-xs"
          >
            Abrir dono atual
          </Link>
        )}
        {owner?.userId && (
          <Link
            href={`/admin/users/${owner.userId}`}
            className="text-gold hover:underline text-xs"
          >
            Abrir usuário dono
          </Link>
        )}
        <Button
          type="button"
          variant="outline"
          className="h-7 border-gold/30 px-2 text-[11px] text-gold hover:bg-gold/10"
          disabled={loadingTrace}
          onClick={loadTrace}
        >
          {loadingTrace ? "Diagnosticando…" : "Analisar liberação da conta MT5"}
        </Button>
        {(trace?.canRelease ?? detail.canRelease) && (
          <Button
            type="button"
            variant="outline"
            className="h-7 border-gold/30 px-2 text-[11px] text-gold hover:bg-gold/10"
            onClick={() => {
              setModal("release");
              setConfirm("");
              setAdminNote("");
              setError(null);
            }}
          >
            Liberar conta órfã
          </Button>
        )}
        {(trace?.canTransfer ?? detail.canTransfer) && owner?.licenseId && (
          <Button
            type="button"
            variant="outline"
            className="h-7 border-gold/30 px-2 text-[11px] text-gold hover:bg-gold/10"
            onClick={() => {
              setModal("transfer");
              setConfirm("");
              setAdminNote("");
              setError(null);
            }}
          >
            Transferir para esta licença
          </Button>
        )}
      </div>

      {success && <p className="text-emerald-300 text-xs">{success}</p>}
      {error && <p className="text-red-300 text-xs">{error}</p>}

      {modal && (
        <div className="rounded border border-white/10 bg-black/40 p-4 space-y-3">
          <p className="font-medium text-foreground">
            {modal === "release" ? "Liberar conta órfã" : "Transferir para esta licença"}
          </p>
          <p className="text-xs text-muted-foreground">
            Confirme o risco antes de continuar. Nenhuma ordem real será enviada; apenas o
            vínculo administrativo será alterado.
          </p>
          <label className="block text-xs">
            <span className="text-muted-foreground">
              Confirmação:{" "}
              <span className="font-mono text-gold">{expectedPhrase}</span>
            </span>
            <input
              className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          <label className="block text-xs">
            <span className="text-muted-foreground">Nota admin (obrigatória)</span>
            <textarea
              className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2"
              rows={3}
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={busy}
              className="h-8 bg-gold text-black hover:bg-gold/90"
              onClick={submitAction}
            >
              {busy ? "Processando…" : "Confirmar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8"
              onClick={() => setModal(null)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
