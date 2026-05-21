import { jsonError, jsonOk } from "@/lib/api/http";
import {
  AdminInstructionDispatchError,
  createAdminDispatchedInstruction,
  createAdminInstructionSchema,
} from "@/lib/admin/instruction-dispatch";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";

export async function POST(request: Request) {
  const authResult = await requireAdminApiSession({
    dispatchInstructions: true,
  });
  if ("error" in authResult && authResult.error) return authResult.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = createAdminInstructionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.message, 400, "VALIDATION_ERROR");
  }

  try {
    const result = await createAdminDispatchedInstruction({
      ...parsed.data,
      actorId: authResult.session!.user!.id!,
      ipAddress: clientIp(request),
    });
    return jsonOk({ ok: true, ...result });
  } catch (e) {
    if (e instanceof AdminInstructionDispatchError) {
      return jsonError(e.message, e.status, e.code);
    }
    console.error("[admin/instructions]", e);
    return jsonError("Falha ao criar instrução", 500);
  }
}
