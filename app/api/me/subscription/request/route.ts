import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import {
  CommercialSubscriptionError,
  requestCommercialSubscription,
} from "@/lib/commercial/subscription-request";

const bodySchema = z.object({
  acceptTerms: z.literal(true),
  acceptRisk: z.literal(true),
  acceptNoReturnGuarantee: z.literal(true),
  acceptRealRequiresApproval: z.literal(true),
  acceptBlackBox: z.literal(true),
});

function clientIp(request: Request): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId || session?.user?.appRole !== "CLIENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json ?? {});

  if (!parsed.success) {
    return NextResponse.json({ error: "Aceite todos os termos." }, { status: 400 });
  }

  try {
    const result = await requestCommercialSubscription({
      userId,
      ...parsed.data,
      ipAddress: clientIp(request),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof CommercialSubscriptionError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status }
      );
    }
    return NextResponse.json(
      { error: "Falha ao solicitar assinatura." },
      { status: 500 }
    );
  }
}
