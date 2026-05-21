"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export type LicenseOnboardingItem = {
  id: string;
  status: string;
  mt5Login: string | null;
  mt5Server: string | null;
  deviceCount: number;
  maxDevices: number;
  canLinkMt5: boolean;
  canIssueActivationCode: boolean;
};

export function LicenseOnboarding({ license }: { license: LicenseOnboardingItem }) {
  const router = useRouter();
  const [login, setLogin] = useState(license.mt5Login ?? "");
  const [server, setServer] = useState(license.mt5Server ?? "");
  const [broker, setBroker] = useState("");
  const [busy, setBusy] = useState<"mt5" | "code" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activationCode, setActivationCode] = useState<string | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<string | null>(null);

  async function linkMt5(e: React.FormEvent) {
    e.preventDefault();
    setBusy("mt5");
    setMessage(null);
    const res = await fetch(`/api/me/licenses/${license.id}/mt5-account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        login,
        server,
        broker_name: broker || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setMessage(data.error ?? "Não foi possível vincular a conta MT5.");
      return;
    }
    setMessage("Conta MT5 vinculada com sucesso.");
    setActivationCode(null);
    router.refresh();
  }

  async function issueCode() {
    setBusy("code");
    setMessage(null);
    const res = await fetch(`/api/me/licenses/${license.id}/activation-code`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setMessage(data.error ?? "Não foi possível gerar o código.");
      return;
    }
    setActivationCode(data.code);
    setCodeExpiresAt(data.expiresAt);
    setMessage("Código gerado. Válido por 15 minutos — use no EA (InpActivationCode).");
  }

  async function copyCode() {
    if (!activationCode) return;
    try {
      await navigator.clipboard.writeText(activationCode);
      setMessage("Código copiado para a área de transferência.");
    } catch {
      setMessage("Copie o código manualmente.");
    }
  }

  const hasMt5 = Boolean(license.mt5Login && license.mt5Server);

  return (
    <div className="mt-4 space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gold">
        Ativação do EA
      </p>

      {hasMt5 ? (
        <p className="text-sm text-foreground">
          MT5 autorizada:{" "}
          <span className="font-mono text-gold">
            {license.mt5Login} @ {license.mt5Server}
          </span>
        </p>
      ) : license.canLinkMt5 ? (
        <form onSubmit={linkMt5} className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Informe o login e o servidor exatamente como no MetaTrader 5.
          </p>
          <div>
            <Label htmlFor={`login-${license.id}`}>Login MT5</Label>
            <Input
              id={`login-${license.id}`}
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="12345678"
              required
            />
          </div>
          <div>
            <Label htmlFor={`server-${license.id}`}>Servidor</Label>
            <Input
              id={`server-${license.id}`}
              value={server}
              onChange={(e) => setServer(e.target.value)}
              placeholder="Corretora-Server"
              required
            />
          </div>
          <div>
            <Label htmlFor={`broker-${license.id}`}>Corretora (opcional)</Label>
            <Input
              id={`broker-${license.id}`}
              value={broker}
              onChange={(e) => setBroker(e.target.value)}
              placeholder="Nome da corretora"
            />
          </div>
          <Button type="submit" variant="outline" isLoading={busy === "mt5"}>
            Vincular conta MT5
          </Button>
        </form>
      ) : (
        <p className="text-sm text-amber-200">
          Vínculo MT5 indisponível com a assinatura ou licença atuais.
        </p>
      )}

      {license.canIssueActivationCode && hasMt5 && (
        <div className="space-y-3 border-t border-white/10 pt-4">
          <p className="text-sm text-muted-foreground">
            Gere um código de uso único para o campo{" "}
            <span className="font-mono text-foreground">InpActivationCode</span>{" "}
            do EA. Dispositivos ativos: {license.deviceCount}/{license.maxDevices}.
          </p>
          <Button
            type="button"
            variant="primary"
            isLoading={busy === "code"}
            onClick={issueCode}
          >
            Gerar código de ativação
          </Button>
          {activationCode && (
            <div className="space-y-2 rounded-lg border border-gold/30 bg-gold/5 p-3">
              <p className="text-xs text-muted-foreground">Código (15 min)</p>
              <p className="break-all font-mono text-lg tracking-wider text-gold">
                {activationCode}
              </p>
              {codeExpiresAt && (
                <p className="text-xs text-muted-foreground">
                  Expira em:{" "}
                  {new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(codeExpiresAt))}
                </p>
              )}
              <Button type="button" variant="outline" onClick={copyCode}>
                Copiar código
              </Button>
            </div>
          )}
        </div>
      )}

      {message && (
        <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  );
}
