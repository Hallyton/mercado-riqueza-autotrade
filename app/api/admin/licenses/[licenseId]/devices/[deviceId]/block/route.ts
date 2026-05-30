import { NextResponse } from "next/server";
import {
  blockLicenseDevice,
  deviceActionConfirmationSchema,
  LicenseDeviceAdminError,
} from "@/lib/admin/license-devices";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";

type RouteContext = {
  params: Promise<{ licenseId: string; deviceId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const { licenseId, deviceId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = deviceActionConfirmationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    const device = await blockLicenseDevice({
      licenseId,
      deviceRecordId: deviceId,
      actorId: authResult.session!.user!.id!,
      adminConfirmation: parsed.data.admin_confirmation,
      ipAddress: clientIp(request),
    });
    return NextResponse.json({
      ok: true,
      device: {
        id: device.id,
        deviceId: device.deviceId,
        status: device.status,
        blockedAt: device.blockedAt?.toISOString() ?? null,
      },
    });
  } catch (e) {
    if (e instanceof LicenseDeviceAdminError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status }
      );
    }
    console.error("[admin/licenses/devices/block]", e);
    return NextResponse.json({ error: "Falha ao bloquear device" }, { status: 500 });
  }
}
