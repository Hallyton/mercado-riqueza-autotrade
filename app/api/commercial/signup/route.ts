import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CommercialSignupError,
  commercialSignup,
} from "@/lib/commercial/signup";

const signupSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().max(30).optional(),
  password: z.string().min(8).max(128),
  passwordConfirm: z.string().min(8).max(128),
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
  const json = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(json ?? {});

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.password !== parsed.data.passwordConfirm) {
    return NextResponse.json(
      { error: "Senhas não conferem." },
      { status: 400 }
    );
  }

  try {
    const result = await commercialSignup({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      password: parsed.data.password,
      acceptTerms: parsed.data.acceptTerms,
      acceptRisk: parsed.data.acceptRisk,
      acceptNoReturnGuarantee: parsed.data.acceptNoReturnGuarantee,
      acceptRealRequiresApproval: parsed.data.acceptRealRequiresApproval,
      acceptBlackBox: parsed.data.acceptBlackBox,
      ipAddress: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e) {
    if (e instanceof CommercialSignupError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status }
      );
    }
    return NextResponse.json({ error: "Falha no cadastro." }, { status: 500 });
  }
}
