"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LICENSE_EXPECTED_MODE_CONFIRM_PHRASE } from "@/lib/admin/license-expected-mode";
import {
  DEVICE_COMPATIBILITY_LABELS,
  OPERATIONAL_STATUS_LABELS,
  type OperationalCompatibilityStatus,
} from "@/lib/licensing/license-expected-mode";

function formatDt(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function LicenseOperationalModeCard({
  licenseId,
  expectedTradeMode,
  expectedAccountLogin,
  expectedAccountServer,
  expectedSymbol,
  expectedMagicNumber,
  mt5Login,
  mt5Server,
  operationalStatus,
  latestHeartbeatTradeMode,
  latestHeartbeatDeviceId,
  latestHeartbeatAt,
}: {
  licenseId: string;
  expectedTradeMode: string;
  expectedAccountLogin: string | null;
  expectedAccountServer: string | null;
  expectedSymbol: string | null;
  expectedMagicNumber: number | null;
  mt5Login: string | null;
  mt5Server: string | null;
  operationalStatus: OperationalCompatibilityStatus;
  latestHeartbeatTradeMode: string | null;
  latestHeartbeatDeviceId: string | null;
  latestHeartbeatAt: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [mode, setMode] = useState(expectedTradeMode);
  const [login, setLogin] = useState(
    expectedAccountLogin ?? mt5Login ?? ""
  );
  const [server, setServer] = useState(
    expectedAccountServer ?? mt5Server ?? ""
  );
  const [symbol, setSymbol] = useState(expectedSymbol ?? "");
  const [magic, setMagic] = useState(
    expectedMagicNumber != null ? String(expectedMagicNumber) : ""
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusClass =
    operationalStatus === "OK"
      ? "text-emerald-400"
      : operationalStatus === "AWAITING_NEW_DEVICE" ||
          operationalStatus === "NO_HEARTBEAT"
        ? "text-amber-400"
        : "text-red-300";

  async function onSave() {
    if (confirm.trim() !== LICENSE_EXPECTED_MODE_CONFIRM_PHRASE) {
      setError(`Digite exatamente: ${LICENSE_EXPECTED_MODE_CONFIRM_PHRASE}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/licenses/${licenseId}/expected-mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_confirmation: confirm.trim(),
          expected_trade_mode: mode,
          expected_account_login: login.trim() || undefined,
          expected_account_server: server.trim() || undefined,
          expected_symbol: symbol.trim() || undefined,
          expected_magic_number: magic.trim() ? Number(magic) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Falha ao salvar.");
        return;
      }
      setOpen(false);
      setConfirm("");
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/10 p-5 space-y-4">
      <div>
        <h3 className="text-base font-semibold">Modo operacional esperado</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Define como a <strong>próxima</strong> ativação do EA deve se comportar.
          O tradeMode do device revogado abaixo é apenas histórico (read-only).
        </p>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Conta esperada</dt>
          <dd className="font-mono">
            {expectedAccountLogin ?? mt5Login ?? "—"}
            {expectedAccountServer || mt5Server
              ? ` @ ${expectedAccountServer ?? mt5Server}`
              : ""}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Modo esperado</dt>
          <dd className="font-mono text-gold">{expectedTradeMode}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Último heartbeat</dt>
          <dd className="text-xs">
            {latestHeartbeatAt
              ? formatDt(latestHeartbeatAt)
              : "Nenhum recebido"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Último tradeMode reportado</dt>
          <dd className="font-mono text-xs">
            {latestHeartbeatTradeMode ?? "—"}
            {latestHeartbeatDeviceId && (
              <span className="text-muted-foreground">
                {" "}
                · device {latestHeartbeatDeviceId}
              </span>
            )}
          </dd>
          <p className="text-xs text-muted-foreground mt-1">
            Read-only — vem do último heartbeat, não é editável.
          </p>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Compatibilidade operacional</dt>
          <dd className={`text-sm font-medium ${statusClass}`}>
            {OPERATIONAL_STATUS_LABELS[operationalStatus]}
          </dd>
        </div>
      </dl>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border border-gold/40 px-4 py-2 text-sm text-gold hover:bg-gold/10"
        >
          Configurar modo esperado
        </button>
      ) : (
        <div className="rounded border border-gold/30 bg-gold/5 p-4 space-y-3">
          <label className="block text-sm">
            <span className="text-muted-foreground">Modo esperado</span>
            <select
              className="mt-1 w-full max-w-xs rounded border border-white/10 bg-background px-3 py-2"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="DEMO">DEMO</option>
              <option value="REAL">REAL</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Login esperado</span>
            <input
              className="mt-1 w-full max-w-md rounded border border-white/10 bg-background px-3 py-2 font-mono text-sm"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Servidor esperado</span>
            <input
              className="mt-1 w-full max-w-md rounded border border-white/10 bg-background px-3 py-2 font-mono text-sm"
              value={server}
              onChange={(e) => setServer(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Símbolo (opcional)</span>
            <input
              className="mt-1 w-full max-w-xs rounded border border-white/10 bg-background px-3 py-2 font-mono text-sm"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Magic (opcional)</span>
            <input
              className="mt-1 w-full max-w-xs rounded border border-white/10 bg-background px-3 py-2 font-mono text-sm"
              value={magic}
              onChange={(e) => setMagic(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground font-mono text-xs">
              {LICENSE_EXPECTED_MODE_CONFIRM_PHRASE}
            </span>
            <input
              className="mt-1 w-full max-w-lg rounded border border-white/10 bg-background px-3 py-2 font-mono text-sm"
              placeholder={LICENSE_EXPECTED_MODE_CONFIRM_PHRASE}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={onSave}
              className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm text-muted-foreground hover:underline"
            >
              Cancelar
            </button>
          </div>
          {error && <p className="text-sm text-red-300">{error}</p>}
        </div>
      )}
    </div>
  );
}

export function DeviceCompatibilityBadge({
  label,
}: {
  label: keyof typeof DEVICE_COMPATIBILITY_LABELS;
}) {
  const text = DEVICE_COMPATIBILITY_LABELS[label];
  const cls =
    label.startsWith("OK")
      ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
      : label.startsWith("HISTORICAL")
        ? "border-white/20 text-muted-foreground bg-white/5"
        : label.startsWith("MISMATCH")
          ? "border-red-500/40 text-red-300 bg-red-500/10"
          : "border-amber-500/40 text-amber-400 bg-amber-500/10";

  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs border ${cls}`}>
      {text}
    </span>
  );
}
