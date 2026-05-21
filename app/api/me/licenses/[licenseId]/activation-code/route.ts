import { auth } from "@/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import {
  ClientLicenseError,
  issueActivationCodeForClient,
} from "@/lib/licensing/client-license";

type Params = { params: Promise<{ licenseId: string }> };

function clientIp(request: Request): string | undefined {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
}

export async function POST(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("Unauthorized", 401);
  }

  const { licenseId } = await params;

  try {
    const result = await issueActivationCodeForClient({
      userId: session.user.id,
      licenseId,
      ipAddress: clientIp(_request),
    });
    return jsonOk(result);
  } catch (e) {
    if (e instanceof ClientLicenseError) {
      return jsonError(e.message, e.status, e.code);
    }
    console.error("[me/licenses/activation-code]", e);
    return jsonError("Falha ao gerar código de ativação", 500);
  }
}
