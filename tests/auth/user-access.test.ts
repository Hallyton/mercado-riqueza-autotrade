import { describe, expect, it } from "vitest";
import { UserStatus } from "@prisma/client";
import {
  canUserAuthenticate,
  userLoginBlockedReason,
} from "@/lib/auth/user-access";

describe("user access", () => {
  it("permite login quando ACTIVE com senha", () => {
    expect(
      canUserAuthenticate({
        status: UserStatus.ACTIVE,
        passwordHash: "hash",
      })
    ).toBe(true);
  });

  it("bloqueia usuário BLOCKED", () => {
    expect(
      canUserAuthenticate({
        status: UserStatus.BLOCKED,
        passwordHash: "hash",
      })
    ).toBe(false);
    expect(userLoginBlockedReason(UserStatus.BLOCKED)).toBe("USER_BLOCKED");
  });

  it("bloqueia usuário INACTIVE", () => {
    expect(
      canUserAuthenticate({
        status: UserStatus.INACTIVE,
        passwordHash: "hash",
      })
    ).toBe(false);
    expect(userLoginBlockedReason(UserStatus.INACTIVE)).toBe("USER_INACTIVE");
  });
});
