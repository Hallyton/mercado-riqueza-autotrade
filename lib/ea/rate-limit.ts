import { AuditActorType } from "@prisma/client";
import { createAuditLog } from "@/lib/audit/log";
import { readEaHeaders } from "@/lib/ea/auth";
import { problemJson } from "@/lib/ea/problem";
import { NextResponse } from "next/server";

/** Escopos com rate limit (rotas sensíveis EA). */
export type EaRateLimitScope = "activate" | "heartbeat" | "instructions" | "errors";

type RateLimitPolicy = {
  limit: number;
  windowMs: number;
};

const DEFAULT_POLICIES: Record<EaRateLimitScope, RateLimitPolicy> = {
  /** Anti brute-force de activation_code */
  activate: { limit: 10, windowMs: 15 * 60 * 1000 },
  /** ~3/min (EA padrão 30s) com margem */
  heartbeat: { limit: 180, windowMs: 60 * 60 * 1000 },
  instructions: { limit: 240, windowMs: 60 * 60 * 1000 },
  errors: { limit: 60, windowMs: 60 * 60 * 1000 },
};

type WindowEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, WindowEntry>();

function policyFor(scope: EaRateLimitScope): RateLimitPolicy {
  const envKey = `EA_RATE_LIMIT_${scope.toUpperCase()}_MAX`;
  const envMax = process.env[envKey];
  const base = DEFAULT_POLICIES[scope];
  if (envMax) {
    const parsed = Number(envMax);
    if (Number.isFinite(parsed) && parsed > 0) {
      return { ...base, limit: Math.floor(parsed) };
    }
  }
  return base;
}

export function resolveClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() ?? "unknown";
}

export function buildEaRateLimitKey(
  scope: EaRateLimitScope,
  request: Request
): string {
  const ip = resolveClientIp(request);
  if (scope === "activate") {
    return `ea:${scope}:ip:${ip}`;
  }
  const deviceId = readEaHeaders(request).deviceId ?? "none";
  return `ea:${scope}:ip:${ip}:device:${deviceId}`;
}

export type EaRateLimitCheckResult = {
  allowed: boolean;
  scope: EaRateLimitScope;
  key: string;
  limit: number;
  retryAfterSec: number;
};

/**
 * Janela fixa em memória (MVP). Em deploy multi-instância o limite é por instância.
 */
export function checkEaRateLimit(
  request: Request,
  scope: EaRateLimitScope,
  now = Date.now()
): EaRateLimitCheckResult {
  const policy = policyFor(scope);
  const key = buildEaRateLimitKey(scope, request);
  let entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + policy.windowMs };
    store.set(key, entry);
  }

  if (entry.count >= policy.limit) {
    const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return {
      allowed: false,
      scope,
      key,
      limit: policy.limit,
      retryAfterSec,
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    scope,
    key,
    limit: policy.limit,
    retryAfterSec: 0,
  };
}

export function rateLimitProblemResponse(
  result: EaRateLimitCheckResult
): NextResponse {
  const detail =
    result.scope === "activate"
      ? `Muitas tentativas de ativação. Tente novamente em ${result.retryAfterSec}s.`
      : `Limite de requisições excedido para ${result.scope}. Tente novamente em ${result.retryAfterSec}s.`;

  const response = problemJson(
    429,
    "RATE_LIMIT_EXCEEDED",
    "Limite de requisições excedido",
    detail
  );

  response.headers.set("Retry-After", String(result.retryAfterSec));
  return response;
}

export async function recordEaRateLimitBlocked(
  request: Request,
  result: EaRateLimitCheckResult
): Promise<void> {
  const headers = readEaHeaders(request);
  await createAuditLog({
    actorType: AuditActorType.SYSTEM,
    action: "ea.rate_limit_exceeded",
    entityType: "ea_rate_limit",
    entityId: result.scope,
    metadata: {
      scope: result.scope,
      key: result.key,
      limit: result.limit,
      retryAfterSec: result.retryAfterSec,
      deviceId: headers.deviceId,
    },
    ipAddress: resolveClientIp(request),
    requestId: headers.requestId,
  });
}

/** Apenas para testes — limpa contadores em memória. */
export function resetEaRateLimitStoreForTests(): void {
  store.clear();
}
