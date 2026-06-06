import prisma from "@/lib/prisma";
import { MR_FIBO_D1_GUARD_CODE } from "@/lib/risk/autonomous-strategy-reasons";
import { normalizeFiboStrategyCode } from "@/lib/strategy/normalize-strategy-code";

export async function getLicenseOperationControl(
  licenseId: string,
  strategyCode: string = MR_FIBO_D1_GUARD_CODE
) {
  const canonical = normalizeFiboStrategyCode(strategyCode);
  return prisma.licenseOperationControl.findUnique({
    where: {
      licenseId_strategyCode: { licenseId, strategyCode: canonical },
    },
  });
}

export async function setLicenseOperationPaused(input: {
  licenseId: string;
  strategyCode: string;
  paused: boolean;
  pausedByAdminId: string;
  reason?: string | null;
}) {
  const strategyCode = normalizeFiboStrategyCode(input.strategyCode);
  const now = new Date();

  return prisma.licenseOperationControl.upsert({
    where: {
      licenseId_strategyCode: { licenseId: input.licenseId, strategyCode },
    },
    create: {
      licenseId: input.licenseId,
      strategyCode,
      paused: input.paused,
      pausedReason: input.reason ?? null,
      pausedByAdminId: input.paused ? input.pausedByAdminId : null,
      pausedAt: input.paused ? now : null,
      resumedAt: input.paused ? null : now,
    },
    update: {
      paused: input.paused,
      pausedReason: input.paused ? input.reason ?? null : null,
      pausedByAdminId: input.paused ? input.pausedByAdminId : null,
      pausedAt: input.paused ? now : undefined,
      resumedAt: input.paused ? null : now,
    },
  });
}

export async function buildOperationControlConfig(
  licenseId: string,
  strategyCode?: string | null
) {
  const code = strategyCode ? normalizeFiboStrategyCode(strategyCode) : MR_FIBO_D1_GUARD_CODE;
  const control = await getLicenseOperationControl(licenseId, code);
  return {
    paused: control?.paused ?? false,
    reason: control?.pausedReason ?? null,
    strategy_code: code,
  };
}
