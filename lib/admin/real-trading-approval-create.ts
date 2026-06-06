import { randomUUID } from "node:crypto";
import {
  LicenseStatus,
  RealTradingApprovalStatus,
  type RealTradingApproval,
  Prisma,
} from "@prisma/client";
import { z } from "zod";
import { recordAdminAction } from "@/lib/admin/record-action";
import prisma from "@/lib/prisma";
import { magicNumberRange } from "@/lib/risk/real-trading-config";
import { maskAccountLogin, maskLicenseId } from "@/lib/risk/real-trading-guard-status";
import {
  createRealTradingApprovalSchema,
  type CreateRealTradingApprovalInput,
  REAL_TRADING_APPROVAL_CONFIRM_PHRASE,
} from "@/lib/admin/real-trading-approval";

export const APPROVAL_CREATE_ERROR_CODES = [
  "APPROVAL_ALREADY_EXISTS",
  "ACTIVE_APPROVAL_CONFLICT",
  "LICENSE_NOT_FOUND",
  "LICENSE_NOT_ACTIVE",
  "MT5_ACCOUNT_NOT_LINKED",
  "ACCOUNT_LOGIN_MISMATCH",
  "ACCOUNT_SERVER_MISMATCH",
  "SYMBOL_REQUIRED",
  "MAGIC_NUMBER_INVALID",
  "MAX_CONTRACTS_INVALID",
  "MARGIN_MIN_INVALID",
  "MARGIN_BUFFER_INVALID",
  "ADMIN_CONFIRMATION_INVALID",
  "ADMIN_SESSION_REQUIRED",
  "ADMIN_PERMISSION_DENIED",
  "DATABASE_UNIQUE_CONSTRAINT",
  "DATABASE_ERROR",
  "VALIDATION_ERROR",
  "UNKNOWN_APPROVAL_CREATE_ERROR",
] as const;

export type ApprovalCreateErrorCode = (typeof APPROVAL_CREATE_ERROR_CODES)[number];

export type ApprovalCreateErrorPayload = {
  ok: false;
  requestId: string;
  code: ApprovalCreateErrorCode;
  message: string;
  detail?: string;
  fieldErrors?: Record<string, string>;
  actionHint?: string;
  existingApprovalId?: string;
  links?: {
    existingApproval?: string;
    approvalsList?: string;
    license?: string;
  };
  submittedPayload?: Record<string, unknown>;
};

export type ApprovalCreateSuccessPayload = {
  ok: true;
  requestId: string;
  approvalId: string;
  status: string;
  links?: {
    approval?: string;
  };
};

