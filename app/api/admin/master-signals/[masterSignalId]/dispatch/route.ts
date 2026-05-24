import { jsonError, jsonOk } from "@/lib/api/http";
import {
  dispatchMasterSignalFromAdmin,
  mapMasterSignalDispatchError,
} from "@/lib/master-signals/admin-dispatch";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ masterSignalId: string }> }
) {
  const authResult = await requireAdminApiSession({
    dispatchInstructions: true,
  });
  if ("error" in authResult && authResult.error) return authResult.error;

  const { masterSignalId } = await params;

  try {
    const result = await dispatchMasterSignalFromAdmin({
      masterSignalKey: masterSignalId,
      actorId: authResult.session!.user!.id!,
      ipAddress: clientIp(request),
    });
    return jsonOk(result);
  } catch (e) {
    const mapped = mapMasterSignalDispatchError(e);
    if (mapped.status >= 500) {
      console.error("[admin/master-signals/dispatch]", e);
    }
    return jsonError(mapped.message, mapped.status, mapped.code);
  }
}
