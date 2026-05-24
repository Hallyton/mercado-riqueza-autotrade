import { MasterSignalDispatchStatus, type MasterSignal, type Prisma } from "@prisma/client";
import {
  buildTrackingSummaryFromDispatches,
  deriveConsolidatedTrackingStatus,
  resolveRowExecutionStatus,
  resolveRowHint,
  type ConsolidatedTrackingStatus,
  type TrackingSummaryCounts,
} from "@/lib/master-signals/admin-tracking";
import { selectEligibleLicensesForMasterSignal } from "@/lib/master-signals/eligibility";
import { redactMasterSignalPayload } from "@/lib/master-signals/service";
import prisma from "@/lib/prisma";

export type { ConsolidatedTrackingStatus, TrackingSummaryCounts };
export {
  buildTrackingSummaryFromDispatches,
  deriveConsolidatedTrackingStatus,
} from "@/lib/master-signals/admin-tracking";

const SENSITIVE_PAYLOAD_KEYS = ["secret", "token", "password", "authorization"];

async function findMasterSignalByKey(masterSignalKey: string) {
  return (
    (await prisma.masterSignal.findUnique({
      where: { masterSignalId: masterSignalKey },
    })) ??
    (await prisma.masterSignal.findUnique({
      where: { id: masterSignalKey },
    }))
  );
}

const dispatchTrackingInclude = {
  license: {
    select: {
      id: true,
      status: true,
      user: { select: { email: true, name: true } },
      subscription: { include: { plan: { select: { name: true, slug: true } } } },
      mt5Account: { select: { login: true, server: true } },
      exposureProfile: { select: { slug: true } },
      devices: {
        where: { revokedAt: null },
        orderBy: { lastSeenAt: "desc" as const },
        take: 1,
        select: { deviceId: true, lastSeenAt: true, eaVersion: true },
      },
      eaHeartbeats: {
        orderBy: { receivedAt: "desc" as const },
        take: 1,
        select: { deviceId: true, receivedAt: true, eaStatus: true },
      },
    },
  },
  instruction: {
    select: {
      id: true,
      source: true,
      currentStatus: true,
      symbol: true,
      side: true,
      orderType: true,
      purpose: true,
      quantity: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true,
      executions: {
        orderBy: { createdAt: "desc" as const },
        select: {
          id: true,
          status: true,
          brokerTicket: true,
          errorCode: true,
          errorMessage: true,
          executedAt: true,
          createdAt: true,
        },
      },
    },
  },
} satisfies Prisma.MasterSignalDispatchInclude;

type DispatchTrackingRow = Prisma.MasterSignalDispatchGetPayload<{
  include: typeof dispatchTrackingInclude;
}>;

function decimalToNumber(value: { toString(): string } | number | string): number {
  return Number(value);
}

export function sanitizeRawPayloadForAdmin(
  raw: MasterSignal["rawPayloadRedacted"]
): Record<string, unknown> | null {
  if (raw == null) return null;
  const redacted = redactMasterSignalPayload(raw);
  const json = JSON.stringify(redacted).toLowerCase();
  for (const fragment of SENSITIVE_PAYLOAD_KEYS) {
    if (json.includes(fragment)) {
      return { redacted: true, note: "Payload omitido por segurança" };
    }
  }
  return redacted;
}

export type MasterSignalListItem = {
  id: string;
  masterSignalId: string;
  source: string;
  symbol: string;
  side: string;
  orderType: string;
  purpose: string;
  profileSlug: string | null;
  status: string;
  receivedAt: Date;
  validatedAt: Date | null;
  dispatchedAt: Date | null;
  expiresAt: Date | null;
  dispatchCount: number;
  instructionCount: number;
  executedCount: number;
  consolidatedStatus: ConsolidatedTrackingStatus;
};

export async function listMasterSignalsForAdmin(
  limit = 100
): Promise<MasterSignalListItem[]> {
  const rows = await prisma.masterSignal.findMany({
    orderBy: { receivedAt: "desc" },
    take: limit,
    include: {
      dispatches: {
        include: {
          instruction: {
            select: {
              currentStatus: true,
              expiresAt: true,
              executions: { select: { status: true } },
            },
          },
        },
      },
    },
  });

  return rows.map((row) => {
    const summary = buildTrackingSummaryFromDispatches(row.dispatches);
    const consolidatedStatus = deriveConsolidatedTrackingStatus({
      masterStatus: row.status,
      summary,
      expiresAt: row.expiresAt,
    });

    return {
      id: row.id,
      masterSignalId: row.masterSignalId,
      source: row.source,
      symbol: row.symbol,
      side: row.side,
      orderType: row.orderType,
      purpose: row.purpose,
      profileSlug: row.profileSlug,
      status: row.status,
      receivedAt: row.receivedAt,
      validatedAt: row.validatedAt,
      dispatchedAt: row.dispatchedAt,
      expiresAt: row.expiresAt,
      dispatchCount: summary.dispatchCount,
      instructionCount: summary.instructionCount,
      executedCount: summary.executedCount,
      consolidatedStatus,
    };
  });
}

