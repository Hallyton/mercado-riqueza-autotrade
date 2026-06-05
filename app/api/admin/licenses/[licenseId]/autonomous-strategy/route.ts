import { NextResponse } from "next/server";
import {
  autonomousStrategyUpdateSchema,
  LicenseAutonomousStrategyError,
  linkRobotInstanceToLicenseAdmin,
  updateLicenseAutonomousStrategy,
} from "@/lib/admin/license-autonomous-strategy";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";

type RouteContext = { params: Promise<{ licenseId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const { licenseId } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = autonomousStrategyUpdateSchema.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Corpo inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await updateLicenseAutonomousStrategy({
      licenseId,
      strategyCode: parsed.data.strategy_code,
      autonomousStrategyEnabled: parsed.data.autonomous_strategy_enabled,
      adminConfirmation: parsed.data.admin_confirmation,
      actorId: authResult.session!.user!.id!,
      ipAddress: clientIp(request),
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof LicenseAutonomousStrategyError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status }
      );
    }
    return NextResponse.json(
      { error: "Falha ao atualizar estratégia autônoma" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const { licenseId } = await context.params;
  const json = (await request.json().catch(() => null)) as {
    robot_instance_id?: string;
    action?: string;
  } | null;

  if (json?.action !== "link_robot_instance" || !json.robot_instance_id) {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  try {
    const result = await linkRobotInstanceToLicenseAdmin({
      licenseId,
      robotInstanceId: json.robot_instance_id,
      actorId: authResult.session!.user!.id!,
      ipAddress: clientIp(request),
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof LicenseAutonomousStrategyError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status }
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao vincular robô" },
      { status: 500 }
    );
  }
}
