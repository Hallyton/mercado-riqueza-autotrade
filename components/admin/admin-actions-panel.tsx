"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type LicenseOption = {
  id: string;
  userId: string;
  clientEmail: string;
  haltNewEntries: boolean;
};

export function AdminActionsPanel({
  licenses,
  canEmergency,
  adminRole,
}: {
  licenses: LicenseOption[];
  canEmergency: boolean;
  adminRole: string;
}) {
  const router = useRouter();
  const [licenseId, setLicenseId] = useState(licenses[0]?.id ?? "");
  const [userId, setUserId] = useState(licenses[0]?.userId ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selected = licenses.find((l) => l.id === licenseId);

  async function post(url: string, body: object) {
    setBusy(url);
    setMessage(null);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setMessage(data.error ?? "Falha na operação");
      return;
    }
    setMessage("Ação registrada com sucesso.");
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-gold/20 bg-card/90 p-6 shadow-lg shadow-black/40">
      <h2 className="text-lg font-semibold text-gold">Controles operacionais</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Papel: {adminRole}. Todas as ações são gravadas em admin_actions e audit_logs.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-muted-foreground">Licença alvo</span>
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-background px-3 py-2 text-sm"
            value={licenseId}
            onChange={(e) => {
              setLicenseId(e.target.value);
              const lic = licenses.find((l) => l.id === e.target.value);
              if (lic) setUserId(lic.userId);
            }}
          >
            {licenses.map((l) => (
              <option key={l.id} value={l.id}>
                {l.clientEmail} · {l.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!licenseId || busy !== null}
          onClick={() =>
            post(`/api/admin/licenses/${licenseId}/pause-entries`, {
              pause: true,
              reason: "admin_panel_pause",
            })
          }
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
        >
          Pausar novas entradas
        </button>

        <button
          type="button"
          disabled={!licenseId || busy !== null}
          onClick={() =>
            post(`/api/admin/licenses/${licenseId}/pause-entries`, {
              pause: false,
              reason: "admin_panel_resume",
            })
          }
          className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium transition hover:bg-white/5 disabled:opacity-50"
        >
          Retomar entradas
        </button>

        <button
          type="button"
          disabled={!userId || busy !== null}
          onClick={() => {
            if (
              !window.confirm(
                "Bloquear cliente suspende licenças e marca assinatura em atraso. Continuar?"
              )
            ) {
              return;
            }
            post(`/api/admin/users/${userId}/block`, {
              reason: "admin_panel_block",
            });
          }}
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
        >
          Bloquear cliente
        </button>

        {canEmergency ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              if (
                !window.confirm(
                  "Emergência: cancelar ordens RECEIVED/SENT na fila do servidor. Continuar?"
                )
              ) {
                return;
              }
              post("/api/admin/emergency/cancel-orders", {
                licenseId: licenseId || undefined,
                reason: "admin_emergency",
              });
            }}
            className="rounded-lg border border-red-600 bg-red-600/20 px-4 py-2 text-sm font-bold text-red-100 transition hover:bg-red-600/30 disabled:opacity-50"
          >
            Emergência — cancelar ordens
          </button>
        ) : (
          <p className="self-center text-xs text-muted-foreground">
            Emergência disponível apenas para SUPERADMIN e OPS.
          </p>
        )}
      </div>

      {selected && (
        <p className="mt-3 text-xs text-muted-foreground">
          Estado atual:{" "}
          {selected.haltNewEntries
            ? "novas entradas pausadas"
            : "entradas permitidas (se assinatura ativa)"}
        </p>
      )}

      {message && (
        <p className="mt-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