export type MasterSignalDispatchRow = {
  id: string;
  licenseId: string;
  status: MasterSignalDispatchStatus;
  reason: string | null;
  instructionId: string | null;
  createdAt: Date;
  license: {
    id: string;
    clientEmail: string;
    mt5Label: string | null;
    exposureProfileSlug: string | null;
  };
};

export type MasterSignalInstructionRow = {
  id: string;
  licenseId: string;
  currentStatus: string;
  symbol: string;
  side: string;
  purpose: string;
  source: string | null;
  createdAt: Date;
  executions: Array<{
    id: string;
    status: string;
    brokerTicket: string | null;
    executedAt: Date | null;
  }>;
};

export type MasterSignalAdminDetails = {
  signal: {
    id: string;
    masterSignalId: string;
    source: string;
    symbol: string;
    side: string;
    orderType: string;
    purpose: string;
    profileSlug: string | null;
    status: string;
    receivedAt: Date;
    validatedAt: Date | null;
    dispatchedAt: Date | null;
    expiresAt: Date | null;
    rejectedAt: Date | null;
    failedAt: Date | null;
    rejectedReason: string | null;
    createdAt: Date;
    updatedAt: Date;
    rawPayloadRedacted: Record<string, unknown> | null;
    dispatchCount: number;
    instructionCount: number;
  };
  dispatches: MasterSignalDispatchRow[];
  instructions: MasterSignalInstructionRow[];
};

export async function getMasterSignalDetailsForAdmin(
  masterSignalKey: string
): Promise<MasterSignalAdminDetails | null> {
  const row = await findMasterSignalByKey(masterSignalKey);
  if (!row) return null;

  const dispatches = await prisma.masterSignalDispatch.findMany({
    where: { masterSignalId: row.id },
    orderBy: { createdAt: "asc" },
    include: {
      license: {
        select: {
          id: true,
          user: { select: { email: true } },
          mt5Account: { select: { login: true, server: true } },
          exposureProfile: { select: { slug: true } },
        },
      },
      instruction: {
        select: {
          id: true,
          licenseId: true,
          currentStatus: true,
          symbol: true,
          side: true,
          purpose: true,
          source: true,
          createdAt: true,
          executions: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              status: true,
              brokerTicket: true,
              executedAt: true,
            },
          },
        },
      },
    },
  });

  const dispatchRows: MasterSignalDispatchRow[] = dispatches.map((d) => ({
    id: d.id,
    licenseId: d.licenseId,
    status: d.status,
    reason: d.reason,
    instructionId: d.instructionId,
    createdAt: d.createdAt,
    license: {
      id: d.license.id,
      clientEmail: d.license.user.email,
      mt5Label: d.license.mt5Account
        ? `${d.license.mt5Account.login}@${d.license.mt5Account.server}`
        : null,
      exposureProfileSlug: d.license.exposureProfile?.slug ?? null,
    },
  }));

  const instructionMap = new Map<string, MasterSignalInstructionRow>();
  for (const d of dispatches) {
    if (!d.instruction) continue;
    instructionMap.set(d.instruction.id, {
      id: d.instruction.id,
      licenseId: d.instruction.licenseId,
      currentStatus: d.instruction.currentStatus,
      symbol: d.instruction.symbol,
      side: d.instruction.side,
      purpose: d.instruction.purpose,
      source: d.instruction.source,
      createdAt: d.instruction.createdAt,
      executions: d.instruction.executions,
    });
  }

  const instructionCount = dispatches.filter((d) => d.instructionId != null).length;

  return {
    signal: {
      id: row.id,
      masterSignalId: row.masterSignalId,
      source: row.source,
      symbol: row.symbol,
      side: row.side,
      orderType: row.orderType,
      purpose: row.purpose,
      profileSlug: row.profileSlug,
      status: row.status,
      receivedAt: row.receivedAt,
      validatedAt: row.validatedAt,
      dispatchedAt: row.dispatchedAt,
      expiresAt: row.expiresAt,
      rejectedAt: row.rejectedAt,
      failedAt: row.failedAt,
      rejectedReason: row.rejectedReason,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      rawPayloadRedacted: sanitizeRawPayloadForAdmin(row.rawPayloadRedacted),
      dispatchCount: dispatches.length,
      instructionCount,
    },
    dispatches: dispatchRows,
    instructions: [...instructionMap.values()],
  };
}

