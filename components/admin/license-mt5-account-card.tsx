"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Mt5AccountOwnershipConflictCard } from "@/components/admin/mt5-account-ownership-conflict-card";
import {
  MT5_ACCOUNT_DEMO_CONFIRM_PHRASE,
  MT5_ACCOUNT_REAL_CONFIRM_PHRASE,
} from "@/lib/admin/license-mt5-account";

function formatDt(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

function mapBindError(code?: string, fallback?: string): string {
  switch (code) {
    case "CONFIRMATION_MISMATCH":
      return "Frase de confirmação incorreta para o ambiente selecionado.";
    case "INVALID_MT5_LOGIN":
      return "Login MT5 deve conter apenas números.";
    case "MAGIC_NUMBER_OUT_OF_RANGE":
      return "MagicNumber fora da faixa 910001–910999.";
    case "MAGIC_NUMBER_COLLISION":
      return "MagicNumber já está em uso por outra licença ou robô.";
    case "MT5_ALREADY_REGISTERED":
    case "MT5_ACCOUNT_HELD_BY_CANCELLED_LICENSE":
    case "MT5_ACCOUNT_HELD_BY_DELETED_USER":
    case "MT5_ACCOUNT_OWNED_BY_ACTIVE_USER":
    case "MT5_ACCOUNT_OWNED_BY_ACTIVE_LICENSE":
      return "Esta conta MT5 pertence a outro usuário.";
    case "MT5_ALREADY_LICENSED":
      return "Esta conta MT5 já está em outra licença ativa.";
    case "LICENSE_REVOKED":
      return "Licença revogada.";
    default:
      return fallback ?? "Não foi possível salvar. Tente novamente.";
  }
}

export function LicenseMt5AccountCard({
  licenseId,
  linked,
  login,
  server,
  expectedSymbol,
  expectedMagicNumber,
  expectedTradeMode,
  lastChangedAt,
  lastChangedBy,
}: {
  licenseId: string;
  linked: boolean;
  login: string | null;
  server: string | null;
  expectedSymbol: string | null;
  expectedMagicNumber: number | null;
  expectedTradeMode: string;
  lastChangedAt: string | null;
  lastChangedBy: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [accountLogin, setAccountLogin] = useState(login ?? "");
  const [accountServer, setAccountServer] = useState(server ?? "");
  const [symbol, setSymbol] = useState(expectedSymbol ?? "");
  const [magic, setMagic] = useState(
    expectedMagicNumber != null ? String(expectedMagicNumber) : ""
  );
  const [mode, setMode] = useState(expectedTradeMode);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownershipConflict, setOwnershipConflict] = useState<Record<
    string,
    unknown
  > | null>(null);

  const confirmPhrase =
    mode === "REAL" ? MT5_ACCOUNT_REAL_CONFIRM_PHRASE : MT5_ACCOUNT_DEMO_CONFIRM_PHRASE;

  async function onSave() {
    if (confirm.trim() !== confirmPhrase) {
      setError(`Digite exatamente: ${confirmPhrase}`);
      return;
    }
    setBusy(true);
    setError(null);
    setOwnershipConflict(null);
    try {
      const res = await fetch(`/api/admin/licenses/${licenseId}/mt5-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_confirmation: confirm.trim(),
          account_login: accountLogin.trim(),
          account_server: accountServer.trim(),
          expected_trade_mode: mode,
          ...(symbol.trim() ? { expected_symbol: symbol.trim() } : {}),
          ...(magic.trim()
            ? { expected_magic_number: Number.parseInt(magic.trim(), 10) }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.detail && typeof data.detail === "object") {
          setOwnershipConflict({
            ...(data.detail as Record<string, unknown>),
            actionHint: data.actionHint,
            traceLink: data.traceLink,
            reasonCode: data.code,
          });
        }
        setError(mapBindError(data.code, data.error));
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
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">
          Conta MT5 vinculada
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Vínculo oficial da conta para geração do código de ativação. O Device/VPS
          nasce automaticamente quando o EA ativar no MT5.
        </p>
      </div>

      {!linked ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Vincule a conta MT5 antes de gerar o código de ativação. O Device/VPS será
          criado automaticamente pelo EA após a ativação.
        </p>
      ) : (
        <p className="rounded border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Conta vinculada. Agora você pode gerar o código de ativação para o EA.
        </p>
      )}

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Status de vínculo</dt>
          <dd className={linked ? "text-emerald-400" : "text-amber-400"}>
            {linked ? "Vinculada" : "Não vinculada"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Conta MT5</dt>
          <dd className="font-mono">{login ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Servidor MT5</dt>
          <dd className="font-mono">{server ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Símbolo padrão</dt>
          <dd className="font-mono">{expectedSymbol ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">MagicNumber esperado</dt>
          <dd className="font-mono">
            {expectedMagicNumber != null ? expectedMagicNumber : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Ambiente esperado</dt>
          <dd className="font-mono text-gold">{expectedTradeMode}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Última alteração</dt>
          <dd>{formatDt(lastChangedAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Alterado por</dt>
          <dd>{lastChangedBy ?? "—"}</dd>
        </div>
      </dl>

      <button
        type="button"
        className="rounded-md border border-gold/40 px-4 py-2 text-sm text-gold hover:bg-gold/10"
        onClick={() => {
          setOpen((v) => !v);
          setAccountLogin(login ?? "");
          setAccountServer(server ?? "");
          setSymbol(expectedSymbol ?? "");
          setMagic(
            expectedMagicNumber != null ? String(expectedMagicNumber) : ""
          );
          setMode(expectedTradeMode);
          setConfirm("");
          setError(null);
          setOwnershipConflict(null);
        }}
      >
        {open ? "Fechar formulário" : "Vincular / editar conta MT5"}
      </button>

      {open && (
        <div className="rounded-lg border border-white/10 bg-black/30 p-4 space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-muted-foreground">Conta MT5 (login)</span>
              <input
                className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono"
                value={accountLogin}
                onChange={(e) => setAccountLogin(e.target.value)}
                inputMode="numeric"
              />
            </label>
            <label className="block">
              <span className="text-muted-foreground">Servidor MT5</span>
              <input
                className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono"
                value={accountServer}
                onChange={(e) => setAccountServer(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-muted-foreground">Símbolo padrão</span>
              <input
                className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="WDOM26"
              />
            </label>
            <label className="block">
              <span className="text-muted-foreground">
                MagicNumber (910001–910999)
              </span>
              <input
                className="mt-1 w-full rounded border border-white/10 bg-background px-3 py-2 font-mono"
                value={magic}
                onChange={(e) => setMagic(e.target.value)}
                placeholder="Automático se vazio"
              />
            </label>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-muted-foreground">Ambiente esperado</legend>
            <label className="inline-flex items-center gap-2 mr-4">
              <input
                type="radio"
                name="mt5-mode"
                checked={mode === "DEMO"}
                onChange={() => setMode("DEMO")}
              />
              DEMO
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="mt5-mode"
                checked={mode === "REAL"}
                onChange={() => setMode("REAL")}
              />
              REAL
            </label>
          </fieldset>

          <label className="block">
            <span className="text-muted-foreground">
              Confirmação ({mode === "REAL" ? "conta real" : "conta demo"}):{" "}
              <span className="font-mono text-gold">{confirmPhrase}</span>
            </span>
            <input
              className="mt-2 w-full max-w-lg rounded border border-white/10 bg-background px-3 py-2 font-mono"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <button
            type="button"
            disabled={busy}
            onClick={onSave}
            className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
          >
            {busy ? "Salvando…" : "Salvar vínculo MT5"}
          </button>

          {error && <p className="text-sm text-red-300">{error}</p>}

          {ownershipConflict && (
            <Mt5AccountOwnershipConflictCard
              licenseId={licenseId}
              detail={ownershipConflict as never}
              accountLogin={accountLogin.trim()}
              accountServer={accountServer.trim()}
              symbol={symbol.trim()}
              magicNumber={
                magic.trim() ? Number.parseInt(magic.trim(), 10) : null
              }
              environment={mode}
            />
          )}
        </div>
      )}
    </div>
  );
}
