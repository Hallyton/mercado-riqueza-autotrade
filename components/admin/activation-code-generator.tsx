"use client";

import { useState } from "react";
import { ADMIN_ACTIVATION_CODE_CONFIRM_PHRASE } from "@/lib/admin/license-devices";

function mapActivationError(code?: string, fallback?: string): string {
  switch (code) {
    case "CONFIRMATION_MISMATCH":
      return `Digite exatamente: ${ADMIN_ACTIVATION_CODE_CONFIRM_PHRASE}`;
    case "LICENSE_REVOKED":
      return "Licença revogada — não é possível gerar código.";
    case "LICENSE_SUSPENDED":
      return "Licença suspensa — não é possível gerar código.";
    case "LICENSE_NOT_ELIGIBLE":
      return "Licença não elegível para código de ativação.";
    case "SUBSCRIPTION_INACTIVE":
      return "Assinatura inativa.";
    case "SUBSCRIPTION_EXPIRED":
      return "Assinatura vencida.";
    case "MT5_NOT_LINKED":
      return "Vincule uma conta MT5 à licença antes de gerar o código.";
    case "LICENSE_NOT_FOUND":
      return "Licença não encontrada.";
    default:
      return fallback ?? "Não foi possível gerar o código. Tente novamente.";
  }
}

export function ActivationCodeGenerator({
  licenseId,
  canGenerate,
  ineligibleReason,
  expectedAccountLogin,
  expectedAccountServer,
  expectedTradeMode,
  expectedSymbol,
  expectedMagicNumber,
  mt5Linked,
}: {
  licenseId: string;
  canGenerate: boolean;
  ineligibleReason?: string | null;
  expectedAccountLogin?: string | null;
  expectedAccountServer?: string | null;
  expectedTradeMode?: string;
  expectedSymbol?: string | null;
  expectedMagicNumber?: number | null;
  mt5Linked?: boolean;
}) {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<{
    code: string;
    expiresAt: string;
    expiresInMinutes: number;
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  const phraseOk =
    confirm.trim() === ADMIN_ACTIVATION_CODE_CONFIRM_PHRASE;

  async function onGenerate() {
    if (!phraseOk) {
      setError(mapActivationError("CONFIRMATION_MISMATCH"));
      return;
    }
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch(
        `/api/admin/licenses/${licenseId}/activation-code`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ admin_confirmation: confirm.trim() }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(mapActivationError(data.code, data.error));
        return;
      }
      setGenerated({
        code: data.code,
        expiresAt: data.expiresAt,
        expiresInMinutes: data.expiresInMinutes ?? 15,
      });
      setDismissed(false);
      setConfirm("");
    } catch {
      setError("Erro de rede. Verifique a conexão e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function onCopy() {
    if (!generated?.code) return;
    try {
      await navigator.clipboard.writeText(generated.code);
      setCopied(true);
    } catch {
      setError("Não foi possível copiar automaticamente. Selecione e copie manualmente.");
    }
  }

  function onConclude() {
    setGenerated(null);
    setDismissed(true);
    setCopied(false);
  }

  const showCode = generated && !dismissed;

  return (
    <div className="rounded-lg border border-gold/30 bg-gold/5 p-5 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">
          Gerar novo código de ativação
        </h3>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Use este código apenas no EA instalado no MetaTrader da conta autorizada.
          O código será exibido <strong className="text-foreground">uma única vez</strong>.
          Não compartilhe em canais inseguros.
        </p>
      </div>

      {!canGenerate && (
        <p className="text-sm text-amber-400">
          {ineligibleReason ??
            "Licença ou assinatura não elegível para novo código de ativação."}
        </p>
      )}

      {mt5Linked && (expectedAccountLogin || expectedTradeMode) && (
        <div className="rounded border border-white/10 bg-black/30 p-4 text-sm space-y-2">
          <p className="font-medium">Este código será gerado para:</p>
          <ul className="list-disc pl-5 text-muted-foreground space-y-1">
            <li>
              Conta:{" "}
              <span className="font-mono text-foreground">
                {expectedAccountLogin ?? "—"}
              </span>
            </li>
            <li>
              Servidor:{" "}
              <span className="font-mono text-foreground">
                {expectedAccountServer ?? "—"}
              </span>
            </li>
            <li>
              Modo:{" "}
              <span className="font-mono text-gold">{expectedTradeMode ?? "DEMO"}</span>
            </li>
            <li>
              Símbolo:{" "}
              <span className="font-mono text-foreground">
                {expectedSymbol ?? "configurado no EA"}
              </span>
            </li>
            <li>
              MagicNumber:{" "}
              <span className="font-mono text-foreground">
                {expectedMagicNumber != null
                  ? expectedMagicNumber
                  : "configurado no vínculo"}
              </span>
            </li>
          </ul>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Depois de gerar o código, anexe o EA no MT5 conectado nesta conta/servidor e
            configure <span className="font-mono">InpTradeMode=REAL</span> quando o modo
            esperado for REAL. O novo device deve aparecer como{" "}
            <strong className="text-foreground">ACTIVE + REAL</strong> após o heartbeat.
          </p>
        </div>
      )}

      {canGenerate && !showCode && (
        <>
          <label className="block text-sm">
            <span className="text-muted-foreground">
              Digite exatamente:{" "}
              <span className="font-mono text-gold">
                {ADMIN_ACTIVATION_CODE_CONFIRM_PHRASE}
              </span>
            </span>
            <input
              className="mt-2 w-full max-w-lg rounded-md border border-white/10 bg-background px-3 py-2 text-sm font-mono"
              placeholder={ADMIN_ACTIVATION_CODE_CONFIRM_PHRASE}
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setError(null);
              }}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <button
            type="button"
            disabled={busy || !phraseOk}
            onClick={onGenerate}
            className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Gerando…" : "Gerar código"}
          </button>
          {!phraseOk && confirm.length > 0 && (
            <p className="text-xs text-amber-400">
              A frase de confirmação deve ser idêntica, incluindo acentos e espaços.
            </p>
          )}
        </>
      )}

      {showCode && (
        <div className="rounded-lg border-2 border-gold/50 bg-black/50 p-5 space-y-4">
          <div>
            <p className="text-sm font-medium text-gold">
              Código gerado com sucesso
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Este código será exibido apenas uma vez.
            </p>
          </div>
          <p
            className="font-mono text-2xl tracking-[0.35em] text-center text-gold py-3 select-all"
            data-testid="activation-code-display"
          >
            {generated.code}
          </p>
          <p className="text-xs text-muted-foreground text-center">
            Validade: até{" "}
            {new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            }).format(new Date(generated.expiresAt))}{" "}
            ({generated.expiresInMinutes} min)
          </p>
          <p className="text-xs text-amber-300/90 text-center font-medium">
            Este código não será exibido novamente após concluir ou atualizar a página.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              onClick={onCopy}
              className="rounded-md border border-gold/40 px-4 py-2 text-sm text-gold hover:bg-gold/10"
            >
              {copied ? "Copiado!" : "Copiar código"}
            </button>
            <button
              type="button"
              onClick={onConclude}
              className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black"
            >
              Concluir
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
