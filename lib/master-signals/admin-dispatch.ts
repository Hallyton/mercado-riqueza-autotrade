import {
  dispatchValidatedMasterSignal,
  MasterSignalDispatchError,
} from "@/lib/master-signals/dispatch";
import { recordAdminAction } from "@/lib/admin/record-action";

export type AdminMasterSignalDispatchInput = {
  masterSignalKey: string;
  actorId: string;
  ipAddress?: string;
};

export async function dispatchMasterSignalFromAdmin(
  input: AdminMasterSignalDispatchInput
) {
  const result = await dispatchValidatedMasterSignal(input.masterSignalKey);

  await recordAdminAction({
    actorId: input.actorId,
    action: "MASTER_SIGNAL_DISPATCH",
    targetType: "master_signal",
    targetId: result.masterSignalId,
    ipAddress: input.ipAddress ?? null,
    metadata: {
      status: result.status,
      instructionsCreated: result.instructionsCreated,
      skipped: result.skipped,
      failed: result.failed,
      idempotent: result.idempotent,
      candidatesCount: result.candidatesCount ?? null,
      noEligibleLicenses: result.noEligibleLicenses ?? false,
    },
  });

  return result;
}

export function mapMasterSignalDispatchError(
  error: unknown
): { message: string; code: string; status: number } {
  if (error instanceof MasterSignalDispatchError) {
    const status =
      error.code === "MASTER_SIGNAL_NOT_FOUND"
        ? 404
        : error.code === "MASTER_SIGNAL_EXPIRED" ||
            error.code === "MASTER_SIGNAL_NOT_DISPATCHABLE" ||
            error.code === "MASTER_SIGNAL_DISPATCH_IN_PROGRESS"
          ? 409
          : 400;
    return { message: error.message, code: error.code, status };
  }
  return {
    message: "Falha ao disparar sinal mestre",
    code: "MASTER_SIGNAL_DISPATCH_FAILED",
    status: 500,
  };
}
