import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrderLogStatus } from "@prisma/client";

const {
  licenseUpdate,
  instructionFindMany,
  instructionUpdate,
  statusLogCreate,
  transaction,
  recordAdminAction,
  syncLicenseFlags,
} = vi.hoisted(() => ({
  licenseUpdate: vi.fn(),
  instructionFindMany: vi.fn(),
  instructionUpdate: vi.fn(),
  statusLogCreate: vi.fn(),
  transaction: vi.fn(),
  recordAdminAction: vi.fn(),
  syncLicenseFlags: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    license: { update: licenseUpdate },
    instruction: {
      findMany: instructionFindMany,
      update: instructionUpdate,
    },
    instructionStatusLog: { create: statusLogCreate },
    $transaction: transaction,
  },
}));

vi.mock("@/lib/admin/record-action", () => ({
  recordAdminAction,
}));

vi.mock("@/lib/licensing/service", () => ({
  syncLicenseFlags,
  syncLicensesForSubscription: vi.fn(),
}));

import {
  emergencyCancelPendingOrders,
  pauseLicenseNewEntries,
} from "@/lib/admin/commands";

describe("rollback operacional admin commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    licenseUpdate.mockResolvedValue({
      id: "lic-1",
      haltNewEntries: true,
    });
    instructionFindMany.mockResolvedValue([]);
    transaction.mockImplementation(async (ops) => Promise.all(ops));
    recordAdminAction.mockResolvedValue({ id: "act-1" });
  });

  it("pause-entries pausa novas entradas e registra trilha sem apagar histórico", async () => {
    const license = await pauseLicenseNewEntries({
      licenseId: "lic-1",
      actorId: "admin-1",
      pause: true,
      reason: "rollback_controlado",
    });

    expect(license.id).toBe("lic-1");
    expect(licenseUpdate).toHaveBeenCalledWith({
      where: { id: "lic-1" },
      data: {
        adminHaltNewEntries: true,
        haltNewEntries: true,
      },
    });
    expect(syncLicenseFlags).not.toHaveBeenCalled();
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.pause_new_entries",
        targetType: "license",
        targetId: "lic-1",
        metadata: {
          pause: true,
          reason: "rollback_controlado",
        },
      })
    );
    expect(instructionUpdate).not.toHaveBeenCalled();
    expect(statusLogCreate).not.toHaveBeenCalled();
  });

  it("emergency cancel cancela pendentes preservando InstructionStatusLog e audit trail", async () => {
    instructionFindMany.mockResolvedValue([
      { id: "inst-received", currentStatus: OrderLogStatus.RECEIVED },
      { id: "inst-sent", currentStatus: OrderLogStatus.SENT },
    ]);

    const result = await emergencyCancelPendingOrders({
      licenseId: "lic-1",
      actorId: "admin-1",
      reason: "rollback_emergencial",
    });

    expect(result.cancelledCount).toBe(2);
    expect(instructionFindMany).toHaveBeenCalledWith({
      where: {
        currentStatus: {
          in: [OrderLogStatus.RECEIVED, OrderLogStatus.SENT],
        },
        licenseId: "lic-1",
      },
      take: 200,
    });
    expect(instructionUpdate).toHaveBeenCalledTimes(2);
    expect(instructionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inst-received" },
        data: { currentStatus: OrderLogStatus.CANCELLED },
      })
    );
    expect(statusLogCreate).toHaveBeenCalledTimes(2);
    expect(statusLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          instructionId: "inst-received",
          status: OrderLogStatus.CANCELLED,
          message: "rollback_emergencial",
        }),
      })
    );
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.emergency_cancel_orders",
        targetType: "license",
        targetId: "lic-1",
        metadata: {
          reason: "rollback_emergencial",
          cancelledCount: 2,
        },
      })
    );
  });
});
