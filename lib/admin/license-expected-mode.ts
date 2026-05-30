import { TradeMode } from "@prisma/client";
import { z } from "zod";
import { recordAdminAction } from "@/lib/admin/record-action";
import { resolveExpectedAccount } from "@/lib/licensing/license-expected-mode";
import prisma from "@/lib/prisma";
import { maskLicenseId } from "@/lib/risk/real-trading-guard-status";
import { LicenseDeviceAdminError } from "@/lib/admin/license-devices";

export const LICENSE_EXPECTED_MODE_CONFIRM_PHRASE = "CONFIGURAR MODO ESPERADO";

export const licenseExpectedModeSchema = z.object({
  admin_confirmation: z.string().min(1),
  expected_trade_mode: z.enum(["DEMO", "REAL"]),
  expected_account_login: z.string().min(1).max(32).optional(),
  expected_account_server: z.string().min(1).max(128).optional(),
  expected_symbol: z.string().min(1).max(32).optional(),
  expected_magic_number: z.coerce.number().int().positive().optional(),
});

export async function configureLicenseExpectedMode(input: {
  licenseId: string;
  actorId: string;
  adminConfirmation: string;
  expectedTradeMode: TradeMode;
  expectedAccountLogin?: string;
  expectedAccountServer?: string;
  expectedSymbol?: string;
  expectedMagicNumber?: number;
  ipAddress?: string | null;
}) {
  if (input.adminConfirmation.trim() !== LICENSE_EXPECTED_MODE_CONFIRM_PHRASE) {
    throw new LicenseDeviceAdminError(
      `Confirmação inválida. Digite: ${LICENSE_EXPECTED_MODE_CONFIRM_PHRASE}`,
      "CONFIRMATION_MISMATCH",
      400
    );
  }

  const license = await prisma.license.findUnique({
    where: { id: input.licenseId },
    include: { mt5Account: true },
  });

  if (!license) {
    throw new LicenseDeviceAdminError("Licença não encontrada.", "LICENSE_NOT_FOUND", 404);
  }

  const login =
    input.expectedAccountLogin?.trim() ||
    license.mt5Account?.login ||
    null;
  const server =
    input.expectedAccountServer?.trim() ||
    license.mt5Account?.server ||
    null;

  if (input.expectedTradeMode === TradeMode.REAL && (!login || !server)) {
    throw new LicenseDeviceAdminError(
      "Para modo REAL, vincule conta MT5 ou informe login/servidor esperados.",
      "MT5_REQUIRED_FOR_REAL",
      400
    );
  }

  const updated = await prisma.license.update({
    where: { id: license.id },
    data: {
      expectedTradeMode: input.expectedTradeMode,
      expectedAccountLogin: login,
      expectedAccountServer: server,
      expectedSymbol: input.expectedSymbol?.trim() || null,
      expectedMagicNumber: input.expectedMagicNumber ?? null,
    },
  });

  await recordAdminAction({
    actorId: input.actorId,
    action: "license.expected_mode_configured",
    targetType: "license",
    targetId: license.id,
    ipAddress: input.ipAddress,
    metadata: {
      licenseIdMasked: maskLicenseId(license.id),
      expectedTradeMode: input.expectedTradeMode,
      expectedAccountLogin: login,
      expectedAccountServer: server,
      expectedSymbol: input.expectedSymbol ?? null,
      expectedMagicNumber: input.expectedMagicNumber ?? null,
    },
  });

  return {
    licenseId: updated.id,
    expectedTradeMode: updated.expectedTradeMode,
    expectedAccount: resolveExpectedAccount({
      ...updated,
      mt5Account: license.mt5Account,
    }),
    expectedSymbol: updated.expectedSymbol,
    expectedMagicNumber: updated.expectedMagicNumber,
  };
}
