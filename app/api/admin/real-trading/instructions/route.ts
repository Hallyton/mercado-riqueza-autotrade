import { InstructionSource, OrderLogStatus } from "@prisma/client";
import { jsonError, jsonOk } from "@/lib/api/http";
import {
  listRealTradingInstructionsAdmin,
  serializeRealTradingInstructionListItem,
} from "@/lib/admin/real-trading-instructions";
import { requireAdminApiSession } from "@/lib/auth/admin-api";

export async function GET(request: Request) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const url = new URL(request.url);
  const licenseId = url.searchParams.get("licenseId") ?? undefined;
  const accountLogin = url.searchParams.get("accountLogin") ?? undefined;
  const symbol = url.searchParams.get("symbol") ?? undefined;
  const magicRaw = url.searchParams.get("magicNumber");
  const sourceRaw = url.searchParams.get("source");
  const statusRaw = url.searchParams.get("status");
  const dateFromRaw = url.searchParams.get("dateFrom");
  const dateToRaw = url.searchParams.get("dateTo");

  const magicNumber =
    magicRaw && Number.isFinite(Number(magicRaw)) ? Number(magicRaw) : undefined;

  const source =
    sourceRaw === InstructionSource.REAL_MANUAL
      ? InstructionSource.REAL_MANUAL
      : undefined;

  const status =
    statusRaw && Object.values(OrderLogStatus).includes(statusRaw as OrderLogStatus)
      ? (statusRaw as OrderLogStatus)
      : undefined;

  let dateFrom: Date | undefined;
  let dateTo: Date | undefined;
  if (dateFromRaw) {
    const d = new Date(dateFromRaw);
    if (Number.isNaN(d.getTime())) {
      return jsonError("dateFrom inválido", 400, "INVALID_DATE_FROM");
    }
    dateFrom = d;
  }
  if (dateToRaw) {
    const d = new Date(dateToRaw);
    if (Number.isNaN(d.getTime())) {
      return jsonError("dateTo inválido", 400, "INVALID_DATE_TO");
    }
    dateTo = d;
  }

  const items = await listRealTradingInstructionsAdmin({
    licenseId,
    accountLogin,
    symbol,
    magicNumber,
    source,
    status,
    dateFrom,
    dateTo,
    take: 100,
  });

  return jsonOk({
    items: items.map(serializeRealTradingInstructionListItem),
    count: items.length,
  });
}
