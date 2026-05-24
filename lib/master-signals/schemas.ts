import { InstructionOrderType, InstructionPurpose, InstructionSide } from "@prisma/client";
import { z } from "zod";
import {
  FORBIDDEN_MASTER_SIGNAL_KEYS,
  MASTER_SIGNAL_SOURCE_VALUES,
  MAX_MASTER_SIGNAL_EXPIRES_SECONDS,
  MIN_MASTER_SIGNAL_EXPIRES_SECONDS,
} from "@/lib/master-signals/types";

function normalizeOptionalProfile(value: unknown): unknown {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeTrimmedRequiredString(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return value.trim();
}

function collectForbiddenKeys(input: unknown, path: string[] = []): string[] {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return [];
  }

  const obj = input as Record<string, unknown>;
  const found: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (FORBIDDEN_MASTER_SIGNAL_KEYS.includes(key as (typeof FORBIDDEN_MASTER_SIGNAL_KEYS)[number])) {
      found.push([...path, key].join("."));
    }
    found.push(...collectForbiddenKeys(value, [...path, key]));
  }
  return found;
}

export const masterSignalInputSchema = z
  .object({
    master_signal_id: z.preprocess(normalizeTrimmedRequiredString, z.string().min(1)),
    source: z.enum(MASTER_SIGNAL_SOURCE_VALUES),
    symbol: z.preprocess(normalizeTrimmedRequiredString, z.string().min(1).max(32)),
    side: z.nativeEnum(InstructionSide),
    order_type: z.nativeEnum(InstructionOrderType),
    purpose: z.nativeEnum(InstructionPurpose),
    profile: z.preprocess(normalizeOptionalProfile, z.string().min(1)).optional(),
    expires_in_seconds: z
      .number()
      .int()
      .min(MIN_MASTER_SIGNAL_EXPIRES_SECONDS)
      .max(MAX_MASTER_SIGNAL_EXPIRES_SECONDS)
      .optional(),
    idempotency_key: z.preprocess(normalizeTrimmedRequiredString, z.string().min(1)),
  })
  .passthrough()
  .superRefine((obj, ctx) => {
    const forbidden = collectForbiddenKeys(obj);
    if (forbidden.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Payload contém campos sensíveis/proibidos: ${forbidden.join(", ")}`,
      });
    }
  });

export type MasterSignalInput = z.infer<typeof masterSignalInputSchema>;
