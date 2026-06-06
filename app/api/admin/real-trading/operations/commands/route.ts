import { NextResponse } from "next/server";
import { z } from "zod";
import { EAOperationalCommandType } from "@prisma/client";
import { getRealTradingOperationCenterView } from "@/lib/admin/real-trading-operation-center";
import {
  OperationalCommandError,
  createOperationalCommand,
} from "@/lib/operations/operational-command-service";
import { CRITICAL_OPERATIONAL_COMMANDS } from "@/lib/operations/operational-command-constants";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";

const createCommandSchema = z.object({
  licenseId: z.string().min(1),
  commandType: z.nativeEnum(EAOperationalCommandType),
  adminConfirmation: z.string().min(1),
  adminNote: z.string().max(500).optional(),
  allowOffline: z.boolean().optional(),
});

export async function GET() {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const view = await getRealTradingOperationCenterView();
  return NextResponse.json({ ok: true, ...view });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "INVALID_JSON", message: "JSON inválido" },
      { status: 400 }
    );
  }

  const parsed = createCommandSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Payload inválido.",
        detail: parsed.error.message,
      },
      { status: 400 }
    );
  }

  const authResult = await requireAdminApiSession({
    emergency: CRITICAL_OPERATIONAL_COMMANDS.has(parsed.data.commandType),
  });
  if ("error" in authResult && authResult.error) return authResult.error;

  try {
    const result = await createOperationalCommand({
      licenseId: parsed.data.licenseId,
      commandType: parsed.data.commandType,
      adminConfirmation: parsed.data.adminConfirmation,
      adminNote: parsed.data.adminNote,
      allowOffline: parsed.data.allowOffline,
      actorId: authResult.session!.user!.id!,
      ipAddress: clientIp(request),
    });

    return NextResponse.json({
      ok: true,
      command: {
        id: result.command.id,
        status: result.command.status,
        commandType: result.command.commandType,
        expiresAt: result.command.expiresAt.toISOString(),
      },
      eaOnline: result.eaOnline,
      warning: result.warning,
    });
  } catch (error) {
    if (error instanceof OperationalCommandError) {
      return NextResponse.json(error.toPayload(), { status: error.status });
    }
    console.error("[admin/real-trading/operations/commands]", error);
    return NextResponse.json(
      { ok: false, code: "UNKNOWN_ERROR", message: "Falha ao criar comando." },
      { status: 500 }
    );
  }
}
