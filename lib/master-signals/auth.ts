import { timingSafeEqual } from "crypto";

export type MasterSignalAuthResult =
  | { ok: true }
  | { ok: false; code: "MASTER_SECRET_NOT_CONFIGURED"; status: 503 }
  | { ok: false; code: "MASTER_AUTH_REQUIRED"; status: 401 }
  | { ok: false; code: "MASTER_AUTH_INVALID"; status: 401 };

function readBearerSecret(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;
  const value = match[1].trim();
  return value.length > 0 ? value : null;
}

function readHeaderSecret(request: Request): string | null {
  const value = request.headers.get("x-master-ea-secret")?.trim();
  return value && value.length > 0 ? value : null;
}

export function extractMasterSignalSecret(request: Request): string | null {
  return readBearerSecret(request) ?? readHeaderSecret(request);
}

function secretsMatch(expected: string, provided: string): boolean {
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

export function assertMasterSignalAuth(request: Request): MasterSignalAuthResult {
  const configured = process.env.MASTER_EA_API_SECRET?.trim();
  if (!configured) {
    return {
      ok: false,
      code: "MASTER_SECRET_NOT_CONFIGURED",
      status: 503,
    };
  }

  const provided = extractMasterSignalSecret(request);
  if (!provided) {
    return {
      ok: false,
      code: "MASTER_AUTH_REQUIRED",
      status: 401,
    };
  }

  if (!secretsMatch(configured, provided)) {
    return {
      ok: false,
      code: "MASTER_AUTH_INVALID",
      status: 401,
    };
  }

  return { ok: true };
}
