import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  listRealTradingApprovals,
} from "@/lib/admin/real-trading-approval";
import {
  maskAccountLogin,
  maskLicenseId,
} from "@/lib/risk/real-trading-guard-status";

type PageProps = {
  searchParams: Promise<{
    licenseId?: string;
    requestId?: string;
    accountLogin?: string;
    symbol?: string;
    magicNumber?: string;
  }>;
};

export default async function AdminRealTradingApprovalsPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const items = await listRealTradingApprovals({
    take: 100,
    licenseId: params.licenseId,
    requestId: params.requestId,
    accountLogin: params.accountLogin,
    symbol: params.symbol,
    magicNumber: params.magicNumber ? Number(params.magicNumber) : undefined,
  });

  const filterQuery = new URLSearchParams();
  if (params.licenseId) filterQuery.set("licenseId", params.licenseId);
  if (params.requestId) filterQuery.set("requestId", params.requestId);
  if (params.accountLogin) filterQuery.set("accountLogin", params.accountLogin);
  if (params.symbol) filterQuery.set("symbol", params.symbol);
  if (params.magicNumber) filterQuery.set("magicNumber", params.magicNumber);

  return (
    <div className="space-y-6">
      <Card className="border-gold/20 bg-gold/5 p-6">
        <CardHeader className="p-0">
          <CardTitle>Aprovações de conta real</CardTitle>
          <CardDescription className="mt-2">
            REAL liberado somente por gate controlado. Pagamento em dia não libera
            REAL sozinho. Aprovação manual não envia ordem — preflight e dispatch
            manual continuam obrigatórios.
          </CardDescription>
          <Link
            href="/admin/real-trading/approvals/new"
            className="mt-4 inline-block rounded-md bg-gold px-4 py-2 text-sm font-medium text-black"
          >
            Nova aprovação controlada →
          </Link>
        </CardHeader>
      </Card>

      <Card className="border-gold/20 p-5">
        <CardTitle className="text-base">Filtrar aprovações</CardTitle>
        <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" method="get">
          <input
            name="licenseId"
            placeholder="licenseId"
            defaultValue={params.licenseId ?? ""}
            className="rounded-md border border-white/10 bg-background px-3 py-2 text-sm"
          />
          <input
            name="requestId"
            placeholder="requestId"
            defaultValue={params.requestId ?? ""}
            className="rounded-md border border-white/10 bg-background px-3 py-2 text-sm font-mono"
          />
          <input
            name="accountLogin"
            placeholder="accountLogin"
            defaultValue={params.accountLogin ?? ""}
            className="rounded-md border border-white/10 bg-background px-3 py-2 text-sm"
          />
          <input
            name="symbol"
            placeholder="symbol"
            defaultValue={params.symbol ?? ""}
            className="rounded-md border border-white/10 bg-background px-3 py-2 text-sm"
          />
          <input
            name="magicNumber"
            placeholder="magicNumber"
            defaultValue={params.magicNumber ?? ""}
            className="rounded-md border border-white/10 bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md border border-gold/40 px-4 py-2 text-sm text-gold sm:col-span-2 lg:col-span-1"
          >
            Filtrar
          </button>
        </form>
        {filterQuery.toString() && (
          <Link
            href="/admin/real-trading/approvals"
            className="mt-2 inline-block text-sm text-muted-foreground hover:text-gold"
          >
            Limpar filtros
          </Link>
        )}
      </Card>

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5">
            <tr>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Licença</th>
              <th className="px-4 py-3">Conta</th>
              <th className="px-4 py-3">Servidor</th>
              <th className="px-4 py-3">Símbolo</th>
              <th className="px-4 py-3">Magic</th>
              <th className="px-4 py-3">max</th>
              <th className="px-4 py-3">minFM</th>
              <th className="px-4 py-3">buffer%</th>
              <th className="px-4 py-3">allowReal</th>
              <th className="px-4 py-3">Aprovado em</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-b border-white/5">
                <td className="px-4 py-3">{row.status}</td>
                <td className="px-4 py-3">{row.user.email}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {maskLicenseId(row.licenseId)}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {maskAccountLogin(row.accountLogin)}
                </td>
                <td className="px-4 py-3 text-xs">{row.accountServer}</td>
                <td className="px-4 py-3">{row.symbol}</td>
                <td className="px-4 py-3">{row.magicNumber}</td>
                <td className="px-4 py-3">{row.maxContracts}</td>
                <td className="px-4 py-3">
                  {row.minFreeMargin != null ? String(row.minFreeMargin) : "—"}
                </td>
                <td className="px-4 py-3">{String(row.marginBufferPercent)}</td>
                <td className="px-4 py-3">{row.allowReal ? "Sim" : "Não"}</td>
                <td className="px-4 py-3 text-xs">
                  {row.approvedAt?.toISOString().slice(0, 19) ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/real-trading/approvals/${row.id}`}
                    className="text-gold hover:underline"
                  >
                    Detalhes
                  </Link>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-muted-foreground">
                  Nenhuma aprovação cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
