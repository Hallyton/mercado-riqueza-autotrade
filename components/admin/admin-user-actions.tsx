"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  USER_BLOCK_CONFIRM_PHRASE,
  USER_DEACTIVATE_CONFIRM_PHRASE,
  USER_REACTIVATE_CONFIRM_PHRASE,
  USER_RESET_PASSWORD_CONFIRM_PHRASE,
} from "@/lib/admin/users";

type Props = {
  userId: string;
  status: string;
  currentUserId?: string;
};

export function AdminUserActions({ userId, status, currentUserId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmations, setConfirmations] = useState<Record<string, string>>({});
  const [oneTimePassword, setOneTimePassword] = useState<string | null>(null);
  const [passwordDismissed, setPasswordDismissed] = useState(false);

  const isSelf = currentUserId === userId;

  async function post(
    path: string,
    confirmation: string,
    key: string,
    extra?: Record<string, unknown>
  ) {
    setBusy(key);
    setMessage(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_confirmation: confirmation,
          ...extra,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Operação falhou.");
        return;
      }
      if (data.temporary_password) {
        setOneTimePassword(data.temporary_password);
        setPasswordDismissed(false);
      }
      setConfirmations((prev) => ({ ...prev, [key]: "" }));
      router.refresh();
    } catch {
      setMessage("Erro de rede.");
    } finally {
      setBusy(null);
    }
  }

  function setConfirm(key: string, value: string) {
    setConfirmations((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-6">
      {isSelf && (
        <p className="text-sm text-amber-400">
          Você não pode bloquear ou inativar a própria conta por esta tela.
        </p>
      )}

      {status !== "BLOCKED" && !isSelf && (
        <ActionBlock
          title="Bloquear usuário"
          phrase={USER_BLOCK_CONFIRM_PHRASE}
          confirmValue={confirmations.block ?? ""}
          onConfirmChange={(v) => setConfirm("block", v)}
          buttonLabel="Bloquear"
          buttonClass="text-red-300"
          disabled={busy !== null}
          onSubmit={() =>
            post(
              `/api/admin/users/${userId}/block`,
              confirmations.block ?? "",
              "block"
            )
          }
        />
      )}

      {status !== "INACTIVE" && status !== "BLOCKED" && !isSelf && (
        <ActionBlock
          title="Inativar usuário"
          phrase={USER_DEACTIVATE_CONFIRM_PHRASE}
          confirmValue={confirmations.deactivate ?? ""}
          onConfirmChange={(v) => setConfirm("deactivate", v)}
          buttonLabel="Inativar"
          buttonClass="text-amber-400"
          disabled={busy !== null}
          onSubmit={() =>
            post(
              `/api/admin/users/${userId}/deactivate`,
              confirmations.deactivate ?? "",
              "deactivate"
            )
          }
        />
      )}

      {(status === "BLOCKED" || status === "INACTIVE") && (
        <ActionBlock
          title="Reativar usuário"
          phrase={USER_REACTIVATE_CONFIRM_PHRASE}
          confirmValue={confirmations.reactivate ?? ""}
          onConfirmChange={(v) => setConfirm("reactivate", v)}
          buttonLabel="Reativar"
          buttonClass="text-gold"
          disabled={busy !== null}
          onSubmit={() =>
            post(
              `/api/admin/users/${userId}/reactivate`,
              confirmations.reactivate ?? "",
              "reactivate"
            )
          }
        />
      )}

      <ActionBlock
        title="Resetar senha"
        phrase={USER_RESET_PASSWORD_CONFIRM_PHRASE}
        confirmValue={confirmations.reset ?? ""}
        onConfirmChange={(v) => setConfirm("reset", v)}
        buttonLabel="Resetar senha"
        buttonClass="text-gold"
        disabled={busy !== null}
        onSubmit={() =>
          post(
            `/api/admin/users/${userId}/reset-password`,
            confirmations.reset ?? "",
            "reset",
            { generate_password: true, must_change_password: true }
          )
        }
      />

      {oneTimePassword && !passwordDismissed && (
        <div className="rounded-lg border border-gold/40 bg-black/40 p-4 space-y-3">
          <p className="text-sm font-medium text-gold">Senha temporária gerada</p>
          <p className="text-xs text-muted-foreground">
            Exibida uma única vez. O usuário deve trocar no próximo acesso.
          </p>
          <p className="font-mono text-lg text-center select-all">{oneTimePassword}</p>
          <div className="flex gap-3">
            <button
              type="button"
              className="text-sm text-gold hover:underline"
              onClick={() => navigator.clipboard.writeText(oneTimePassword)}
            >
              Copiar senha
            </button>
            <button
              type="button"
              className="text-sm text-muted-foreground hover:underline"
              onClick={() => {
                setOneTimePassword(null);
                setPasswordDismissed(true);
              }}
            >
              Concluir
            </button>
          </div>
        </div>
      )}

      {message && <p className="text-sm text-amber-400">{message}</p>}
    </div>
  );
}

function ActionBlock({
  title,
  phrase,
  confirmValue,
  onConfirmChange,
  buttonLabel,
  buttonClass,
  disabled,
  onSubmit,
}: {
  title: string;
  phrase: string;
  confirmValue: string;
  onConfirmChange: (v: string) => void;
  buttonLabel: string;
  buttonClass: string;
  disabled: boolean;
  onSubmit: () => void;
}) {
  const phraseOk = confirmValue.trim() === phrase;
  return (
    <div className="rounded border border-white/10 p-4 space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground font-mono">{phrase}</p>
      <input
        className="w-full max-w-md rounded border border-white/10 bg-background px-3 py-2 text-sm font-mono"
        placeholder={phrase}
        value={confirmValue}
        onChange={(e) => onConfirmChange(e.target.value)}
        autoComplete="off"
      />
      <button
        type="button"
        disabled={disabled || !phraseOk}
        className={`text-sm hover:underline disabled:opacity-40 ${buttonClass}`}
        onClick={onSubmit}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
