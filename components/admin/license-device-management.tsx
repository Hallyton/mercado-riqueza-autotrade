"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  DEVICE_BLOCK_CONFIRM_PHRASE,
  DEVICE_REVOKE_CONFIRM_PHRASE,
} from "@/lib/admin/license-devices";
import type { DeviceCompatibilityLabel } from "@/lib/licensing/license-expected-mode";
import { DeviceCompatibilityBadge } from "@/components/admin/license-operational-mode";

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
  reportedTradeMode: string | null;
  accountLogin: string | null;
  accountServer: string | null;
  compatibility: DeviceCompatibilityLabel;
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
  expectedTradeMode,
}: {
  licenseId: string;
  devices: LicenseDeviceRow[];
  maxDevices: number;
  activeDeviceCount: number;
  expectedTradeMode: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmations, setConfirmations] = useState<Record<string, string>>({});

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

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-white/10 p-4 text-sm">
        <p>
          Devices ativos: <strong>{activeDeviceCount}</strong> / {maxDevices}
        </p>
        <p className="mt-1 text-muted-foreground">
          Modo esperado da licença: <span className="font-mono text-gold">{expectedTradeMode}</span>.
          Revogue o device DEMO antigo antes de ativar o EA na conta real com{" "}
          <span className="font-mono">InpTradeMode=REAL</span>.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5">
            <tr>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">DeviceId</th>
              <th className="px-3 py-2">Conta</th>
              <th className="px-3 py-2">tradeMode reportado</th>
              <th className="px-3 py-2">Compatibilidade</th>
              <th className="px-3 py-2">Último HB</th>
              <th className="px-3 py-2">Criado</th>
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
                <td className="px-3 py-2">
                  <span className="font-mono text-xs">
                    {d.reportedTradeMode ?? "—"}
                  </span>
                  {(d.status === "REVOKED" || d.status === "BLOCKED") && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Histórico — não editável
                    </p>
                  )}
                </td>
                <td className="px-3 py-2">
                  <DeviceCompatibilityBadge label={d.compatibility} />
                </td>
                <td className="px-3 py-2 text-xs">{formatDt(d.lastHeartbeatAt)}</td>
                <td className="px-3 py-2 text-xs">{formatDt(d.createdAt)}</td>
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
                    <span className="text-xs text-muted-foreground">
                      Device revogado/bloqueado — sem ações
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {devices.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-muted-foreground">
                  <p>Nenhum device registrado.</p>
                  <p className="mt-2 text-xs leading-relaxed max-w-xl">
                    Após gerar o código de ativação e anexar o EA Executor no MT5,
                    o primeiro heartbeat criará o Device/VPS automaticamente. Não é
                    necessário criar device manualmente no painel.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {message && <p className="text-sm text-amber-400">{message}</p>}
    </div>
  );
}
