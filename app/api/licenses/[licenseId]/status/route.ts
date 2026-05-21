import { auth } from "@/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import {
  assertLicenseAccess,
  buildLicenseStatusResponse,
} from "@/lib/licensing/service";
import { isAdminRole } from "@/lib/auth/roles";

type Params = { params: Promise<{ licenseId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("Unauthorized", 401);
  }

  const { licenseId } = await params;
  const allowed = await assertLicenseAccess(
    licenseId,
    session.user.id,
    isAdminRole(session.user.role)
  );

  if (!allowed) {
    return jsonError("Forbidden", 403);
  }

  const status = await buildLicenseStatusResponse(licenseId);
  if (!status) {
    return jsonError("License not found", 404);
  }

  return jsonOk(status);
}
