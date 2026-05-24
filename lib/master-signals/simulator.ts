import {
  InstructionOrderType,
  InstructionPurpose,
  InstructionSide,
} from "@prisma/client";
import { masterSignalInputSchema } from "@/lib/master-signals/schemas";
import { redactMasterSignalPayload } from "@/lib/master-signals/service";
import {
  MASTER_SIGNAL_SOURCE_VALUES,
  MAX_MASTER_SIGNAL_EXPIRES_SECONDS,
  MIN_MASTER_SIGNAL_EXPIRES_SECONDS,
  type MasterSignalSource,
} from "@/lib/master-signals/types";

export const DEFAULT_SIMULATOR_SOURCE: MasterSignalSource = "MASTER_EA";
export const DEFAULT_SIMULATOR_EXPIRES_SECONDS = 300;

export type SimulatorCliInput = {
  id: string;
  symbol: string;
  side: InstructionSide;
  orderType: InstructionOrderType;
  purpose: InstructionPurpose;
  profile?: string;
  expiresInSeconds: number;
  source: MasterSignalSource;
  idempotencyKey: string;
  dryRun: boolean;
};

export type SimulatorEnvConfig = {
  apiUrl: string;
  secret: string;
  endpointUrl: string;
};

export type MasterSignalHttpResponse = {
  httpStatus: number;
  body: Record<string, unknown>;
  rawText: string;
};

export function defaultIdempotencyKey(masterSignalId: string): string {
  return `${masterSignalId}-key`;
}

export function buildMasterSignalRequestBody(input: SimulatorCliInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    master_signal_id: input.id,
    source: input.source,
    symbol: input.symbol,
    side: input.side,
    order_type: input.orderType,
    purpose: input.purpose,
    expires_in_seconds: input.expiresInSeconds,
    idempotency_key: input.idempotencyKey,
  };
  if (input.profile) body.profile = input.profile;
  return body;
}

export function validateSimulatorInput(input: SimulatorCliInput): { ok: true } | { ok: false; message: string } {
  const parsed = masterSignalInputSchema.safeParse(buildMasterSignalRequestBody(input));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.message };
  }
  return { ok: true };
}

export function resolveSimulatorEnv(
  env: NodeJS.ProcessEnv = process.env
): { ok: true; config: SimulatorEnvConfig } | { ok: false; message: string } {
  const apiUrlRaw = env.MASTER_SIGNAL_API_URL?.trim();
  const secret = env.MASTER_EA_API_SECRET?.trim();

  if (!apiUrlRaw) {
    return { ok: false, message: "MASTER_SIGNAL_API_URL é obrigatório." };
  }
  if (!secret) {
    return { ok: false, message: "MASTER_EA_API_SECRET é obrigatório." };
  }

  const apiUrl = apiUrlRaw.replace(/\/$/, "");
  return {
    ok: true,
    config: {
      apiUrl,
      secret,
      endpointUrl: `${apiUrl}/api/master/signals`,
    },
  };
}

export function parseExpiresArg(value: string): { ok: true; seconds: number } | { ok: false; message: string } {
  const n = Number(value);
  if (!Number.isInteger(n)) {
    return { ok: false, message: "expires deve ser um inteiro." };
  }
  if (n < MIN_MASTER_SIGNAL_EXPIRES_SECONDS || n > MAX_MASTER_SIGNAL_EXPIRES_SECONDS) {
    return {
      ok: false,
      message: `expires deve estar entre ${MIN_MASTER_SIGNAL_EXPIRES_SECONDS} e ${MAX_MASTER_SIGNAL_EXPIRES_SECONDS}.`,
    };
  }
  return { ok: true, seconds: n };
}

function parseEnumValue<T extends string>(
  value: string,
  allowed: readonly T[],
  label: string
): { ok: true; value: T } | { ok: false; message: string } {
  const normalized = value.trim().toUpperCase();
  if (!allowed.includes(normalized as T)) {
    return { ok: false, message: `${label} inválido: ${value}` };
  }
  return { ok: true, value: normalized as T };
}

