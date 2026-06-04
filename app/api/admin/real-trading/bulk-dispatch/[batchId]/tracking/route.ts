import { jsonError, jsonOk } from "@/lib/api/http";
import { requireAdminApiSession } from "@/lib/auth/admin-api";
import { getBulkDispatchBatchLiveTracking } from "@/lib/admin/bulk-dispatch-live-tracking";

export async function GET(
  _request: Request,
  context: { params: Promise<{ batchId: string }> }
) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const { batchId } = await context.params;
  const tracking = await getBulkDispatchBatchLiveTracking(batchId);
  if (!tracking) {
    return jsonError("Batch não encontrado.", 404, "BATCH_NOT_FOUND");
  }
  return jsonOk(tracking);
}
