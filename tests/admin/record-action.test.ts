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

  it("redige metadata sensível em admin_actions e audit_logs", async () => {
    await recordAdminAction({
      actorId: "admin_1",
      action: "MASTER_SIGNAL_DISPATCH",
      targetType: "master_signal",
      targetId: "ms_1",
      metadata: {
        status: "DISPATCHED",
        bearerToken: "raw-bearer-token",
        note: "Authorization: Bearer raw-note-token",
        nested: {
          AUTH_SECRET: "raw-auth-secret",
          database_url: "postgres://raw-db-secret",
        },
      },
    });

    const adminPayload = adminCreate.mock.calls[0][0];
    const auditPayload = auditCreate.mock.calls[0][0];
    const combined = JSON.stringify({ adminPayload, auditPayload });

    expect(combined).not.toContain("raw-bearer-token");
    expect(combined).not.toContain("raw-note-token");
    expect(combined).not.toContain("raw-auth-secret");
    expect(combined).not.toContain("postgres://raw-db-secret");
    expect(adminPayload.data.metadata).toMatchObject({
      status: "DISPATCHED",
      bearerToken: "[REDACTED]",
      note: "[REDACTED]",
      nested: {
        AUTH_SECRET: "[REDACTED]",
        database_url: "[REDACTED]",
      },
    });
    expect(auditPayload.metadata).toMatchObject({
      adminActionId: "act_1",
      status: "DISPATCHED",
      bearerToken: "[REDACTED]",
    });
  });
});
