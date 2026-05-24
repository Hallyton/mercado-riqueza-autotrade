import {
  InstructionOrderType,
  InstructionPurpose,
  InstructionSide,
} from "@prisma/client";

export const MASTER_SIGNAL_SOURCE_VALUES = [
  "MASTER_EA",
  "ADMIN_TEST",
  "SIMULATOR",
] as const;

export type MasterSignalSource = (typeof MASTER_SIGNAL_SOURCE_VALUES)[number];

export const FORBIDDEN_MASTER_SIGNAL_KEYS = [
  "stop_strategy",
  "internal_filter",
  "entry_rule",
  "indicator_params",
  "secret",
  "token",
  "strategy",
  "strategy_config",
] as const;

export const MIN_MASTER_SIGNAL_EXPIRES_SECONDS = 5;
export const MAX_MASTER_SIGNAL_EXPIRES_SECONDS = 300;

export type MasterSignalValidatedInput = {
  master_signal_id: string;
  source: MasterSignalSource;
  symbol: string;
  side: InstructionSide;
  order_type: InstructionOrderType;
  purpose: InstructionPurpose;
  profile?: string;
  expires_in_seconds?: number;
  idempotency_key: string;
};

export type MasterSignalNormalizedPayload = {
  masterSignalId: string;
  source: MasterSignalSource;
  symbol: string;
  side: InstructionSide;
  orderType: InstructionOrderType;
  purpose: InstructionPurpose;
  profileSlug: string | null;
  expiresInSeconds: number | null;
  expiresAt: string | null;
  idempotencyKey: string;
  rawPayloadRedacted: Record<string, unknown>;
};