export type MasterSignalDispatchPreview = {
  masterSignalId: string;
  status: string;
  eligibleCount: number;
  candidatesCount: number;
  eligible: Array<{
    licenseId: string;
    clientEmail: string;
    mt5Label: string | null;
    exposureProfileSlug: string | null;
  }>;
  skipped: Array<{ licenseId: string; code: string; reason: string }>;
};

export async function previewMasterSignalDispatch(
  masterSignalKey: string
): Promise<MasterSignalDispatchPreview | null> {
  const row = await findMasterSignalByKey(masterSignalKey);
  if (!row) return null;

  const selection = await selectEligibleLicensesForMasterSignal(row);

  const userIds = [...new Set(selection.eligible.map((l) => l.userId))];
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true },
        })
      : [];
  const emailByUserId = new Map(users.map((u) => [u.id, u.email]));

  return {
    masterSignalId: row.masterSignalId,
    status: row.status,
    eligibleCount: selection.eligible.length,
    candidatesCount: selection.candidatesCount,
    eligible: selection.eligible.map((license) => ({
      licenseId: license.id,
      clientEmail: emailByUserId.get(license.userId) ?? "—",
      mt5Label: license.mt5Account
        ? `${license.mt5Account.login}@${license.mt5Account.server}`
        : null,
      exposureProfileSlug: license.exposureProfile?.slug ?? null,
    })),
    skipped: selection.skipped,
  };
}

export type MasterSignalTrackingExecution = {
  id: string;
  status: string;
  brokerTicket: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  executedAt: Date | null;
  createdAt: Date;
};

export type MasterSignalTrackingInstruction = {
  id: string;
  source: string | null;
  currentStatus: string;
  symbol: string;
  side: string;
  orderType: string;
  purpose: string;
  quantity: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  executions: MasterSignalTrackingExecution[];
};

export type MasterSignalTrackingLicense = {
  licenseId: string;
  licenseStatus: string;
  clientEmail: string;
  clientName: string | null;
  planName: string | null;
  planSlug: string | null;
  exposureProfileSlug: string | null;
  mt5Label: string | null;
  lastDeviceId: string | null;
  lastDeviceSeenAt: Date | null;
  lastHeartbeatAt: Date | null;
  lastHeartbeatStatus: string | null;
};

export type MasterSignalTrackingRow = {
  dispatchId: string | null;
  dispatchStatus: MasterSignalDispatchStatus | null;
  dispatchReason: string | null;
  license: MasterSignalTrackingLicense;
  instruction: MasterSignalTrackingInstruction | null;
  executionStatus: string | null;
  hint: string | null;
  updatedAt: Date | null;
};

export type MasterSignalTrackingSkipped = {
  licenseId: string;
  code: string;
  reason: string;
};

export type MasterSignalTracking = {
  masterSignal: {
    id: string;
    masterSignalId: string;
    source: string;
    symbol: string;
    side: string;
    orderType: string;
    purpose: string;
    profileSlug: string | null;
    status: string;
    receivedAt: Date;
    validatedAt: Date | null;
    dispatchedAt: Date | null;
    expiresAt: Date | null;
    rejectedReason: string | null;
    rawPayloadRedacted: Record<string, unknown> | null;
  };
  summary: TrackingSummaryCounts;
  consolidatedStatus: ConsolidatedTrackingStatus;
  notDispatchedYet: boolean;
  rows: MasterSignalTrackingRow[];
  skipped: MasterSignalTrackingSkipped[];
};

function mapLicenseContext(license: DispatchTrackingRow["license"]): MasterSignalTrackingLicense {
  const device = license.devices[0];
  const heartbeat = license.eaHeartbeats[0];
  return {
    licenseId: license.id,
    licenseStatus: license.status,
    clientEmail: license.user.email,
    clientName: license.user.name,
    planName: license.subscription?.plan.name ?? null,
    planSlug: license.subscription?.plan.slug ?? null,
    exposureProfileSlug: license.exposureProfile?.slug ?? null,
    mt5Label: license.mt5Account
      ? `${license.mt5Account.login}@${license.mt5Account.server}`
      : null,
    lastDeviceId: device?.deviceId ?? heartbeat?.deviceId ?? null,
    lastDeviceSeenAt: device?.lastSeenAt ?? null,
    lastHeartbeatAt: heartbeat?.receivedAt ?? null,
    lastHeartbeatStatus: heartbeat?.eaStatus ?? null,
  };
}