export class RealTradingApprovalCreateError extends Error {
  constructor(
    message: string,
    public readonly code: ApprovalCreateErrorCode,
    public readonly status: number,
    public readonly options: {
      requestId: string;
      detail?: string;
      fieldErrors?: Record<string, string>;
      actionHint?: string;
      existingApprovalId?: string;
      links?: ApprovalCreateErrorPayload["links"];
      submittedPayload?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.name = "RealTradingApprovalCreateError";
  }

  toPayload(): ApprovalCreateErrorPayload {
    return {
      ok: false,
      requestId: this.options.requestId,
      code: this.code,
      message: this.message,
      detail: this.options.detail,
      fieldErrors: this.options.fieldErrors,
      actionHint: this.options.actionHint,
      existingApprovalId: this.options.existingApprovalId,
      links: this.options.links,
      submittedPayload: this.options.submittedPayload,
    };
  }
}

function normalizeLogin(value: string): string {
  return value.trim();
}

function normalizeServer(value: string): string {
  return value.trim();
}

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

function isActiveApproval(row: Pick<RealTradingApproval, "status" | "allowReal" | "revokedAt">) {
  return (
    row.status === RealTradingApprovalStatus.APPROVED &&
    row.allowReal === true &&
    row.revokedAt == null
  );
}

function redactSubmittedPayload(input: CreateRealTradingApprovalInput): Record<string, unknown> {
  return {
    user_id: input.user_id,
    license_id: maskLicenseId(input.license_id),
    account_login: maskAccountLogin(input.account_login),
    account_server: input.account_server.trim(),
    symbol: normalizeSymbol(input.symbol),
    magic_number: input.magic_number,
    max_contracts: input.max_contracts,
    min_free_margin: input.min_free_margin,
    margin_buffer_percent: input.margin_buffer_percent,
    notes: input.notes ? "[present]" : undefined,
    admin_confirmation: "[REDACTED]",
  };
}

function existingApprovalLinks(approvalId: string, licenseId: string) {
  return {
    existingApproval: `/admin/real-trading/approvals/${approvalId}`,
    approvalsList: `/admin/real-trading/approvals?licenseId=${licenseId}`,
    license: `/admin/licenses/${licenseId}`,
  };
}

async function recordApprovalCreateFailed(input: {
  actorId: string;
  requestId: string;
  ipAddress?: string | null;
  payload: CreateRealTradingApprovalInput;
  code: ApprovalCreateErrorCode;
  actionHint?: string;
  existingApprovalId?: string;
}) {
  await recordAdminAction({
    actorId: input.actorId,
    action: "real_trading.approval.create_failed",
    targetType: "real_trading_approval",
    targetId: input.existingApprovalId ?? null,
    ipAddress: input.ipAddress,
    metadata: {
      requestId: input.requestId,
      licenseId: maskLicenseId(input.payload.license_id),
      accountLoginMasked: maskAccountLogin(input.payload.account_login),
      accountServer: input.payload.account_server.trim(),
      symbol: normalizeSymbol(input.payload.symbol),
      magicNumber: input.payload.magic_number,
      maxContracts: input.payload.max_contracts,
      errorCode: input.code,
      actionHint: input.actionHint,
      timestamp: new Date().toISOString(),
    },
  });
}

function logApprovalCreateFailed(input: {
  requestId: string;
  code: ApprovalCreateErrorCode;
  licenseId: string;
  symbol: string;
  magicNumber: number;
}) {
  console.error("[real_trading.approval.create_failed]", {
    requestId: input.requestId,
    code: input.code,
    licenseId: maskLicenseId(input.licenseId),
    symbol: input.symbol,
    magicNumber: input.magicNumber,
  });
}

export function mapApprovalCreateZodError(
  error: z.ZodError,
  requestId: string,
  body: unknown
): RealTradingApprovalCreateError {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "body";
    fieldErrors[key] = issue.message;
  }

  let code: ApprovalCreateErrorCode = "VALIDATION_ERROR";
  let actionHint = "Corrija os campos indicados e tente novamente.";

  if (fieldErrors.admin_confirmation) {
    code = "ADMIN_CONFIRMATION_INVALID";
    actionHint = `Digite exatamente: ${REAL_TRADING_APPROVAL_CONFIRM_PHRASE}`;
  } else if (fieldErrors.max_contracts) {
    code = "MAX_CONTRACTS_INVALID";
  } else if (fieldErrors.min_free_margin) {
    code = "MARGIN_MIN_INVALID";
  } else if (fieldErrors.margin_buffer_percent) {
    code = "MARGIN_BUFFER_INVALID";
  } else if (fieldErrors.magic_number) {
    code = "MAGIC_NUMBER_INVALID";
  } else if (fieldErrors.symbol) {
    code = "SYMBOL_REQUIRED";
  }

  return new RealTradingApprovalCreateError(
    "Payload inválido para criação de aprovação.",
    code,
    400,
    {
      requestId,
      detail: error.message,
      fieldErrors,
      actionHint,
      submittedPayload:
        body &&
        typeof body === "object" &&
        "license_id" in body &&
        typeof (body as CreateRealTradingApprovalInput).license_id === "string"
          ? redactSubmittedPayload(body as CreateRealTradingApprovalInput)
          : undefined,
    }
  );
}

