import { NextResponse } from "next/server";
import {
  RealPreflightDryRunError,
  realPreflightDryRunSchema,
  runAdminRealPreflightDryRun,
} from "@/lib/admin/real-preflight-dry-run";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";

export async function POST(request: Request) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const json = await request.json().catch(() => null);
  const parsed = realPreflightDryRunSchema.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  try {
    const result = await runAdminRealPreflightDryRun({
      actorId: authResult.session!.user!.id!,
      licenseId: parsed.data.licenseId,
      accountLogin: parsed.data.accountLogin,
      accountServer: parsed.data.accountServer,
      symbol: parsed.data.symbol,
      magicNumber: parsed.data.magicNumber,
      requestedContracts: parsed.data.requestedContracts,
      ipAddress: clientIp(request),
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof RealPreflightDryRunError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status }
      );
    }
    console.error("[admin/real-trading/preflight-dry-run]", e);
    return NextResponse.json(
      { error: "Falha ao executar preflight dry-run" },
      { status: 500 }
    );
  }
}
