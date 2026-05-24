import { MasterSignalDispatchStatus, type MasterSignal } from "@prisma/client";
import { selectEligibleLicensesForMasterSignal } from "@/lib/master-signals/eligibility";
import { redactMasterSignalPayload } from "@/lib/master-signals/service";
import prisma from "@/lib/prisma";

const SENSITIVE_PAYLOAD_KEYS = ["secret", "token", "password", "authorization"];

function findMasterSignalByKey(masterSignalKey: string) {
  return (
    prisma.masterSignal.findUnique({
      where: { masterSignalId: masterSignalKey },
    }) ??
    prisma.masterSignal.findUnique({
      where: { id: masterSignalKey },
    })
  );
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
};

export async function listMasterSignalsForAdmin(
  limit = 100
): Promise<MasterSignalListItem[]> {
  const rows = await prisma.masterSignal.findMany({
    orderBy: { receivedAt: "desc" },
    take: limit,
    include: {
      dispatches: {
        select: { instructionId: true },
      },
    },
  });

  return rows.map((row) => ({
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
    dispatchCount: row.dispatches.length,
    instructionCount: row.dispatches.filter((d) => d.instructionId != null).length,
  }));
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
