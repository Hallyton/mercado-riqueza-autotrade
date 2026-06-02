import Link from "next/link";
import { listRealTradingInstructionsAdmin } from "@/lib/admin/real-trading-instructions";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

function fmtPrice(value: { toString(): string } | null | undefined) {
  if (value == null) return "—";
  return Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 6 });
}

export default async function AdminRealTradingInstructionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    licenseId?: string;
    accountLogin?: string;
    symbol?: string;
    magicNumber?: string;
    status?: string;
  }>;
}) {
  const params = await searchParams;
  const magicNumber =
    params.magicNumber && Number.isFinite(Number(params.magicNumber))
      ? Number(params.magicNumber)
      : undefined;

  const items = await listRealTradingInstructionsAdmin({
    licenseId: params.licenseId,
    accountLogin: params.accountLogin,
    symbol: params.symbol,
    magicNumber,
    take: 100,
  });

  return (
    <div className="space-y-6">
      <Card className="border-gold/20 p-6">
        <CardHeader className="p-0">
          <CardTitle>Conta real — Instruções reais</CardTitle>
          <CardDescription className="mt-2">
            Monitoramento de instructions <span className="font-mono text-gold">REAL_MANUAL</span>.
            A fila <Link href="/admin/instrucoes" className="text-gold hover:underline">/admin/instrucoes</Link> é
            exclusiva para TEST/HOMOLOGATION e não lista instruções reais controladas.
          </CardDescription>
        </CardHeader>
      </Card>

      <form
        method="get"
        action="/admin/real-trading/instructions"
        className="grid gap-3 rounded-lg border border-white/10 bg-black/20 p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className="block text-sm">
          <span className="text-muted-foreground">LicenseId</span>
          <input
            name="licenseId"
            defaultValue={params.licenseId ?? ""}
            className="mt-1 w-full rounded border border-white/10 bg-background px-2 py-1.5 font-mono text-xs"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Conta</span>
          <input
            name="accountLogin"
            defaultValue={params.accountLogin ?? ""}
            className="mt-1 w-full rounded border border-white/10 bg-background px-2 py-1.5 font-mono text-xs"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Símbolo</span>
          <input
            name="symbol"
            defaultValue={params.symbol ?? ""}
            className="mt-1 w-full rounded border border-white/10 bg-background px-2 py-1.5 font-mono text-xs"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Magic</span>
          <input
            name="magicNumber"
            defaultValue={params.magicNumber ?? ""}
            className="mt-1 w-full rounded border border-white/10 bg-background px-2 py-1.5 font-mono text-xs"
          />
        </label>
        <div className="sm:col-span-2 lg:col-span-4">
          <button
            type="submit"
            className="rounded bg-gold px-3 py-1.5 text-sm font-medium text-black"
          >
            Filtrar
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[1200px] text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5">
            <tr>
              <th className="px-3 py-3">Criado em</th>
              <th className="px-3 py-3">Cliente</th>
              <th className="px-3 py-3">LicenseId</th>
              <th className="px-3 py-3">Conta</th>
              <th className="px-3 py-3">Servidor</th>
              <th className="px-3 py-3">Símbolo</th>
              <th className="px-3 py-3">Lado</th>
              <th className="px-3 py-3">Tipo</th>
              <th className="px-3 py-3">Preço</th>
              <th className="px-3 py-3">SL</th>
              <th className="px-3 py-3">TP</th>
              <th className="px-3 py-3">Contratos</th>
              <th className="px-3 py-3">Magic</th>
              <th className="px-3 py-3">Source</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">EA</th>
              <th className="px-3 py-3">Execução</th>
              <th className="px-3 py-3">Proteção</th>
              <th className="px-3 py-3">Motivo</th>
              <th className="px-3 py-3">PreflightId</th>
              <th className="px-3 py-3">InstructionId</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="px-3 py-3">{fmtDate(row.createdAt)}</td>
                <td className="px-3 py-3">{row.license.user.email}</td>
                <td className="px-3 py-3 font-mono text-xs">{row.licenseId}</td>
                <td className="px-3 py-3 font-mono text-xs">{row.accountLogin}</td>
                <td className="px-3 py-3 font-mono text-xs">{row.accountServer}</td>
                <td className="px-3 py-3">{row.symbol}</td>
                <td className="px-3 py-3">{row.side}</td>
                <td className="px-3 py-3">{row.orderType}</td>
                <td className="px-3 py-3">{fmtPrice(row.orderPrice)}</td>
                <td className="px-3 py-3">{fmtPrice(row.stopLoss)}</td>
                <td className="px-3 py-3">{fmtPrice(row.takeProfit)}</td>
                <td className="px-3 py-3">{Number(row.quantity)}</td>
                <td className="px-3 py-3">{row.magicNumber}</td>
                <td className="px-3 py-3">{row.source}</td>
                <td className="px-3 py-3">{row.currentStatus}</td>
                <td className="px-3 py-3">{row.eaHeartbeat?.eaStatus ?? "—"}</td>
                <td className="px-3 py-3 font-mono text-xs">
                  {row.latestExecution?.id ?? "—"}
                </td>
                <td className="px-3 py-3">
                  {row.latestProtection?.protectionStatus ?? "—"}
                </td>
                <td className="px-3 py-3 font-mono text-xs">
                  {row.closeReasonCode ?? "—"}
                </td>
                <td className="px-3 py-3 font-mono text-xs break-all">
                  {row.preflightId ?? "—"}
                </td>
                <td className="px-3 py-3">
                  <Link
                    href={`/admin/real-trading/instructions/${row.id}`}
                    className="font-mono text-xs text-gold hover:underline break-all"
                  >
                    {row.id}
                  </Link>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={22} className="px-3 py-8 text-muted-foreground">
                  Nenhuma instruction REAL_MANUAL encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