export function mapPrismaApprovalCreateError(
  error: unknown,
  requestId: string,
  input: CreateRealTradingApprovalInput,
  existingApprovalId?: string
): RealTradingApprovalCreateError {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new RealTradingApprovalCreateError(
      "Já existe uma aprovação para esta licença/conta/símbolo/magic.",
      "DATABASE_UNIQUE_CONSTRAINT",
      409,
      {
        requestId,
        detail: "Restrição única do banco: licenseId + accountLogin + accountServer + symbol + magicNumber.",
        actionHint:
          "Abra a aprovação existente e ajuste maxContracts, ou revogue a anterior antes de criar outra.",
        existingApprovalId,
        links: existingApprovalId
          ? existingApprovalLinks(existingApprovalId, input.license_id)
          : {
              approvalsList: `/admin/real-trading/approvals?licenseId=${input.license_id}`,
            },
        submittedPayload: redactSubmittedPayload(input),
      }
    );
  }

  return new RealTradingApprovalCreateError(
    "Erro interno ao persistir aprovação.",
    "DATABASE_ERROR",
    500,
    {
      requestId,
      detail: error instanceof Error ? error.message : "Erro desconhecido",
      actionHint: "Tente novamente. Se persistir, informe o requestId ao suporte técnico.",
      submittedPayload: redactSubmittedPayload(input),
    }
  );
}

async function findExistingApprovalRecord(input: {
  licenseId: string;
  accountLogin: string;
  accountServer: string;
  symbol: string;
  magicNumber: number;
}) {
  return prisma.realTradingApproval.findUnique({
    where: {
      licenseId_accountLogin_accountServer_symbol_magicNumber: {
        licenseId: input.licenseId,
        accountLogin: normalizeLogin(input.accountLogin),
        accountServer: normalizeServer(input.accountServer),
        symbol: normalizeSymbol(input.symbol),
        magicNumber: input.magicNumber,
      },
    },
  });
}

