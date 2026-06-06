import { COMMERCIAL_TERMS_PATH } from "@/lib/commercial/public-terms";

export const AUTOTRADE_LANDING_PATH = "/autotrade";

export const AUTOTRADE_LANDING_METADATA = {
  title: "Mercado da Riqueza AutoTrade | MR Fibo D1 Guard",
  description:
    "Mercado da Riqueza AutoTrade: robô MR Fibo D1 Guard para Mini Dólar com gestão de risco, stop financeiro diário, centro de operações e acompanhamento pelo site.",
} as const;

export const AUTOTRADE_LANDING_OG_IMAGE = "/brand/mercado-da-riqueza-logo.png";

const WHATSAPP_EVALUATION_MESSAGE =
  "Tenho interesse na avaliação do MR Fibo D1 Guard";

/** Número internacional sem + (ex.: 5511999999999). Configure em NEXT_PUBLIC_AUTOTRADE_WHATSAPP_NUMBER */
export function resolveAutotradeWhatsAppDigits(): string | null {
  const raw = process.env.NEXT_PUBLIC_AUTOTRADE_WHATSAPP_NUMBER?.trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 10 ? digits : null;
}

export function buildAutotradeWhatsAppEvaluationUrl(): string | null {
  const digits = resolveAutotradeWhatsAppDigits();
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(WHATSAPP_EVALUATION_MESSAGE)}`;
}

export const AUTOTRADE_LANDING_LINKS = {
  cadastro: "/cadastro",
  planos: "/planos",
  login: "/login",
  termos: COMMERCIAL_TERMS_PATH,
} as const;
