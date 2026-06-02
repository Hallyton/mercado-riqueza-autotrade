import { NextResponse } from "next/server";
import { jsonError, jsonOk } from "@/lib/api/http";
import { findRealManualInstructionByPreflightId } from "@/lib/admin/real-trading-instructions";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";
import {
  createFirstRealManualInstruction,
  createRealManualDispatchSchema,
  RealManualDispatchError,
} from "@/lib/admin/real-manual-dispatch";

export async function POST(request: Request) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const body = await request.json().catch(() => null);
  const parsed = createRealManualDispatchSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return jsonError("Corpo inválido", 400, "VALIDATION_ERROR");
  }

  try {
    const result = await createFirstRealManualInstruction({
      actorId: authResult.session!.user!.id!,
      ipAddress: clientIp(request),
      ...parsed.data,
    });
    return jsonOk(result);
  } catch (error) {
    if (error instanceof RealManualDispatchError) {
      if (error.code === "REAL_MANUAL_ALREADY_DISPATCHED") {
        const existing = await findRealManualInstructionByPreflightId(
          parsed.success ? parsed.data.preflightId : ""
        );
        return NextResponse.json(
          {
            error: error.message,
            code: error.code,
            existingInstructionId: existing?.id ?? null,
            existingStatus: existing?.currentStatus ?? null,
          },
          { status: error.status }
        );
      }
      return jsonError(error.message, error.status, error.code);
    }
    console.error("[admin/real-trading/dispatch-manual]", error);
    return jsonError("Falha ao criar instruction real manual", 500);
  }
}