export async function createRealTradingApprovalTraced(
  input: CreateRealTradingApprovalInput & {
    actorId: string;
    ipAddress?: string | null;
    requestId?: string;
  }
): Promise<{ approval: RealTradingApproval; requestId: string }> {
  const requestId = input.requestId ?? randomUUID();
  const submittedPayload = redactSubmittedPayload(input);

  const fail = async (error: RealTradingApprovalCreateError): Promise<never> => {
    logApprovalCreateFailed({
      requestId,
      code: error.code,
      licenseId: input.license_id,
      symbol: input.symbol,
      magicNumber: input.magic_number,
    });
    await recordApprovalCreateFailed({
      actorId: input.actorId,
      requestId,
      ipAddress: input.ipAddress,
      payload: input,
      code: error.code,
      actionHint: error.options.actionHint,
      existingApprovalId: error.options.existingApprovalId,
    });
    throw error;
  };

  const range = magicNumberRange();
  if (input.magic_number < range.min || input.magic_number > range.max) {
    return fail(
      new RealTradingApprovalCreateError(
        `MagicNumber fora da faixa permitida (${range.min}-${range.max}).`,
        "MAGIC_NUMBER_INVALID",
        400,
        {
          requestId,
          fieldErrors: { magic_number: `Use um valor entre ${range.min} e ${range.max}.` },
          actionHint: "Informe um MagicNumber dentro da faixa operacional do produto.",
          submittedPayload,
        }
      )
    );
  }

  const license = await prisma.license.findUnique({
    where: { id: input.license_id },
    select: {
      id: true,
      userId: true,
      status: true,
      mt5Account: { select: { login: true, server: true } },
    },
  });

  if (!license || license.userId !== input.user_id) {
    return fail(
      new RealTradingApprovalCreateError(
        "Licença não encontrada para o usuário selecionado.",
        "LICENSE_NOT_FOUND",
        404,
        {
          requestId,
          actionHint: "Verifique se a licença selecionada pertence ao cliente correto.",
          submittedPayload,
        }
      )
    );
  }

  if (license.status !== LicenseStatus.ACTIVE) {
    return fail(
      new RealTradingApprovalCreateError(
        "Licença não está ativa.",
        "LICENSE_NOT_ACTIVE",
        409,
        {
          requestId,
          detail: `Status atual: ${license.status}`,
          actionHint: "Regularize a licença antes de criar aprovação REAL.",
          links: { license: `/admin/licenses/${license.id}` },
          submittedPayload,
        }
      )
    );
  }

  const login = normalizeLogin(input.account_login);
  const server = normalizeServer(input.account_server);
  const symbol = normalizeSymbol(input.symbol);

  if (!symbol) {
    return fail(
      new RealTradingApprovalCreateError(
        "Símbolo é obrigatório.",
        "SYMBOL_REQUIRED",
        400,
        {
          requestId,
          fieldErrors: { symbol: "Informe o símbolo operacional." },
          submittedPayload,
        }
      )
    );
  }

  const mt5 = license.mt5Account;
  if (!mt5) {
    return fail(
      new RealTradingApprovalCreateError(
        "Conta MT5 não vinculada à licença.",
        "MT5_ACCOUNT_NOT_LINKED",
        409,
        {
          requestId,
          actionHint: "Vincule a conta MT5 na licença antes de aprovar REAL.",
          links: { license: `/admin/licenses/${license.id}` },
          submittedPayload,
        }
      )
    );
  }

  if (mt5.login !== login) {
    return fail(
      new RealTradingApprovalCreateError(
        "Login MT5 informado não confere com a conta vinculada à licença.",
        "ACCOUNT_LOGIN_MISMATCH",
        409,
        {
          requestId,
          detail: `Licença vinculada: ${maskAccountLogin(mt5.login)}`,
          actionHint: "Use o login MT5 cadastrado na licença ou atualize o vínculo.",
          links: { license: `/admin/licenses/${license.id}` },
          submittedPayload,
        }
      )
    );
  }

  if (mt5.server.trim() !== server) {
    return fail(
      new RealTradingApprovalCreateError(
        "Servidor MT5 informado não confere com a conta vinculada à licença.",
        "ACCOUNT_SERVER_MISMATCH",
        409,
        {
          requestId,
          detail: `Servidor vinculado: ${mt5.server.trim()}`,
          actionHint: "Use o servidor MT5 cadastrado na licença ou atualize o vínculo.",
          links: { license: `/admin/licenses/${license.id}` },
          submittedPayload,
        }
      )
    );
  }

  const existing = await findExistingApprovalRecord({
    licenseId: input.license_id,
    accountLogin: login,
    accountServer: server,
    symbol,
    magicNumber: input.magic_number,
  });

  if (existing) {
    const links = existingApprovalLinks(existing.id, input.license_id);
    if (
      isActiveApproval(existing) &&
      existing.maxContracts !== input.max_contracts
    ) {
      return fail(
        new RealTradingApprovalCreateError(
          "Esta licença já possui aprovação ativa com limite diferente.",
          "ACTIVE_APPROVAL_CONFLICT",
          409,
          {
            requestId,
            detail: `Aprovação existente: maxContracts=${existing.maxContracts}. Solicitado: ${input.max_contracts}.`,
            actionHint:
              "Edite a aprovação existente para maxContracts desejado ou revogue a aprovação anterior.",
            existingApprovalId: existing.id,
            links,
            submittedPayload,
          }
        )
      );
    }

    return fail(
      new RealTradingApprovalCreateError(
        "Já existe uma aprovação para esta licença/conta/símbolo/magic.",
        "APPROVAL_ALREADY_EXISTS",
        409,
        {
          requestId,
          detail: `Status existente: ${existing.status}. maxContracts=${existing.maxContracts}.`,
          actionHint:
            "Abra a aprovação existente e ajuste maxContracts, ou revogue a anterior antes de criar outra.",
          existingApprovalId: existing.id,
          links,
          submittedPayload,
        }
      )
    );
  }

  try {
    const approval = await prisma.realTradingApproval.create({
      data: {
        userId: input.user_id,
        licenseId: input.license_id,
        accountLogin: login,
        accountServer: server,
        symbol,
        magicNumber: input.magic_number,
        maxContracts: input.max_contracts,
        minFreeMargin: input.min_free_margin,
        marginBufferPercent: input.margin_buffer_percent,
        allowReal: true,
        status: RealTradingApprovalStatus.APPROVED,
        approvedByAdminId: input.actorId,
        approvedAt: new Date(),
        notes: input.notes,
      },
    });

    await recordAdminAction({
      actorId: input.actorId,
      action: "real_trading.approval.created",
      targetType: "real_trading_approval",
      targetId: approval.id,
      ipAddress: input.ipAddress,
      metadata: {
        requestId,
        approvalId: approval.id,
        licenseId: maskLicenseId(input.license_id),
        maxContracts: input.max_contracts,
        magicNumber: input.magic_number,
        symbol,
        timestamp: new Date().toISOString(),
      },
    });

    return { approval, requestId };
  } catch (error) {
    const mapped = mapPrismaApprovalCreateError(error, requestId, input);
    return fail(mapped);
  }
}

export { createRealTradingApprovalSchema };
