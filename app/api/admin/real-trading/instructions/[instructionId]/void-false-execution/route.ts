import { jsonError, jsonOk } from "@/lib/api/http";
import {
  RealManualVoidFalseExecutionError,
  voidFalseExecutionSchema,
  voidRealManualFalseExecution,
} from "@/lib/admin/real-manual-void-false-execution";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";

type RouteContext = { params: Promise<{ instructionId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const { instructionId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = voidFalseExecutionSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return jsonError("Corpo inválido", 400, "VALIDATION_ERROR");
  }

  try {
    const result = await voidRealManualFalseExecution({
      instructionId,
      actorId: authResult.session!.user!.id!,
      ipAddress: clientIp(request),
      ...parsed.data,
    });
    return jsonOk(result);
  } catch (error) {
    if (error instanceof RealManualVoidFalseExecutionError) {
      return jsonError(error.message, error.status, error.code);
    }
    console.error("[admin/real-trading/instructions/void-false-execution]", error);
    return jsonError("Falha ao anular falso positivo", 500);
  }
}
