"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type CommandError = {
  ok: false;
  code: string;
  message: string;
};

const STATUS_MESSAGES: Record<string, string> = {
  PENDING: "Aguardando EA consultar comandos",
  ACKED: "EA recebeu o comando",
  EXECUTED: "EA respondeu health check",
  FAILED: "Health check falhou",
  EXPIRED: "EA não respondeu dentro do prazo",
};

export function FiboHealthCheckButton({
  licenseId,
  latestStatus,
}: {
  licenseId: string;
  latestStatus: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(latestStatus);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/real-trading/operations/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseId,
          commandType: "HEALTH_CHECK",
          adminNote: "Verificação de presença solicitada pelo Centro MR Fibo D1 Guard",
        }),
      });
      const data = (await res.json()) as
        | { ok: true; command?: { status: string }; warning?: string | null }
        | CommandError;

      if (!res.ok || !("ok" in data) || !data.ok) {
        setError("message" in data ? data.message : "Falha ao enviar health check.");
        return;
      }

      setStatus(data.command?.status ?? "PENDING");
      router.refresh();
    } catch {
      setError("Falha de rede ao enviar health check.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        className="h-7 border-gold/30 px-2 text-[11px] text-gold hover:bg-gold/10"
        disabled={loading}
        onClick={handleClick}
      >
        {loading ? "Enviando…" : "Verificar agora"}
      </Button>
      {status && (
        <p className="font-mono text-[10px] text-muted-foreground">
          HEALTH_CHECK: {STATUS_MESSAGES[status] ?? status}
        </p>
      )}
      {error && <p className="text-[10px] text-red-300">{error}</p>}
    </div>
  );
}
