import { describe, expect, it, vi, beforeEach } from "vitest";

const { adminCreate, auditCreate } = vi.hoisted(() => ({
  adminCreate: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    adminAction: { create: adminCreate },
  },
}));

vi.mock("@/lib/audit/log", () => ({
  createAuditLog: auditCreate,
}));

import { recordAdminAction } from "@/lib/admin/record-action";

describe("recordAdminAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminCreate.mockResolvedValue({
      id: "act_1",
      actorId: "admin_1",
      action: "admin.test",
      targetType: "license",
      targetId: "lic_1",
      createdAt: new Date(),
    });
    auditCreate.mockResolvedValue({ id: "audit_1" });
  });

  it("writes admin_actions and audit_logs", async () => {
    await recordAdminAction({
      actorId: "admin_1",
      action: "admin.test",
      targetType: "license",
      targetId: "lic_1",
    });

    expect(adminCreate).toHaveBeenCalledOnce();
    expect(auditCreate).toHaveBeenCalledOnce();
    expect(auditCreate.mock.calls[0][0]).toMatchObject({
      action: "admin.test",
      entityType: "license",
      entityId: "lic_1",
    });
  });
});
