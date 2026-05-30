import { UserStatus } from "@prisma/client";

export type UserLoginCheck = {
  status: UserStatus;
  passwordHash: string | null;
};

/** Usuário sem credencial ou bloqueado/inativo não autentica. */
export function canUserAuthenticate(user: UserLoginCheck): boolean {
  if (!user.passwordHash) return false;
  if (user.status === UserStatus.BLOCKED) return false;
  if (user.status === UserStatus.INACTIVE) return false;
  return true;
}

export function userLoginBlockedReason(
  status: UserStatus
): "USER_BLOCKED" | "USER_INACTIVE" | null {
  if (status === UserStatus.BLOCKED) return "USER_BLOCKED";
  if (status === UserStatus.INACTIVE) return "USER_INACTIVE";
  return null;
}