function mapInstruction(
  instruction: NonNullable<DispatchTrackingRow["instruction"]>
): MasterSignalTrackingInstruction {
  return {
    id: instruction.id,
    source: instruction.source,
    currentStatus: instruction.currentStatus,
    symbol: instruction.symbol,
    side: instruction.side,
    orderType: instruction.orderType,
    purpose: instruction.purpose,
    quantity: decimalToNumber(instruction.quantity),
    expiresAt: instruction.expiresAt,
    createdAt: instruction.createdAt,
    updatedAt: instruction.updatedAt,
    executions: instruction.executions.map((e) => ({
      id: e.id,
      status: e.status,
      brokerTicket: e.brokerTicket,
      errorCode: e.errorCode,
      errorMessage: e.errorMessage,
      executedAt: e.executedAt,
      createdAt: e.createdAt,
    })),
  };
}

function mapDispatchToTrackingRow(d: DispatchTrackingRow): MasterSignalTrackingRow {
  const instruction = d.instruction ? mapInstruction(d.instruction) : null;
  const instructionLike = d.instruction
    ? {
        currentStatus: d.instruction.currentStatus,
        expiresAt: d.instruction.expiresAt,
        executions: d.instruction.executions,
      }
    : null;

  return {
    dispatchId: d.id,
    dispatchStatus: d.status,
    dispatchReason: d.reason,
    license: mapLicenseContext(d.license),
    instruction,
    executionStatus: resolveRowExecutionStatus(instructionLike),
    hint: resolveRowHint(d.status, instructionLike, d.reason),
    updatedAt:
      instruction?.updatedAt ??
      d.updatedAt,
  };
}

export async function getMasterSignalTrackingForAdmin(
  masterSignalKey: string
): Promise<MasterSignalTracking | null> {
  const row = await findMasterSignalByKey(masterSignalKey);
  if (!row) return null;

  const dispatches = await prisma.masterSignalDispatch.findMany({
    where: { masterSignalId: row.id },
    orderBy: { createdAt: "asc" },
    include: dispatchTrackingInclude,
  });

  let previewCandidates: number | null = null;
  let previewEligible = 0;
  let previewSkipped: MasterSignalTrackingSkipped[] = [];

  if (dispatches.length === 0) {
    const preview = await previewMasterSignalDispatch(masterSignalKey);
    if (preview) {
      previewCandidates = preview.candidatesCount;
      previewEligible = preview.eligibleCount;
      previewSkipped = preview.skipped;
    }
  }

  const summary = buildTrackingSummaryFromDispatches(dispatches, {
    candidatesCount: previewCandidates,
    eligiblePreviewCount: dispatches.length === 0 ? previewEligible : undefined,
  });

  const consolidatedStatus = deriveConsolidatedTrackingStatus({
    masterStatus: row.status,
    summary,
    expiresAt: row.expiresAt,
  });

  const skippedFromDispatches: MasterSignalTrackingSkipped[] = dispatches
    .filter((d) => d.status === MasterSignalDispatchStatus.SKIPPED)
    .map((d) => ({
      licenseId: d.licenseId,
      code: d.reason ?? "SKIPPED",
      reason: d.reason ?? "Ignorada no dispatch",
    }));

  const skipped =
    dispatches.length === 0
      ? previewSkipped
      : skippedFromDispatches.length > 0
        ? skippedFromDispatches
        : previewSkipped;

  return {
    masterSignal: {
      id: row.id,
      masterSignalId: row.masterSignalId,
      source: row.source,
      symbol: row.symbol,
      side: row.side,
      orderType: row.orderType,
      purpose: row.purpose,
      profileSlug: row.profileSlug,
      status: row.status,
      receivedAt: row.receivedAt,
      validatedAt: row.validatedAt,
      dispatchedAt: row.dispatchedAt,
      expiresAt: row.expiresAt,
      rejectedReason: row.rejectedReason,
      rawPayloadRedacted: sanitizeRawPayloadForAdmin(row.rawPayloadRedacted),
    },
    summary,
    consolidatedStatus,
    notDispatchedYet: dispatches.length === 0,
    rows: dispatches.map(mapDispatchToTrackingRow),
    skipped,
  };
}
