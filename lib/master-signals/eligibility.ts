import {
  InstructionPurpose,
  LicenseStatus,
  SubscriptionStatus,
  TradeMode,
  type MasterSignal,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { canAcceptNewEntries, canManageOpenPositions } from "@/lib/licensing/flags";
import prisma from "@/lib/prisma";

export type LicenseEligibilityInput = {
  licenseId: string;
  licenseStatus: LicenseStatus;
  subscriptionStatus: SubscriptionStatus | null;
  haltNewEntries: boolean;
  haltAllTrading: boolean;
  hasMt5: boolean;
  mt5Login: string | null;
  mt5Server: string | null;
  exposureProfileSlug: string | null;
  planAllowDemo: boolean;
  planMaxDevices: number;
  planMaxMt5Accounts: number;
  activeDeviceCount: number;
  userActiveMt5LicenseCount: number;
  tradeMode: TradeMode | null;
  subscriptionPeriodEnd: Date | null;
};

export type EligibilityDecision =
  | { eligible: true }
  | { eligible: false; code: string; reason: string };

const licenseCandidateInclude = {
  subscription: { include: { plan: true } },
  mt5Account: true,
  exposureProfile: true,
  devices: { where: { revokedAt: null } },
} satisfies Prisma.LicenseInclude;

export type LicenseEligibilityCandidate = Prisma.LicenseGetPayload<{
  include: typeof licenseCandidateInclude;
}>;

export function normalizeProfileSlugForCompare(slug: string | null | undefined): string | null {
  if (slug == null) return null;
  const normalized = slug.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function evaluateLicenseEligibility(
  signal: Pick<MasterSignal, "purpose" | "profileSlug" | "expiresAt">,
  license: LicenseEligibilityInput,
  now = new Date()
): EligibilityDecision {
  if (signal.expiresAt && signal.expiresAt.getTime() <= now.getTime()) {
    return {
      eligible: false,
      code: "MASTER_SIGNAL_EXPIRED",
      reason: "Sinal mestre expirado.",
    };
  }

  if (license.licenseStatus !== LicenseStatus.ACTIVE) {
    return {
      eligible: false,
      code: "LICENSE_INACTIVE",
      reason: "Licença inativa.",
    };
  }

  if (license.subscriptionStatus !== SubscriptionStatus.ACTIVE) {
    return {
      eligible: false,
      code: "SUBSCRIPTION_INACTIVE",
      reason: "Assinatura inativa.",
    };
  }

  if (
    license.subscriptionPeriodEnd &&
    license.subscriptionPeriodEnd.getTime() < now.getTime()
  ) {
    return {
      eligible: false,
      code: "SUBSCRIPTION_EXPIRED",
      reason: "Assinatura fora do período vigente.",
    };
  }

  if (!license.hasMt5 || !license.mt5Login?.trim() || !license.mt5Server?.trim()) {
    return {
      eligible: false,
      code: "MT5_NOT_LINKED",
      reason: "Conta MT5 não vinculada.",
    };
  }

  if (license.activeDeviceCount < 1) {
    return {
      eligible: false,
      code: "NO_ACTIVE_DEVICE",
      reason: "Nenhum dispositivo ativo vinculado à licença.",
    };
  }

  if (license.activeDeviceCount > license.planMaxDevices) {
    return {
      eligible: false,
      code: "MAX_DEVICES_EXCEEDED",
      reason: "Limite de dispositivos do plano excedido.",
    };
  }

  if (license.userActiveMt5LicenseCount > license.planMaxMt5Accounts) {
    return {
      eligible: false,
      code: "MAX_MT5_EXCEEDED",
      reason: "Limite de contas MT5 do plano excedido.",
    };
  }

  const wantedProfile = normalizeProfileSlugForCompare(signal.profileSlug);
  if (wantedProfile) {
    const actualProfile = normalizeProfileSlugForCompare(license.exposureProfileSlug);
    if (actualProfile !== wantedProfile) {
      return {
        eligible: false,
        code: "PROFILE_MISMATCH",
        reason: "Perfil de exposição incompatível com o sinal.",
      };
    }
  }

  if (license.tradeMode === TradeMode.DEMO && !license.planAllowDemo) {
    return {
      eligible: false,
      code: "DEMO_NOT_ALLOWED",
      reason: "Conta demo não permitida neste plano.",
    };
  }

  const flagInput = {
    licenseStatus: license.licenseStatus,
    subscriptionStatus: license.subscriptionStatus,
    haltNewEntries: license.haltNewEntries,
    haltAllTrading: license.haltAllTrading,
  };

  if (signal.purpose === InstructionPurpose.ENTRY) {
    if (!canAcceptNewEntries(flagInput)) {
      return {
        eligible: false,
        code: license.haltAllTrading ? "HALT_ALL_TRADING" : "HALT_NEW_ENTRIES",
        reason: license.haltAllTrading
          ? "Execução totalmente pausada para esta licença."
          : "Novas entradas bloqueadas para esta licença.",
      };
    }
    return { eligible: true };
  }

  if (
    signal.purpose === InstructionPurpose.EXIT ||
    signal.purpose === InstructionPurpose.ADJUSTMENT
  ) {
    if (!canManageOpenPositions(flagInput)) {
      return {
        eligible: false,
        code: license.haltAllTrading ? "HALT_ALL_TRADING" : "POSITION_MANAGEMENT_BLOCKED",
        reason: "Gestão de posição não permitida para esta licença.",
      };
    }
    return { eligible: true };
  }

  return {
    eligible: false,
    code: "UNSUPPORTED_PURPOSE",
    reason: "Finalidade de instrução não suportada.",
  };
}

function toEligibilityInput(
  license: LicenseEligibilityCandidate,
  userActiveMt5LicenseCount: number,
  tradeMode: TradeMode | null
): LicenseEligibilityInput {
  const plan = license.subscription?.plan;
  return {
    licenseId: license.id,
    licenseStatus: license.status,
    subscriptionStatus: license.subscription?.status ?? null,
    haltNewEntries: license.haltNewEntries,
    haltAllTrading: license.haltAllTrading,
    hasMt5: license.mt5AccountId != null && license.mt5Account != null,
    mt5Login: license.mt5Account?.login ?? null,
    mt5Server: license.mt5Account?.server ?? null,
    exposureProfileSlug: license.exposureProfile?.slug ?? null,
    planAllowDemo: plan?.allowDemo ?? false,
    planMaxDevices: plan?.maxDevices ?? 1,
    planMaxMt5Accounts: plan?.maxMt5Accounts ?? 1,
    activeDeviceCount: license.devices.length,
    userActiveMt5LicenseCount,
    tradeMode,
    subscriptionPeriodEnd: license.subscription?.currentPeriodEnd ?? null,
  };
}

async function loadLatestTradeMode(licenseId: string): Promise<TradeMode | null> {
  const heartbeat = await prisma.eaHeartbeat.findFirst({
    where: { licenseId },
    orderBy: { receivedAt: "desc" },
    select: { tradeMode: true },
  });
  return heartbeat?.tradeMode ?? null;
}

async function countUserActiveMt5Licenses(userId: string): Promise<number> {
  return prisma.license.count({
    where: {
      userId,
      status: LicenseStatus.ACTIVE,
      mt5AccountId: { not: null },
    },
  });
}

/** Candidatos amplos — sem filtro de profile no SQL (auditoria em evaluate). */
export async function listLicenseCandidatesForMasterDispatch(): Promise<
  LicenseEligibilityCandidate[]
> {
  return prisma.license.findMany({
    where: {
      status: LicenseStatus.ACTIVE,
      subscription: { is: { status: SubscriptionStatus.ACTIVE } },
      mt5AccountId: { not: null },
    },
    include: licenseCandidateInclude,
  });
}

export type EligibleLicenseSelection = {
  candidatesCount: number;
  eligible: LicenseEligibilityCandidate[];
  skipped: Array<{ licenseId: string; code: string; reason: string }>;
};

export async function selectEligibleLicensesForMasterSignal(
  signal: Pick<MasterSignal, "purpose" | "profileSlug" | "expiresAt">
): Promise<EligibleLicenseSelection> {
  const candidates = await listLicenseCandidatesForMasterDispatch();

  const mt5CountByUser = new Map<string, number>();
  const eligible: LicenseEligibilityCandidate[] = [];
  const skipped: EligibleLicenseSelection["skipped"] = [];

  for (const license of candidates) {
    let userMt5Count = mt5CountByUser.get(license.userId);
    if (userMt5Count == null) {
      userMt5Count = await countUserActiveMt5Licenses(license.userId);
      mt5CountByUser.set(license.userId, userMt5Count);
    }

    const tradeMode = await loadLatestTradeMode(license.id);
    const decision = evaluateLicenseEligibility(
      signal,
      toEligibilityInput(license, userMt5Count, tradeMode)
    );

    if (decision.eligible) {
      eligible.push(license);
    } else {
      skipped.push({
        licenseId: license.id,
        code: decision.code,
        reason: decision.reason,
      });
    }
  }

  return { candidatesCount: candidates.length, eligible, skipped };
}
