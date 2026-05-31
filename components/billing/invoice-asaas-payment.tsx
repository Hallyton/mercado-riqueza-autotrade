"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function InvoiceAsaasPayment({
  paymentUrl,
  pixCopyPaste,
  pixQrCodeUrl,
}: {
  paymentUrl: string | null;
  pixCopyPaste: string | null;
  pixQrCodeUrl: string | null;
}) {
  const [copied, setCopied] = useState(false);

  async function copyPix() {
    if (!pixCopyPaste) return;
    try {
      await navigator.clipboard.writeText(pixCopyPaste);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        A confirmação do pagamento pode levar alguns instantes.
      </p>

      {paymentUrl && (
        <a
          href={paymentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center rounded-lg bg-gold px-5 text-sm font-semibold text-black"
        >
          Abrir cobrança
        </a>
      )}

      {pixCopyPaste && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Pix copia e cola</p>
          <p className="break-all rounded border border-white/10 bg-black/30 p-3 font-mono text-xs">
            {pixCopyPaste}
          </p>
          <Button type="button" variant="outline" onClick={copyPix}>
            {copied ? "Copiado!" : "Copiar código Pix"}
          </Button>
        </div>
      )}

      {pixQrCodeUrl && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">QR Code Pix</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pixQrCodeUrl}
            alt="QR Code Pix"
            className="max-w-[220px] rounded border border-white/10 bg-white p-2"
          />
        </div>
      )}
    </div>
  );
}
