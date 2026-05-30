import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole, UserStatus } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    plan: { findUnique: vi.fn() },
    subscription: { create: vi.fn() },
    license: { updateMany: vi.fn() },
  },
}));

vi.mock("@/lib/admin/record-action", () => ({
  recordAdminAction: vi.fn(),
}));

vi.mock("@/lib/admin/commands", () => ({
  blockClient: vi.fn(),
}));

vi.mock("@/lib/licensing/service", () => ({
  activateSubscription: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  hash: vi.fn(async (pwd: string) => `bcrypt:${pwd}`),
}));

import prisma from "@/lib/prisma";
import { hash } from "bcryptjs";
import { recordAdminAction } from "@/lib/admin/record-action";
import { blockClient } from "@/lib/admin/commands";
import {
  blockAdminUser,
  createAdminUser,
  resetAdminUserPassword,
  USER_BLOCK_CONFIRM_PHRASE,
  USER_RESET_PASSWORD_CONFIRM_PHRASE,
} from "@/lib/admin/users";

describe("admin users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cria usuário com hash bcrypt sem expor na resposta", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      name: "Test",
      role: UserRole.CLIENT,
      status: UserStatus.ACTIVE,
    } as never);

    const result = await createAdminUser({
      actorId: "admin-1",
      email: "a@b.com",
      name: "Test",
      role: UserRole.CLIENT,
      generatePassword: true,
    });

    expect(hash).toHaveBeenCalled();
    expect(result.temporaryPassword).toBeTruthy();
    expect(JSON.stringify(result)).not.toContain("bcrypt:");
    expect(JSON.stringify(result)).not.toContain("passwordHash");
    expect(recordAdminAction).toHaveBeenCalled();
  });

  it("falha com e-mail duplicado", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "x" } as never);

    await expect(
      createAdminUser({
        actorId: "admin-1",
        email: "dup@test.com",
        name: "Dup",
        role: UserRole.CLIENT,
      })
    ).rejects.toMatchObject({ code: "EMAIL_ALREADY_EXISTS" });
  });

  it("bloqueia usuário com confirmação", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u-target",
      status: UserStatus.ACTIVE,
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    await blockAdminUser({
      userId: "u-target",
      actorId: "admin-1",
      adminConfirmation: USER_BLOCK_CONFIRM_PHRASE,
    });

    expect(blockClient).toHaveBeenCalled();
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.user_blocked" })
    );
  });

  it("não permite bloquear a si mesmo", async () => {
    await expect(
      blockAdminUser({
        userId: "admin-1",
        actorId: "admin-1",
        adminConfirmation: USER_BLOCK_CONFIRM_PHRASE,
      })
    ).rejects.toMatchObject({ code: "SELF_ACTION_FORBIDDEN" });
  });

  it("reset de senha retorna senha uma vez sem hash", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1",
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    const result = await resetAdminUserPassword({
      userId: "u1",
      actorId: "admin-1",
      adminConfirmation: USER_RESET_PASSWORD_CONFIRM_PHRASE,
      generatePassword: true,
    });

    expect(result.temporaryPassword).toBeTruthy();
    expect(JSON.stringify(result)).not.toContain("passwordHash");
    expect(recordAdminAction).toHaveBeenCalled();
  });
});
