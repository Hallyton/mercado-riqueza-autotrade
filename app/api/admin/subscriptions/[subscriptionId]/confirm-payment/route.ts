import { NextResponse } from "next/server";
import {
  CommercialAdminError,
  confirmSubscriptionPayment,
} from "@/lib/commercial/admin-subscription";
import { clientIp, requireAdminApiSession } from "@/lib/auth/admin-api";

type RouteContext = { params: Promise<{ subscriptionId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const { subscriptionId } = await context.params;

  try {
    const result = await confirmSubscriptionPayment(
      subscriptionId,
      authResult.session!.user!.id!,
      clientIp(request)
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof CommercialAdminError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status }
      );
    }
    return NextResponse.json(
      { error: "Falha ao confirmar pagamento." },
      { status: 500 }
    );
  }
}
