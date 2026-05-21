import { createHash, randomBytes } from "crypto";

export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function generateActivationCodePlain(): string {
  return randomBytes(16).toString("hex").toUpperCase();
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
