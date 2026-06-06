import { randomUUID } from "node:crypto";
import {
  Prisma,
  RealTradingApprovalStatus,
  type RealTradingApproval,
} from "@prisma/client";
import { z } from "zod";
import { recordAdminAction } from "@/lib/admin/record-action";
import {
  MAX_CONTRACTS_TECHNICAL_LIMIT,
  REAL_TRADING_APPROVAL_LIMIT_EDIT_PHRASE,
} from "@/lib/admin/real-trading-approval-limit-constants";
import prisma from "@/lib/prisma";
import { maskAccountLogin, maskLicenseId } from "@/lib/risk/real-trading-guard-status";

export {
  MAX_CONTRACTS_TECHNICAL_LIMIT,
  REAL_TRADING_APPROVAL_LIMIT_EDIT_PHRASE,
} from "@/lib/admin/real-trading-approval-limit-constants";

export const APPROVAL_LIMIT_UPDATE_ERROR_CODES = [
  "APPROVAL_NOT_FOUND",
  "APPROVAL_NOT_EDITABLE",
  "MAX_CONTRACTS_INVALID",
  "MARGIN_MIN_INVALID",
  "MARGIN_BUFFER_INVALID",
  "ADMIN_CONFIRMATION_INVALID",
  "ADMIN_SESSION_REQUIRED",
  "ADMIN_PERMISSION_DENIED",
  "DATABASE_ERROR",
  "UNKNOWN_APPROVAL_UPDATE_ERROR",
] as const;

export type ApprovalLimitUpdateErrorCode =
  (typeof APPROVAL_LIMIT_UPDATE_ERROR_CODES)[number];

export const updateRealTradingApprovalLimitsSchema = z
  .object({
    max_contracts: z.number().int().min(1).max(MAX_CONTRACTS_TECHNICAL_LIMIT),
    min_free_margin: z.number().min(0),
    margin_buffer_percent: z.number().min(0).max(100),
    admin_notes: z.string().max(2000).optional(),
    admin_confirmation: z.literal(REAL_TRADING_APPROVAL_LIMIT_EDIT_PHRASE),
  })
  .strict();

export type UpdateRealTradingApprovalLimitsInput = z.infer<
  typeof updateRealTradingApprovalLimitsSchema
>;

export type ApprovalLimitSnapshot = {
  maxContracts: number;
  marginFreeMin: number;
  marginBufferPercent: number;
};

export class RealTradingApprovalLimitUpdateError extends Error {
  constructor(
    message: string,
    public readonly code: ApprovalLimitUpdateErrorCode,
    public readonly status: number,
    public readonly options: {
      requestId: string;
      detail?: string;
      fieldErrors?: Record<string, string>;
      actionHint?: string;
    }
  ) {
    super(message);
    this.name = "RealTradingApprovalLimitUpdateError";
  }

  toPayload() {
    return {
      ok: false as const,
      requestId: this.options.requestId,
      code: this.code,
      message: this.message,
      detail: this.options.detail,
      fieldErrors: this.options.fieldErrors,
      actionHint: this.options.actionHint,
    };
  }
}

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return Number(value.toString());
}

function isEditableApproval(approval: RealTradingApproval): boolean {
  return (
    approval.status === RealTradingApprovalStatus.APPROVED &&
    approval.allowReal === true &&
    approval.revokedAt == null
  );
}

function snapshotFromApproval(approval: RealTradingApproval): ApprovalLimitSnapshot {
  return {
    maxContracts: approval.maxContracts,
    marginFreeMin: decimalToNumber(approval.minFreeMargin),
    marginBufferPercent: decimalToNumber(approval.marginBufferPercent),
  };
}

function logLimitUpdateFailed(input: {
  requestId: string;
  code: ApprovalLimitUpdateErrorCode;
  approvalId: string;
}) {
  console.error("[real_trading.approval.limit_update_failed]", {
    requestId: input.requestId,
    code: input.code,
    approvalId: input.approvalId,
  });
}

