import { describe, expect, it } from "vitest";
import {
  LicenseStatus,
  SubscriptionStatus,
} from "@prisma/client";
import {
  canAcceptNewEntries,
  canManageOpenPositions,
} from "@/lib/licensing/flags";

describe("Licença ativa", () => {
  it("permite novas entradas com assinatura e licença ativas", () => {
    const input = {
      licenseStatus: LicenseStatus.ACTIVE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      haltNewEntries: false,
      haltAllTrading: false,
    };
    expect(canAcceptNewEntries(input)).toBe(true);
    expect(canManageOpenPositions(input)).toBe(true);
  });
});

describe("Licença vencida / inadimplente", () => {
  it("bloqueia novas entradas mas mantém gestão de posição", () => {
    const input = {
      licenseStatus: LicenseStatus.SUSPENDED,
      subscriptionStatus: SubscriptionStatus.PAST_DUE,
      haltNewEntries: true,
      haltAllTrading: false,
    };
    expect(canAcceptNewEntries(input)).toBe(false);
    expect(canManageOpenPositions(input)).toBe(true);
  });

  it("bloqueia tudo com halt total", () => {
    const input = {
      licenseStatus: LicenseStatus.ACTIVE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      haltNewEntries: false,
      haltAllTrading: true,
    };
    expect(canAcceptNewEntries(input)).toBe(false);
    expect(canManageOpenPositions(input)).toBe(false);
  });
});
