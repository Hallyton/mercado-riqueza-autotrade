import { TradeMode } from "@prisma/client";
import { z } from "zod";
import { recordAdminAction } from "@/lib/admin/record-action";
import prisma from "@/lib/prisma";
import { runRealTradePreflight } from "@/lib/risk/real-trade-preflight";
import { maskLicenseId } from "@/lib/risk/real-trading-guard-status";

export const realPreflightDryRunSchema = z.object({
  licenseId: z.string().min(1),
  accountLogin: z.string().min(1).max(32),
  accountServer: z.string().min(1).max(128),
  symbol: z.string().min(1).max(32),
  magicNumber: z.coerce.number().int().positive(),
  requestedContracts: z.coerce.number().int().positive().default(1),
});

export class RealPreflightDryRunError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "RealPreflightDryRunError";
  }
}

export async function runAdminRealPreflightDryRun(input: {
  actorId: string;
  licenseId: string;
  accountLogin: string;
  accountServer: string;
  symbol: string;
  magicNumber: number;
  requestedContracts: number;
  ipAddress?: string | null;
}) {
  const license = await prisma.license.findUnique({
    where: { id: input.licenseId },
    select: { id: true, userId: true },
  });

  if (!license) {
    throw new RealPreflightDryRunError(
      "Licença não encontrada.",
      "LICENSE_NOT_FOUND",
      404
    );
  }

  const result = await runRealTradePreflight({
    userId: license.userId,
    licenseId: license.id,
    accountLogin: input.accountLogin,
    accountServer: input.accountServer,
    symbol: input.symbol,
    magicNumber: input.magicNumber,
    requestedContracts: input.requestedContracts,
    environment: TradeMode.REAL,
    dryRun: true,
    isAutoDispatch: false,
  });

  await recordAdminAction({
    actorId: input.actorId,
    action: "real_trading.preflight_dry_run",
    targetType: "license",
    targetId: license.id,
    ipAddress: input.ipAddress,
    metadata: {
      licenseIdMasked: maskLicenseId(license.id),
      preflightId: result.preflightId,
      status: result.status,
      reasonCode: result.reasonCode,
      dryRun: true,
      accountLogin: input.accountLogin.trim(),
      accountServer: input.accountServer.trim(),
      symbol: input.symbol.trim(),
      magicNumber: input.magicNumber,
      requestedContracts: input.requestedContracts,
    },
  });

  return {
    ok: true,
    dryRun: true as const,
    preflightId: result.preflightId,
    status: result.status,
    passed: result.passed,
    reasonCode: result.reasonCode,
    reason: result.reason,
    checks: result.checks,
    flags: result.flags,
    approvalId: result.approvalId,
    accountSnapshotId: result.accountSnapshotId,
    readyForManualInstruction:
      result.passed === true
        ? "Pronto para criar instruction manual real (dry-run não envia ordem nem entrega ao EA)."
        : null,
  };
}
