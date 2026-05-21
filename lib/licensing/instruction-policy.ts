import { InstructionPurpose } from "@prisma/client";
import { canAcceptNewEntries, canManageOpenPositions } from "./flags";
import { getLicenseOperationalFlags } from "./service";

export class LicensePolicyError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "LicensePolicyError";
  }
}

/**
 * Valida se uma instrução pode ser criada/despachada (sem lógica de estratégia).
 */
export async function assertInstructionAllowed(
  licenseId: string,
  purpose: InstructionPurpose
): Promise<void> {
  const flags = await getLicenseOperationalFlags(licenseId);

  if (purpose === InstructionPurpose.ENTRY) {
    if (!flags.canAcceptNewEntries) {
      throw new LicensePolicyError(
        flags.displayMessage,
        "NEW_ENTRIES_BLOCKED"
      );
    }
    return;
  }

  if (
    purpose === InstructionPurpose.EXIT ||
    purpose === InstructionPurpose.ADJUSTMENT
  ) {
    if (!flags.canManageOpenPositions) {
      throw new LicensePolicyError(
        "Gestão de posição não permitida para esta licença.",
        "POSITION_MANAGEMENT_BLOCKED"
      );
    }
  }
}
