import { jsonError, jsonOk } from "@/lib/api/http";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";
import {
  bulkPreviewSchema,
  previewRealManualBulkDispatch,
  RealManualBulkDispatchError,
} from "@/lib/admin/real-manual-bulk-dispatch";

export async function POST(request: Request) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const body = await request.json().catch(() => null);
  const parsed = bulkPreviewSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return jsonError("Corpo inválido", 400, "VALIDATION_ERROR");
  }

  try {
    const result = await previewRealManualBulkDispatch({
      actorId: authResult.session!.user!.id!,
      body: parsed.data,
      ipAddress: clientIp(request),
    });
    return jsonOk(result);
  } catch (error) {
    if (error instanceof RealManualBulkDispatchError) {
      return jsonError(error.message, error.status, error.code);
    }
    console.error("[admin/real-trading/bulk-dispatch/preview]", error);
    return jsonError("Falha ao validar elegibilidade em lote", 500);
  }
}