export function parseSimulatorCliArgs(
  argv: string[]
): { ok: true; input: SimulatorCliInput } | { ok: false; message: string } {
  const args = argv.slice(2);
  const values = new Map<string, string>();
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (!arg.startsWith("--")) {
      return { ok: false, message: `Argumento desconhecido: ${arg}` };
    }
    const key = arg.slice(2);
    const next = args[i + 1];
    if (!next || next.startsWith("--")) {
      return { ok: false, message: `Valor ausente para --${key}` };
    }
    values.set(key, next);
    i++;
  }

  const id = values.get("id")?.trim();
  const symbol = values.get("symbol")?.trim();
  if (!id) return { ok: false, message: "--id é obrigatório." };
  if (!symbol) return { ok: false, message: "--symbol é obrigatório." };

  const sideRaw = values.get("side") ?? InstructionSide.BUY;
  const sideParsed = parseEnumValue(sideRaw, Object.values(InstructionSide), "side");
  if (!sideParsed.ok) return sideParsed;

  const orderTypeRaw = values.get("order-type") ?? InstructionOrderType.MARKET;
  const orderTypeParsed = parseEnumValue(
    orderTypeRaw,
    Object.values(InstructionOrderType),
    "order-type"
  );
  if (!orderTypeParsed.ok) return orderTypeParsed;

  const purposeRaw = values.get("purpose") ?? InstructionPurpose.ENTRY;
  const purposeParsed = parseEnumValue(
    purposeRaw,
    Object.values(InstructionPurpose),
    "purpose"
  );
  if (!purposeParsed.ok) return purposeParsed;

  const sourceRaw = values.get("source") ?? DEFAULT_SIMULATOR_SOURCE;
  const sourceParsed = parseEnumValue(sourceRaw, MASTER_SIGNAL_SOURCE_VALUES, "source");
  if (!sourceParsed.ok) return sourceParsed;

  const expiresRaw = values.get("expires") ?? String(DEFAULT_SIMULATOR_EXPIRES_SECONDS);
  const expiresParsed = parseExpiresArg(expiresRaw);
  if (!expiresParsed.ok) return expiresParsed;

  const profile = values.get("profile")?.trim();
  const idempotencyKey = values.get("idempotency-key")?.trim() ?? defaultIdempotencyKey(id);

  const input: SimulatorCliInput = {
    id,
    symbol,
    side: sideParsed.value,
    orderType: orderTypeParsed.value,
    purpose: purposeParsed.value,
    profile: profile && profile.length > 0 ? profile : undefined,
    expiresInSeconds: expiresParsed.seconds,
    source: sourceParsed.value,
    idempotencyKey,
    dryRun,
  };

  const validation = validateSimulatorInput(input);
  if (!validation.ok) return { ok: false, message: validation.message };

  return { ok: true, input };
}

export function formatDryRunOutput(
  config: SimulatorEnvConfig,
  payload: Record<string, unknown>
): string {
  const redacted = redactMasterSignalPayload(payload);
  return [
    "Modo dry-run — nenhuma requisição enviada.",
    `URL: ${config.endpointUrl}`,
    "Headers:",
    "  Content-Type: application/json",
    "  Authorization: Bearer ***REDACTED***",
    "Payload (redigido):",
    JSON.stringify(redacted, null, 2),
  ].join("\n");
}

export function describeMasterSignalHttpResult(result: MasterSignalHttpResponse): string {
  const { httpStatus, body } = result;
  const lines: string[] = [`HTTP ${httpStatus}`];

  if (httpStatus === 201) {
    lines.push("Resultado: sinal mestre criado (VALIDATED, dispatch NOT_STARTED).");
  } else if (httpStatus === 200 && body.idempotent === true) {
    lines.push("Resultado: retry idempotente — sinal já registrado.");
  } else if (httpStatus === 409) {
    lines.push("Resultado: conflito (MASTER_SIGNAL_CONFLICT).");
  } else if (httpStatus === 400) {
    lines.push("Resultado: validação rejeitada.");
  } else if (httpStatus === 401) {
    lines.push("Resultado: autenticação inválida ou ausente.");
  } else if (httpStatus === 503) {
    lines.push("Resultado: secret do EA Mãe não configurado no servidor.");
  } else {
    lines.push("Resultado: resposta inesperada — verifique o corpo JSON.");
  }

  lines.push("Corpo:", JSON.stringify(body, null, 2));
  return lines.join("\n");
}

export async function sendMasterSignalHttp(
  config: SimulatorEnvConfig,
  payload: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch
): Promise<MasterSignalHttpResponse> {
  const response = await fetchImpl(config.endpointUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.secret}`,
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  let body: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(rawText) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    } else {
      body = { raw: rawText };
    }
  } catch {
    body = { raw: rawText };
  }

  return { httpStatus: response.status, body, rawText };
}

export function isSimulatorSuccessStatus(httpStatus: number, body: Record<string, unknown>): boolean {
  return httpStatus === 201 || (httpStatus === 200 && body.idempotent === true);
}