export async function updateRealTradingApprovalLimits(
  approvalId: string,
  input: UpdateRealTradingApprovalLimitsInput & {
    actorId: string;
    ipAddress?: string | null;
    requestId?: string;
  }
): Promise<{
  approval: RealTradingApproval;
  requestId: string;
  previous: ApprovalLimitSnapshot;
  current: ApprovalLimitSnapshot;
}> {
  const requestId = input.requestId ?? randomUUID();

  const fail = async (
    error: RealTradingApprovalLimitUpdateError
  ): Promise<never> => {
    logLimitUpdateFailed({ requestId, code: error.code, approvalId });
    await recordAdminAction({
      actorId: input.actorId,
      action: "real_trading.approval.limit_update_failed",
      targetType: "real_trading_approval",
      targetId: approvalId,
      ipAddress: input.ipAddress,
      metadata: {
        requestId,
        approvalId,
        errorCode: error.code,
        actionHint: error.options.actionHint,
        timestamp: new Date().toISOString(),
      },
    });
    throw error;
  };

  const existing = await prisma.realTradingApproval.findUnique({
    where: { id: approvalId },
  });

  if (!existing) {
    return fail(
      new RealTradingApprovalLimitUpdateError(
        "Aprovação não encontrada.",
        "APPROVAL_NOT_FOUND",
        404,
        {
          requestId,
          actionHint: "Verifique o ID da aprovação ou volte à lista.",
        }
      )
    );
  }

  if (!isEditableApproval(existing)) {
    return fail(
      new RealTradingApprovalLimitUpdateError(
        "Aprovação não está em status editável.",
        "APPROVAL_NOT_EDITABLE",
        409,
        {
          requestId,
          detail: `Status: ${existing.status}, allowReal: ${existing.allowReal}`,
          actionHint:
            "Somente aprovações APPROVED ativas podem ter limite operacional editado.",
        }
      )
    );
  }

  if (
    input.max_contracts < 1 ||
    input.max_contracts > MAX_CONTRACTS_TECHNICAL_LIMIT
  ) {
    return fail(
      new RealTradingApprovalLimitUpdateError(
        "maxContracts inválido.",
        "MAX_CONTRACTS_INVALID",
        400,
        {
          requestId,
          fieldErrors: {
            max_contracts: `Informe entre 1 e ${MAX_CONTRACTS_TECHNICAL_LIMIT}.`,
          },
        }
      )
    );
  }

  if (input.min_free_margin < 0) {
    return fail(
      new RealTradingApprovalLimitUpdateError(
        "Margem livre mínima inválida.",
        "MARGIN_MIN_INVALID",
        400,
        {
          requestId,
          fieldErrors: { min_free_margin: "Deve ser >= 0." },
        }
      )
    );
  }

  if (input.margin_buffer_percent < 0 || input.margin_buffer_percent > 100) {
    return fail(
      new RealTradingApprovalLimitUpdateError(
        "Buffer de margem inválido.",
        "MARGIN_BUFFER_INVALID",
        400,
        {
          requestId,
          fieldErrors: { margin_buffer_percent: "Deve estar entre 0 e 100." },
        }
      )
    );
  }

  const previous = snapshotFromApproval(existing);

  try {
    const approval = await prisma.realTradingApproval.update({
      where: { id: approvalId },
      data: {
        maxContracts: input.max_contracts,
        minFreeMargin: input.min_free_margin,
        marginBufferPercent: input.margin_buffer_percent,
        notes:
          input.admin_notes !== undefined ? input.admin_notes : existing.notes,
      },
    });

    const current = snapshotFromApproval(approval);

    await recordAdminAction({
      actorId: input.actorId,
      action: "real_trading.approval.limit_updated",
      targetType: "real_trading_approval",
      targetId: approval.id,
      ipAddress: input.ipAddress,
      metadata: {
        requestId,
        approvalId: approval.id,
        licenseId: maskLicenseId(approval.licenseId),
        accountLogin: maskAccountLogin(approval.accountLogin),
        accountServer: approval.accountServer,
        symbol: approval.symbol,
        magicNumber: approval.magicNumber,
        previousMaxContracts: previous.maxContracts,
        newMaxContracts: current.maxContracts,
        previousMarginFreeMin: previous.marginFreeMin,
        newMarginFreeMin: current.marginFreeMin,
        previousMarginBufferPercent: previous.marginBufferPercent,
        newMarginBufferPercent: current.marginBufferPercent,
        adminNotes: input.admin_notes ? "[present]" : undefined,
        timestamp: new Date().toISOString(),
      },
    });

    return { approval, requestId, previous, current };
  } catch (error) {
    return fail(
      new RealTradingApprovalLimitUpdateError(
        "Erro ao persistir alteração de limite operacional.",
        "DATABASE_ERROR",
        500,
        {
          requestId,
          detail: error instanceof Error ? error.message : "Erro desconhecido",
          actionHint: "Tente novamente e informe o requestId ao suporte.",
        }
      )
    );
  }
}

export function mapApprovalLimitUpdateZodError(
  error: z.ZodError,
  requestId: string
): RealTradingApprovalLimitUpdateError {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    fieldErrors[issue.path.join(".") || "body"] = issue.message;
  }

  let code: ApprovalLimitUpdateErrorCode = "UNKNOWN_APPROVAL_UPDATE_ERROR";
  if (fieldErrors.admin_confirmation) {
    code = "ADMIN_CONFIRMATION_INVALID";
  } else if (fieldErrors.max_contracts) {
    code = "MAX_CONTRACTS_INVALID";
  } else if (fieldErrors.min_free_margin) {
    code = "MARGIN_MIN_INVALID";
  } else if (fieldErrors.margin_buffer_percent) {
    code = "MARGIN_BUFFER_INVALID";
  }

  return new RealTradingApprovalLimitUpdateError(
    "Payload inválido para atualização de limite.",
    code,
    400,
    {
      requestId,
      detail: error.message,
      fieldErrors,
      actionHint:
        code === "ADMIN_CONFIRMATION_INVALID"
          ? `Digite exatamente: ${REAL_TRADING_APPROVAL_LIMIT_EDIT_PHRASE}`
          : "Corrija os campos indicados.",
    }
  );
}

export function isRealTradingApprovalLimitPatchBody(
  body: unknown
): body is Record<string, unknown> {
  if (!body || typeof body !== "object") return false;
  const record = body as Record<string, unknown>;
  if ("action" in record && typeof record.action === "string") {
    return false;
  }
  return "max_contracts" in record || "admin_confirmation" in record;
}
