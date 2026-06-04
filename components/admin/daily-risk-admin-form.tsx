"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DailyRiskAdminForm({
  defaultLicenseId = "",
  defaultLogin = "",
  defaultServer = "",
  defaultSymbol = "WDON26",
}: {
  defaultLicenseId?: string;
  defaultLogin?: string;
  defaultServer?: string;
  defaultSymbol?: string;
}) {
  const [licenseId, setLicenseId] = useState(defaultLicenseId);
  const [accountLogin, setAccountLogin] = useState(defaultLogin);
  const [accountServer, setAccountServer] = useState(defaultServer);
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [enabled, setEnabled] = useState(true);
  const [limitBrl, setLimitBrl] = useState("300");
  const [includeOpen, setIncludeOpen] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/real-trading/daily-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_id: licenseId,
          account_login: accountLogin,
          account_server: accountServer,
          symbol,
          enabled,
          daily_loss_limit_brl: Number(limitBrl),
          include_open_pnl: includeOpen,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ? JSON.stringify(data.error) : "Erro ao salvar");
        return;
      }
      setMessage("Configuração salva.");
    } catch {
      setMessage("Falha de rede.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-lg">
      <div>
        <label htmlFor="license_id" className="text-sm font-medium">
          Licença (ID)
        </label>
        <Input
          id="license_id"
          value={licenseId}
          onChange={(e) => setLicenseId(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="account_login" className="text-sm font-medium">
          Conta login
        </label>
        <Input
          id="account_login"
          value={accountLogin}
          onChange={(e) => setAccountLogin(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="account_server" className="text-sm font-medium">
          Servidor
        </label>
        <Input
          id="account_server"
          value={accountServer}
          onChange={(e) => setAccountServer(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="symbol" className="text-sm font-medium">
          Símbolo
        </label>
        <Input id="symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
      </div>
      <div>
        <label htmlFor="limit" className="text-sm font-medium">
          Limite diário (R$)
        </label>
        <Input
          id="limit"
          type="number"
          min={1}
          step="0.01"
          value={limitBrl}
          onChange={(e) => setLimitBrl(e.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Habilitar stop financeiro diário
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={includeOpen}
          onChange={(e) => setIncludeOpen(e.target.checked)}
        />
        Considerar PnL aberto
      </label>
      <Button type="submit" disabled={loading}>
        {loading ? "Salvando…" : "Salvar"}
      </Button>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </form>
  );
}
