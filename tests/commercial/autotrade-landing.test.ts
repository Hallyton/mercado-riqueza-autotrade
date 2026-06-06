import { describe, expect, it } from "vitest";
import {
  AUTOTRADE_LANDING_LINKS,
  AUTOTRADE_LANDING_PATH,
  buildAutotradeWhatsAppEvaluationUrl,
  resolveAutotradeWhatsAppDigits,
} from "@/lib/commercial/autotrade-landing";

describe("autotrade landing", () => {
  it("expõe rotas públicas reais do projeto", () => {
    expect(AUTOTRADE_LANDING_PATH).toBe("/autotrade");
    expect(AUTOTRADE_LANDING_LINKS.cadastro).toBe("/cadastro");
    expect(AUTOTRADE_LANDING_LINKS.termos).toBe("/termos/autotrade");
  });

  it("monta URL de WhatsApp quando configurado", () => {
    process.env.NEXT_PUBLIC_AUTOTRADE_WHATSAPP_NUMBER = "+55 11 98765-4321";
    expect(resolveAutotradeWhatsAppDigits()).toBe("5511987654321");
    expect(buildAutotradeWhatsAppEvaluationUrl()).toContain("wa.me/5511987654321");
    delete process.env.NEXT_PUBLIC_AUTOTRADE_WHATSAPP_NUMBER;
  });

  it("não monta WhatsApp sem número configurado", () => {
    delete process.env.NEXT_PUBLIC_AUTOTRADE_WHATSAPP_NUMBER;
    expect(buildAutotradeWhatsAppEvaluationUrl()).toBeNull();
  });
});
