import { AuditActorType, LicenseStatus } from "@prisma/client";
import { createAuditLog } from "@/lib/audit/log";
import prisma from "@/lib/prisma";
import { normalizeEmail } from "./_utils";

const HOMOLOG_LICENSE_STATUSES: LicenseStatus[] = [
  LicenseStatus.ACTIVE,
  LicenseStatus.PENDING_ACTIVATION,
  LicenseStatus.SUSPENDED,
];

export async function findHomologClientLicense(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
    include: {
      licenses: {
        where: { status: { in: HOMOLOG_LICENSE_STATUSES } },
        orderBy: { updatedAt: "desc" },
        take: 1,
        include: { subscription: true },
      },
    },
  });

  if (!user) {
    console.error(`[homologation] Cliente não encontrado: ${email}`);
    process.exit(1);
  }

  const license = user.licenses[0];
  if (!license) {
    console.error(
      `[homologation] Nenhuma licença ativa/pendente/suspensa para ${email}`
    );
    process.exit(1);
  }

  return { user, license };
}

export async function updateHomologLicenseFlags(
  licenseId: string,
  data: {
    haltNewEntries?: boolean;
    haltAllTrading?: boolean;
    adminHaltNewEntries?: boolean;
  },
  auditAction: string
) {
  const updated = await prisma.license.update({
    where: { id: licenseId },
    data,
  });

  await createAuditLog({
    actorType: AuditActorType.SYSTEM,
    action: auditAction,
    entityType: "license",
    entityId: licenseId,
    metadata: {
      homologation: true,
      haltNewEntries: updated.haltNewEntries,
      haltAllTrading: updated.haltAllTrading,
      adminHaltNewEntries: updated.adminHaltNewEntries,
    },
  });

  return updated;
}
