import { auth } from "@/auth";
import { NextResponse } from "next/server";
import {
  canDispatchAdminInstructions,
  canRunEmergencyActions,
  canRunStandardAdminActions,
} from "@/lib/admin/permissions";
import { isAdminRole } from "@/lib/auth/roles";

export async function requireAdminApiSession(options?: {
  emergency?: boolean;
  dispatchInstructions?: boolean;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const role = session.user.role ?? "";
  if (!isAdminRole(role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  if (options?.emergency && !canRunEmergencyActions(role)) {
    return {
      error: NextResponse.json(
        { error: "Permissão insuficiente para emergência" },
        { status: 403 }
      ),
    };
  }

  if (options?.dispatchInstructions) {
    if (!canDispatchAdminInstructions(role)) {
      return {
        error: NextResponse.json(
          { error: "Permissão insuficiente para despachar instruções" },
          { status: 403 }
        ),
      };
    }
    return { session, role };
  }

  if (!options?.emergency && !canRunStandardAdminActions(role)) {
    return {
      error: NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 }),
    };
  }

  return { session, role };
}

export function clientIp(request: Request): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim();
  return request.headers.get("x-real-ip") ?? undefined;
}
