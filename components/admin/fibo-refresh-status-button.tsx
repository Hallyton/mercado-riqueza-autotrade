"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type CommandError = {
  ok: false;
  code: string;
  message: string;
};

export function FiboRefreshStatusButton({
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
          commandType: "REFRESH_STATUS",
          adminConfirmation: "ATUALIZAR STATUS",
          adminNote: "Solicitado pelo Centro MR Fibo D1 Guard",
        }),
      });
      const data = (await res.json()) as
        | { ok: true; command?: { status: string } }
        | CommandError;

      if (!res.ok || !("ok" in data) || !data.ok) {
        setError("message" in data ? data.message : "Falha ao enviar comando.");
        return;
      }

      setStatus(data.command?.status ?? "PENDING");
      router.refresh();
    } catch {
      setError("Falha de rede ao enviar comando.");
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
        {loading ? "Enviando…" : "Atualizar status"}
      </Button>
      {status && (
        <p className="font-mono text-[10px] text-muted-foreground">
          REFRESH_STATUS: {status}
        </p>
      )}
      {error && <p className="text-[10px] text-red-300">{error}</p>}
    </div>
  );
}
