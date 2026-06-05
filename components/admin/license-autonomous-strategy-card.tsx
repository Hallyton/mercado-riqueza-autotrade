"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AUTONOMOUS_STRATEGY_BLOCKER_MESSAGES,
  type getLicenseAutonomousStrategyAdminView,
} from "@/lib/admin/license-autonomous-strategy";

type AutonomousView = NonNullable<
  Awaited<ReturnType<typeof getLicenseAutonomousStrategyAdminView>>
>;

export function LicenseAutonomousStrategyCard({ view }: { view: AutonomousView }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [pendingAction, setPendingAction] = useState<"enable" | "disable" | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const expectedPhrase =
    pendingAction === "enable"
      ? view.enableConfirmPhrase
      : pendingAction === "disable"
        ? view.disableConfirmPhrase
        : "";

  async function submitAction(enabled: boolean) {
    if (confirm.trim() !== expectedPhrase) {
      setError(`Digite exatamente: ${expectedPhrase}`);
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/licenses/${view.licenseId}/autonomous-strategy`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            strategy_code: view.strategyCode,
            autonomous_strategy_enabled: enabled,
            admin_confirmation: confirm.trim(),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Falha ao atualizar estratégia.");
        return;
      }
      setMessage(
        enabled
          ? "Estratégia autônoma habilitada no RobotInstance."
          : "Estratégia autônoma desabilitada."
      );
      setPendingAction(null);
      setConfirm("");
      router.refresh();
    } catch {
      setError("Falha de rede.");
    } finally {
      setBusy(false);
    }
  }

  async function linkRobot() {
    if (!view.unlinkedRobotInstanceId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/licenses/${view.licenseId}/autonomous-strategy`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "link_robot_instance",
            robot_instance_id: view.unlinkedRobotInstanceId,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Falha ao vincular robô.");
        return;
      }
      setMessage("Robô comercial vinculado à licença.");
      router.refresh();
    } catch {
      setError("Falha de rede.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-gold/20 p-6">
      <CardHeader className="p-0">
        <CardTitle>Estratégia autônoma</CardTitle>
        <CardDescription className="mt-2">
          Controle administrativo da estratégia interna que o EA Executor pode
          operar sem sinal manual, sempre subordinada aos gates da plataforma.
        </CardDescription>
      </CardHeader>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Estratégia</dt>
          <dd>{view.strategyDisplayName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Código</dt>
          <dd className="font-mono text-xs">{view.strategyCode}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd className={view.autonomousStrategyEnabled ? "text-emerald-400" : ""}>
            {view.autonomousStrategyEnabled ? "Ativa" : "Inativa"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">RobotInstance</dt>
          <dd className="font-mono text-xs">{view.robotInstanceId ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Símbolo esperado</dt>
          <dd>{view.expectedSymbol ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">MagicNumber</dt>
          <dd>{view.expectedMagicNumber ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Max contratos</dt>
          <dd>{view.maxContracts}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Stop financeiro diário</dt>
          <dd>
            {view.dailyFinancialRisk.configured
              ? `Configurado (R$ ${view.dailyFinancialRisk.limitBrl?.toFixed(2)})`
              : "Não configurado"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Device</dt>
          <dd>{view.device.summary}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Conta MT5</dt>
          <dd>
            {view.mt5Account
              ? `${view.mt5Account.login} @ ${view.mt5Account.server}`
              : "Não vinculada"}
          </dd>
        </div>
      </dl>

      <p className="mt-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted-foreground">
        A estratégia só opera se ENABLE_AUTONOMOUS_STRATEGY=true,
        ENABLE_REAL_TRADING=true, licença ativa, pagamento confirmado, device
        REAL, PRE_MARKET, approval e stop financeiro diário OK.
      </p>

      {view.blockers.length > 0 && !view.autonomousStrategyEnabled && (
        <ul className="mt-4 space-y-1 text-sm text-amber-300">
          {view.blockers.map((code) => (
            <li key={code}>
              <span className="font-mono text-xs">{code}</span>
              {" — "}
              {AUTONOMOUS_STRATEGY_BLOCKER_MESSAGES[code] ?? code}
            </li>
          ))}
        </ul>
      )}

      {view.canLinkExistingRobot && (
        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={linkRobot}
          >
            Vincular robô comercial existente à licença
          </Button>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={`/admin/licenses/${view.licenseId}/strategy-config`}>
          <Button type="button" variant="outline">
            Configurar parâmetros
          </Button>
        </Link>
        {!pendingAction && (
          <>
            <Button
              type="button"
              disabled={busy || !view.canEnable || view.autonomousStrategyEnabled}
              onClick={() => {
                setPendingAction("enable");
                setConfirm("");
                setError(null);
              }}
            >
              Habilitar MR Fibo D1 Guard
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !view.canDisable || !view.autonomousStrategyEnabled}
              onClick={() => {
                setPendingAction("disable");
                setConfirm("");
                setError(null);
              }}
            >
              Desabilitar MR Fibo D1 Guard
            </Button>
          </>
        )}
      </div>

      {pendingAction && (
        <div className="mt-4 space-y-3 rounded-lg border border-gold/20 p-4">
          <p className="text-sm text-muted-foreground">
            Confirme digitando:{" "}
            <span className="font-mono text-gold">{expectedPhrase}</span>
          </p>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={expectedPhrase}
            disabled={busy}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={busy}
              onClick={() =>
                submitAction(pendingAction === "enable")
              }
            >
              {busy ? "Salvando…" : "Confirmar"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setPendingAction(null);
                setConfirm("");
                setError(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {message && <p className="mt-3 text-sm text-emerald-400">{message}</p>}
    </Card>
  );
}
