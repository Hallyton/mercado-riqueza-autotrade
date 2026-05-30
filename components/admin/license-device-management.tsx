"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ADMIN_ACTIVATION_CODE_CONFIRM_PHRASE,
  DEVICE_BLOCK_CONFIRM_PHRASE,
  DEVICE_REVOKE_CONFIRM_PHRASE,
} from "@/lib/admin/license-devices";

export type LicenseDeviceRow = {
  id: string;
  deviceId: string;
  status: string;
  eaVersion: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  revokedAt: string | null;
  blockedAt: string | null;
  lastHeartbeatAt: string | null;
  tradeMode: string | null;
  accountLogin: string | null;
  accountServer: string | null;
};

function formatDt(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function LicenseDeviceManagement({
  licenseId,
  devices,
  maxDevices,
  activeDeviceCount,
}: {
  licenseId: string;
  devices: LicenseDeviceRow[];
  maxDevices: number;
  activeDeviceCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activationCode, setActivationCode] = useState<string | null>(null);
  const [confirmations, setConfirmations] = useState<Record<string, string>>({});
  const [activationConfirm, setActivationConfirm] = useState("");

  async function postAction(
    path: string,
    confirmation: string,
    key: string
  ) {
    setBusy(key);
    setMessage(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_confirmation: confirmation }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Falha na operação.");
        return;
      }
      router.refresh();
    } catch {
      setMessage("Erro de rede.");
    } finally {
      setBusy(null);
    }
  }

  async function generateActivationCode() {
    setBusy("activation");
    setMessage(null);
    setActivationCode(null);
    try {
      const res = await fetch(
        `/api/admin/licenses/${licenseId}/activation-code`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ admin_confirmation: activationConfirm }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Falha ao gerar código.");
        return;
      }
      setActivationCode(data.code);
      setActivationConfirm("");
      router.refresh();
    } catch {
      setMessage("Erro de rede.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-white/10 p-4 text-sm">
        <p>
          Devices ativos: <strong>{activeDeviceCount}</strong> / {maxDevices}
        </p>
        <p className="mt-1 text-muted-foreground">
          Revogue o device DEMO antigo antes de ativar o EA na conta real. Tokens
          nunca são exibidos nesta tela.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5">
            <tr>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">DeviceId</th>
              <th className="px-3 py-2">Conta</th>
              <th className="px-3 py-2">tradeMode</th>
              <th className="px-3 py-2">Último HB</th>
              <th className="px-3 py-2">Criado</th>
              <th className="px-3 py-2">Revogado</th>
              <th className="px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id} className="border-b border-white/5 align-top">
                <td className="px-3 py-2 font-mono text-xs">{d.status}</td>
                <td className="px-3 py-2 font-mono text-xs">{d.deviceId}</td>
                <td className="px-3 py-2 text-xs">
                  {d.accountLogin && d.accountServer
                    ? `${d.accountLogin} @ ${d.accountServer}`
                    : "—"}
                </td>
                <td className="px-3 py-2">{d.tradeMode ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{formatDt(d.lastHeartbeatAt)}</td>
                <td className="px-3 py-2 text-xs">{formatDt(d.createdAt)}</td>
                <td className="px-3 py-2 text-xs">{formatDt(d.revokedAt)}</td>
                <td className="px-3 py-2 min-w-[200px]">
                  {d.status === "ACTIVE" ? (
                    <div className="space-y-2">
                      <input
                        className="w-full rounded border border-white/10 bg-background px-2 py-1 text-xs"
                        placeholder={DEVICE_REVOKE_CONFIRM_PHRASE}
                        value={confirmations[`revoke-${d.id}`] ?? ""}
                        onChange={(e) =>
                          setConfirmations((prev) => ({
                            ...prev,
                            [`revoke-${d.id}`]: e.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        disabled={busy !== null}
                        className="text-xs text-amber-400 hover:underline disabled:opacity-50"
                        onClick={() =>
                          postAction(
                            `/api/admin/licenses/${licenseId}/devices/${d.id}/revoke`,
                            confirmations[`revoke-${d.id}`] ?? "",
                            `revoke-${d.id}`
                          )
                        }
                      >
                        Revogar device
                      </button>
                      <input
                        className="mt-2 w-full rounded border border-white/10 bg-background px-2 py-1 text-xs"
                        placeholder={DEVICE_BLOCK_CONFIRM_PHRASE}
                        value={confirmations[`block-${d.id}`] ?? ""}
                        onChange={(e) =>
                          setConfirmations((prev) => ({
                            ...prev,
                            [`block-${d.id}`]: e.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        disabled={busy !== null}
                        className="text-xs text-red-300 hover:underline disabled:opacity-50"
                        onClick={() =>
                          postAction(
                            `/api/admin/licenses/${licenseId}/devices/${d.id}/block`,
                            confirmations[`block-${d.id}`] ?? "",
                            `block-${d.id}`
                          )
                        }
                      >
                        Bloquear device
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
            {devices.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-muted-foreground">
                  Nenhum device registrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-gold/30 bg-gold/5 p-4 space-y-3">
        <p className="text-sm font-medium">Gerar novo código de ativação</p>
        <p className="text-xs text-muted-foreground">
          Digite <span className="font-mono text-gold">{ADMIN_ACTIVATION_CODE_CONFIRM_PHRASE}</span>.
          O código é exibido uma única vez abaixo.
        </p>
        <input
          className="w-full max-w-md rounded border border-white/10 bg-background px-3 py-2 text-sm font-mono"
          value={activationConfirm}
          onChange={(e) => setActivationConfirm(e.target.value)}
          autoComplete="off"
        />
        <button
          type="button"
          disabled={busy !== null}
          onClick={generateActivationCode}
          className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          {busy === "activation" ? "Gerando…" : "Gerar código"}
        </button>
        {activationCode && (
          <div className="rounded border border-gold/40 bg-black/40 p-3">
            <p className="text-xs text-muted-foreground mb-1">
              Código (copie agora — não será exibido novamente):
            </p>
            <p className="font-mono text-lg text-gold tracking-widest">{activationCode}</p>
          </div>
        )}
      </div>

      {message && <p className="text-sm text-amber-400">{message}</p>}
    </div>
  );
}
