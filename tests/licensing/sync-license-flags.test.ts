import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  AuditActorType,
  LicenseStatus,
  SubscriptionStatus,
} from "@prisma/client";

const { findUnique, update, auditCreate } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    license: { findUniqueOrThrow: findUnique, update },
  },
}));

vi.mock("@/lib/audit/log", () => ({
  createAuditLog: auditCreate,
}));

import { syncLicenseFlags } from "@/lib/licensing/service";

describe("syncLicenseFlags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mantém halt_new_entries com pausa manual do admin e assinatura ativa", async () => {
    const license = {
      id: "lic_1",
      status: LicenseStatus.ACTIVE,
      haltNewEntries: true,
      adminHaltNewEntries: true,
      haltAllTrading: false,
      subscription: { status: SubscriptionStatus.ACTIVE },
    };
    findUnique.mockResolvedValue(license);

    const result = await syncLicenseFlags("lic_1", { reason: "webhook_test" });

    expect(update).not.toHaveBeenCalled();
    expect(result).toBe(license);
  });

  it("não reabre entradas quando admin pausou e sync roda com política liberada", async () => {
    findUnique.mockResolvedValue({
      id: "lic_1",
      status: LicenseStatus.ACTIVE,
      haltNewEntries: true,
      adminHaltNewEntries: true,
      haltAllTrading: false,
      subscription: { status: SubscriptionStatus.ACTIVE },
    });
    update.mockImplementation(({ data }) => ({
      id: "lic_1",
      haltNewEntries: data.haltNewEntries,
      adminHaltNewEntries: true,
    }));

    await syncLicenseFlags("lic_1");

    expect(update).not.toHaveBeenCalled();
  });

  it("aplica bloqueio por inadimplência mesmo sem pausa admin", async () => {
    findUnique.mockResolvedValue({
      id: "lic_1",
      status: LicenseStatus.SUSPENDED,
      haltNewEntries: false,
      adminHaltNewEntries: false,
      haltAllTrading: false,
      subscription: { status: SubscriptionStatus.PAST_DUE },
    });
    update.mockResolvedValue({
      id: "lic_1",
      haltNewEntries: true,
      adminHaltNewEntries: false,
    });

    await syncLicenseFlags("lic_1", {
      actorType: AuditActorType.SYSTEM,
      reason: "subscription_past_due",
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: "lic_1" },
      data: { haltNewEntries: true },
    });
  });

  it("libera entradas após retomada admin com assinatura ativa", async () => {
    findUnique.mockResolvedValue({
      id: "lic_1",
      status: LicenseStatus.ACTIVE,
      haltNewEntries: true,
      adminHaltNewEntries: false,
      haltAllTrading: false,
      subscription: { status: SubscriptionStatus.ACTIVE },
    });
    update.mockResolvedValue({
      id: "lic_1",
      haltNewEntries: false,
      adminHaltNewEntries: false,
    });

    await syncLicenseFlags("lic_1");

    expect(update).toHaveBeenCalledWith({
      where: { id: "lic_1" },
      data: { haltNewEntries: false },
    });
  });
});
