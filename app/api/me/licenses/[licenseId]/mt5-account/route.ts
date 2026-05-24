import { auth } from "@/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import {
  ClientLicenseError,
  updateMt5AccountForLicense,
} from "@/lib/licensing/client-license";
import { z } from "zod";

const linkMt5BodySchema = z.object({
  login: z
    .string()
    .min(1)
    .max(64)
    .regex(/^\d+$/, "Login MT5 deve conter apenas números."),
  server: z.string().trim().min(1).max(128),
  broker_name: z.string().max(128).optional(),
});

type Params = { params: Promise<{ licenseId: string }> };

function clientIp(request: Request): string | undefined {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
}

export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("Unauthorized", 401);
  }

  const { licenseId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = linkMt5BodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.message, 400, "VALIDATION_ERROR");
  }

  try {
    const result = await updateMt5AccountForLicense({
      userId: session.user.id,
      licenseId,
      login: parsed.data.login,
      server: parsed.data.server,
      brokerName: parsed.data.broker_name,
      ipAddress: clientIp(request),
    });
    return jsonOk(result);
  } catch (e) {
    if (e instanceof ClientLicenseError) {
      return jsonError(e.message, e.status, e.code);
    }
    console.error("[me/licenses/mt5-account]", e);
    return jsonError("Falha ao atualizar conta MT5", 500);
  }
}
