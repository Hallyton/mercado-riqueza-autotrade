import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ExecutionStatus,
  InstructionPurpose,
  InstructionSide,
  InstructionSource,
  LicenseStatus,
  MasterSignalDispatchStatus,
  MasterSignalSource,
  MasterSignalStatus,
  OrderLogStatus,
  SubscriptionStatus,
} from "@prisma/client";

const {
  masterFindMany,
  masterFindUnique,
  dispatchFindMany,
  licenseFindMany,
  licenseCount,
  heartbeatFindFirst,
  userFindMany,
  dispatchValidated,
  recordAdminAction,
  authMock,
  selectEligible,
} = vi.hoisted(() => ({
  masterFindMany: vi.fn(),
  masterFindUnique: vi.fn(),
  dispatchFindMany: vi.fn(),
  licenseFindMany: vi.fn(),
  licenseCount: vi.fn(),
  heartbeatFindFirst: vi.fn(),
  userFindMany: vi.fn(),
  dispatchValidated: vi.fn(),
  recordAdminAction: vi.fn(),
  authMock: vi.fn(),
  selectEligible: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    masterSignal: {
      findMany: masterFindMany,
      findUnique: masterFindUnique,
    },
    masterSignalDispatch: { findMany: dispatchFindMany },
    license: { findMany: licenseFindMany, count: licenseCount },
    eaHeartbeat: { findFirst: heartbeatFindFirst },
    user: { findMany: userFindMany },
  },
}));

vi.mock("@/lib/master-signals/dispatch", () => ({
  dispatchValidatedMasterSignal: dispatchValidated,
  MasterSignalDispatchError: class MasterSignalDispatchError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock("@/lib/admin/record-action", () => ({
  recordAdminAction,
}));

vi.mock("@/lib/master-signals/eligibility", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/master-signals/eligibility")>();
  return {
    ...actual,
    selectEligibleLicensesForMasterSignal: selectEligible,
  };
});

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import {
  deriveConsolidatedTrackingStatus,
  buildTrackingSummaryFromDispatches,
  formatDispatchSkipReason,
} from "@/lib/master-signals/admin-tracking";
import {
  getMasterSignalDetailsForAdmin,
  getMasterSignalTrackingForAdmin,
  listMasterSignalsForAdmin,
  previewMasterSignalDispatch,
  sanitizeRawPayloadForAdmin,
} from "@/lib/master-signals/admin";
import { dispatchMasterSignalFromAdmin } from "@/lib/master-signals/admin-dispatch";
import { redactMasterSignalPayload } from "@/lib/master-signals/service";
import { MASTER_SIGNAL_INSTRUCTION_SOURCE } from "@/lib/master-signals/instruction-source";
import { canDispatchMasterSignals } from "@/lib/admin/permissions";
import { requireAdminApiSession } from "@/lib/auth/admin-api";
import { isAdminRole } from "@/lib/auth/roles";
import { MasterSignalDispatchButton } from "@/components/admin/master-signal-dispatch-button";
import {
  REAL_TRADING_DISABLED_CODE,
  REAL_TRADING_DISABLED_REASON,
} from "@/lib/risk/real-trading-guard";

const baseSignal = {
  id: "row-1",
  masterSignalId: "ms-test-001",
  source: MasterSignalSource.MASTER_EA,
  symbol: "PETR4",
  side: InstructionSide.BUY,
  orderType: "MARKET" as const,
  purpose: InstructionPurpose.ENTRY,
  profileSlug: "conservador",
  status: MasterSignalStatus.VALIDATED,
  idempotencyKey: "idem-1",
  expiresAt: new Date(Date.now() + 3600_000),
  receivedAt: new Date(),
  validatedAt: new Date(),
  dispatchedAt: null,
  rejectedAt: null,
  failedAt: null,
  rejectedReason: null,
  rawPayloadRedacted: {
    master_signal_id: "ms-test-001",
    symbol: "PETR4",
    expires_in_seconds: 3600,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("listMasterSignalsForAdmin", () => {
  beforeEach(() => {
    masterFindMany.mockReset();
  });

  it("lista sinais com dispatchCount, instructionCount e executedCount", async () => {
    masterFindMany.mockResolvedValue([
      {
        ...baseSignal,
        status: MasterSignalStatus.DISPATCHED,
        dispatches: [
          {
            status: MasterSignalDispatchStatus.INSTRUCTION_CREATED,
            instruction: {
              currentStatus: OrderLogStatus.EXECUTED,
              expiresAt: new Date(Date.now() + 3600_000),
              executions: [{ status: ExecutionStatus.FILLED }],
            },
          },
          {
            status: MasterSignalDispatchStatus.SKIPPED,
            instruction: null,
          },
        ],
      },
    ]);

    const rows = await listMasterSignalsForAdmin();
    expect(rows).toHaveLength(1);
    expect(rows[0].masterSignalId).toBe("ms-test-001");
    expect(rows[0].dispatchCount).toBe(2);
    expect(rows[0].instructionCount).toBe(1);
    expect(rows[0].executedCount).toBe(1);
    expect(rows[0].consolidatedStatus).toBe("EXECUTED");
  });
});

describe("getMasterSignalTrackingForAdmin", () => {
  beforeEach(() => {
    masterFindUnique.mockReset();
    dispatchFindMany.mockReset();
    selectEligible.mockReset();
    userFindMany.mockReset();
  });

  it("retorna resumo vazio quando não há dispatch", async () => {
    masterFindUnique.mockResolvedValue(baseSignal);
    dispatchFindMany.mockResolvedValue([]);
    selectEligible.mockResolvedValue({
      candidatesCount: 3,
      eligible: [],
      skipped: [{ licenseId: "lic-x", code: "PROFILE_MISMATCH", reason: "Perfil" }],
    });

    const tracking = await getMasterSignalTrackingForAdmin("ms-test-001");
    expect(tracking).not.toBeNull();
    expect(tracking!.notDispatchedYet).toBe(true);
    expect(tracking!.summary.dispatchCount).toBe(0);
    expect(tracking!.summary.instructionCount).toBe(0);
    expect(tracking!.summary.skippedCount).toBe(0);
    expect(tracking!.skipped).toHaveLength(1);
    expect(tracking!.consolidatedStatus).toBe("NOT_DISPATCHED");
    expect(dispatchValidated).not.toHaveBeenCalled();
  });

  it("retorna executedCount quando há execution executada", async () => {
    masterFindUnique.mockResolvedValue({
      ...baseSignal,
      status: MasterSignalStatus.DISPATCHED,
    });
    dispatchFindMany.mockResolvedValue([
      {
        id: "disp-1",
        licenseId: "lic-1",
        status: MasterSignalDispatchStatus.INSTRUCTION_CREATED,
        reason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        license: {
          id: "lic-1",
          status: LicenseStatus.ACTIVE,
          user: { email: "c@test.com", name: "Cliente" },
          subscription: { plan: { name: "Start", slug: "start" } },
          mt5Account: { login: "1", server: "S" },
          exposureProfile: { slug: "conservador" },
          devices: [],
          eaHeartbeats: [],
        },
        instruction: {
          id: "inst-1",
          source: InstructionSource.MASTER_SIGNAL,
          currentStatus: OrderLogStatus.EXECUTED,
          symbol: "PETR4",
          side: InstructionSide.BUY,
          orderType: "MARKET",
          purpose: InstructionPurpose.ENTRY,
          quantity: 1,
          expiresAt: new Date(Date.now() + 3600_000),
          createdAt: new Date(),
          updatedAt: new Date(),
          executions: [
            {
              id: "ex-1",
              status: ExecutionStatus.FILLED,
              brokerTicket: "123",
              errorCode: null,
              errorMessage: null,
              executedAt: new Date(),
              createdAt: new Date(),
            },
          ],
        },
      },
    ]);

    const tracking = await getMasterSignalTrackingForAdmin("ms-test-001");
    expect(tracking!.summary.instructionCount).toBe(1);
    expect(tracking!.summary.executedCount).toBe(1);
    expect(tracking!.rows[0].instruction?.source).toBe(MASTER_SIGNAL_INSTRUCTION_SOURCE);
    expect(tracking!.rows[0].executionStatus).toBe("EXECUTED");
    expect(tracking!.consolidatedStatus).toBe("EXECUTED");
  });

  it("retorna pendingCount quando há instruction sem execution", async () => {
    masterFindUnique.mockResolvedValue({
      ...baseSignal,
      status: MasterSignalStatus.DISPATCHED,
    });
    dispatchFindMany.mockResolvedValue([
      {
        id: "disp-1",
        licenseId: "lic-1",
        status: MasterSignalDispatchStatus.INSTRUCTION_CREATED,
        reason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        license: {
          id: "lic-1",
          status: LicenseStatus.ACTIVE,
          user: { email: "c@test.com", name: null },
          subscription: null,
          mt5Account: null,
          exposureProfile: null,
          devices: [],
          eaHeartbeats: [],
        },
        instruction: {
          id: "inst-1",
          source: InstructionSource.MASTER_SIGNAL,
          currentStatus: OrderLogStatus.SENT,
          symbol: "PETR4",
          side: InstructionSide.BUY,
          orderType: "MARKET",
          purpose: InstructionPurpose.ENTRY,
          quantity: 1,
          expiresAt: new Date(Date.now() + 3600_000),
          createdAt: new Date(),
          updatedAt: new Date(),
          executions: [],
        },
      },
    ]);

    const tracking = await getMasterSignalTrackingForAdmin("ms-test-001");
    expect(tracking!.summary.pendingCount).toBe(1);
    expect(tracking!.rows[0].hint).toBe("Aguardando EA processar");
    expect(tracking!.consolidatedStatus).toBe("DISPATCHED_PENDING");
  });

  it("retorna FAILED e failedCount quando OrderSend é rejeitado", async () => {
    masterFindUnique.mockResolvedValue({
      ...baseSignal,
      status: MasterSignalStatus.DISPATCHED,
    });
    dispatchFindMany.mockResolvedValue([
      {
        id: "disp-failed",
        licenseId: "lic-1",
        status: MasterSignalDispatchStatus.INSTRUCTION_CREATED,
        reason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        license: {
          id: "lic-1",
          status: LicenseStatus.ACTIVE,
          user: { email: "c@test.com", name: null },
          subscription: null,
          mt5Account: null,
          exposureProfile: null,
          devices: [],
          eaHeartbeats: [],
        },
        instruction: {
          id: "inst-failed",
          source: InstructionSource.MASTER_SIGNAL,
          currentStatus: OrderLogStatus.REJECTED,
          symbol: "PETR4",
          side: InstructionSide.BUY,
          orderType: "MARKET",
          purpose: InstructionPurpose.ENTRY,
          quantity: 1,
          expiresAt: new Date(Date.now() + 3600_000),
          createdAt: new Date(),
          updatedAt: new Date(),
          executions: [
            {
              id: "ex-failed",
              status: ExecutionStatus.REJECTED,
              brokerTicket: null,
              errorCode: "BROKER_REJECT",
              errorMessage: "[REDACTED]",
              executedAt: new Date(),
              createdAt: new Date(),
            },
          ],
        },
      },
    ]);

    const tracking = await getMasterSignalTrackingForAdmin("ms-test-001");

    expect(tracking!.summary.failedCount).toBe(1);
    expect(tracking!.summary.executedCount).toBe(0);
    expect(tracking!.summary.pendingCount).toBe(0);
    expect(tracking!.rows[0].executionStatus).toBe("FAILED");
    expect(tracking!.rows[0].instruction?.executions[0].errorMessage).toBe("[REDACTED]");
    expect(tracking!.consolidatedStatus).toBe("FAILED");
  });

  it("retorna skipped/reason e não marca pendente quando não há elegíveis", async () => {
    masterFindUnique.mockResolvedValue({
      ...baseSignal,
      status: MasterSignalStatus.REJECTED,
      rejectedReason: "NO_ELIGIBLE_LICENSES",
    });
    dispatchFindMany.mockResolvedValue([
      {
        id: "disp-skip",
        licenseId: "lic-2",
        status: MasterSignalDispatchStatus.SKIPPED,
        reason: "PROFILE_MISMATCH",
        createdAt: new Date(),
        updatedAt: new Date(),
        license: {
          id: "lic-2",
          status: LicenseStatus.ACTIVE,
          user: { email: "x@test.com", name: null },
          subscription: null,
          mt5Account: null,
          exposureProfile: null,
          devices: [],
          eaHeartbeats: [],
        },
        instruction: null,
      },
    ]);

    const tracking = await getMasterSignalTrackingForAdmin("ms-test-001");
    expect(tracking!.summary.eligibleCount).toBe(0);
    expect(tracking!.summary.skippedCount).toBe(1);
    expect(tracking!.summary.instructionCount).toBe(0);
    expect(tracking!.summary.pendingCount).toBe(0);
    expect(tracking!.summary.executedCount).toBe(0);
    expect(tracking!.skipped[0].code).toBe("PROFILE_MISMATCH");
    expect(tracking!.rows[0].dispatchStatus).toBe(MasterSignalDispatchStatus.SKIPPED);
    expect(tracking!.rows[0].dispatchReason).toBe("PROFILE_MISMATCH");
    expect(tracking!.consolidatedStatus).toBe("REJECTED_NO_ELIGIBLE_LICENSES");
  });

  it("não expõe secrets no payload do tracking", async () => {
    masterFindUnique.mockResolvedValue({
      ...baseSignal,
      rawPayloadRedacted: { symbol: "PETR4", api_secret: "nope" },
    });
    dispatchFindMany.mockResolvedValue([]);
    selectEligible.mockResolvedValue({
      candidatesCount: 0,
      eligible: [],
      skipped: [],
    });

    const tracking = await getMasterSignalTrackingForAdmin("ms-test-001");
    const json = JSON.stringify(tracking!.masterSignal.rawPayloadRedacted ?? {});
    expect(json.toLowerCase()).not.toContain("nope");
    expect(json).not.toContain("api_secret");
  });
});

describe("tracking summary helpers", () => {
  it("buildTrackingSummaryFromDispatches conta pending e executed", () => {
    const summary = buildTrackingSummaryFromDispatches([
      {
        status: MasterSignalDispatchStatus.INSTRUCTION_CREATED,
        instruction: {
          currentStatus: OrderLogStatus.RECEIVED,
          expiresAt: new Date(Date.now() + 60_000),
          executions: [],
        },
      },
      {
        status: MasterSignalDispatchStatus.INSTRUCTION_CREATED,
        instruction: {
          currentStatus: OrderLogStatus.EXECUTED,
          expiresAt: new Date(Date.now() + 60_000),
          executions: [{ status: ExecutionStatus.FILLED }],
        },
      },
    ]);
    expect(summary.instructionCount).toBe(2);
    expect(summary.executedCount).toBe(1);
    expect(summary.pendingCount).toBe(1);
  });

  it("deriveConsolidatedTrackingStatus retorna NOT_DISPATCHED sem dispatch", () => {
    expect(
      deriveConsolidatedTrackingStatus({
        masterStatus: MasterSignalStatus.VALIDATED,
        summary: {
          dispatchCount: 0,
          instructionCount: 0,
          executedCount: 0,
          failedCount: 0,
          pendingCount: 0,
          expiredCount: 0,
          skippedCount: 0,
        },
        expiresAt: new Date(Date.now() + 3600_000),
      })
    ).toBe("NOT_DISPATCHED");
  });

  it("deriveConsolidatedTrackingStatus retorna EXPIRED sem dispatch quando expiresAt passou", () => {
    expect(
      deriveConsolidatedTrackingStatus({
        masterStatus: MasterSignalStatus.VALIDATED,
        summary: {
          dispatchCount: 0,
          instructionCount: 0,
          executedCount: 0,
          failedCount: 0,
          pendingCount: 0,
          expiredCount: 0,
          skippedCount: 0,
        },
        expiresAt: new Date(Date.now() - 1_000),
      })
    ).toBe("EXPIRED");
  });

  it("deriveConsolidatedTrackingStatus não retorna DISPATCHED_PENDING para skipped-only", () => {
    expect(
      deriveConsolidatedTrackingStatus({
        masterStatus: MasterSignalStatus.REJECTED,
        summary: {
          dispatchCount: 1,
          instructionCount: 0,
          executedCount: 0,
          failedCount: 0,
          pendingCount: 0,
          expiredCount: 0,
          skippedCount: 1,
        },
        expiresAt: new Date(Date.now() + 3600_000),
      })
    ).toBe("REJECTED_NO_ELIGIBLE_LICENSES");
  });

  it("formatDispatchSkipReason exibe Real Trading Guard de forma legível", () => {
    expect(formatDispatchSkipReason(REAL_TRADING_DISABLED_CODE)).toBe(
      REAL_TRADING_DISABLED_REASON
    );
  });
});

describe("getMasterSignalDetailsForAdmin", () => {
  beforeEach(() => {
    masterFindUnique.mockReset();
    dispatchFindMany.mockReset();
  });

  it("retorna detalhes sem expor segredos no payload", async () => {
    masterFindUnique.mockImplementation(async (args: { where: { masterSignalId?: string } }) => {
      if (args.where.masterSignalId === "ms-test-001") return baseSignal;
      return null;
    });
    dispatchFindMany.mockResolvedValue([]);

    const details = await getMasterSignalDetailsForAdmin("ms-test-001");
    expect(details).not.toBeNull();
    expect(details!.signal.masterSignalId).toBe("ms-test-001");
    const json = JSON.stringify(details!.signal.rawPayloadRedacted ?? {});
    expect(json.toLowerCase()).not.toContain("master_ea_api_secret");
    expect(json.toLowerCase()).not.toContain("bearer ");
  });

  it("inclui instructions com source MASTER_SIGNAL quando presentes", async () => {
    masterFindUnique.mockResolvedValue(baseSignal);
    dispatchFindMany.mockResolvedValue([
      {
        id: "disp-1",
        licenseId: "lic-1",
        status: MasterSignalDispatchStatus.INSTRUCTION_CREATED,
        reason: null,
        instructionId: "inst-1",
        createdAt: new Date(),
        license: {
          id: "lic-1",
          user: { email: "a@b.com" },
          mt5Account: { login: "1", server: "S" },
          exposureProfile: { slug: "conservador" },
        },
        instruction: {
          id: "inst-1",
          licenseId: "lic-1",
          currentStatus: OrderLogStatus.RECEIVED,
          symbol: "PETR4",
          side: InstructionSide.BUY,
          purpose: InstructionPurpose.ENTRY,
          source: InstructionSource.MASTER_SIGNAL,
          createdAt: new Date(),
          executions: [],
        },
      },
    ]);

    const details = await getMasterSignalDetailsForAdmin("ms-test-001");
    expect(details!.instructions[0].source).toBe(MASTER_SIGNAL_INSTRUCTION_SOURCE);
  });

  it("reconstrói linha MasterSignal -> Dispatch -> Instruction -> Execution", async () => {
    masterFindUnique.mockResolvedValue({
      ...baseSignal,
      status: MasterSignalStatus.DISPATCHED,
    });
    dispatchFindMany.mockResolvedValue([
      {
        id: "disp-chain",
        licenseId: "lic-1",
        status: MasterSignalDispatchStatus.INSTRUCTION_CREATED,
        reason: null,
        instructionId: "inst-chain",
        createdAt: new Date("2026-05-26T20:00:00Z"),
        license: {
          id: "lic-1",
          user: { email: "client@example.com" },
          mt5Account: { login: "123", server: "Demo" },
          exposureProfile: { slug: "conservador" },
        },
        instruction: {
          id: "inst-chain",
          licenseId: "lic-1",
          currentStatus: OrderLogStatus.EXECUTED,
          symbol: "PETR4",
          side: InstructionSide.BUY,
          purpose: InstructionPurpose.ENTRY,
          source: InstructionSource.MASTER_SIGNAL,
          createdAt: new Date("2026-05-26T20:01:00Z"),
          executions: [
            {
              id: "exec-chain",
              status: ExecutionStatus.FILLED,
              brokerTicket: "debug-ticket",
              executedAt: new Date("2026-05-26T20:02:00Z"),
            },
          ],
        },
      },
    ]);

    const details = await getMasterSignalDetailsForAdmin("ms-test-001");

    expect(details!.signal.masterSignalId).toBe("ms-test-001");
    expect(details!.dispatches[0]).toMatchObject({
      id: "disp-chain",
      instructionId: "inst-chain",
      licenseId: "lic-1",
    });
    expect(details!.instructions[0]).toMatchObject({
      id: "inst-chain",
      source: MASTER_SIGNAL_INSTRUCTION_SOURCE,
      currentStatus: OrderLogStatus.EXECUTED,
    });
    expect(details!.instructions[0].executions[0]).toMatchObject({
      id: "exec-chain",
      status: ExecutionStatus.FILLED,
    });
  });
});

describe("previewMasterSignalDispatch", () => {
  beforeEach(() => {
    masterFindUnique.mockReset();
    selectEligible.mockReset();
    userFindMany.mockReset();
  });

  it("não cria instruction — só consulta elegibilidade", async () => {
    masterFindUnique.mockResolvedValue(baseSignal);
    selectEligible.mockResolvedValue({
      candidatesCount: 2,
      eligible: [
        {
          id: "lic-1",
          userId: "user-1",
          mt5Account: { login: "1", server: "S" },
          exposureProfile: { slug: "conservador" },
        },
      ],
      skipped: [
        {
          licenseId: "lic-2",
          code: "PROFILE_MISMATCH",
          reason: "Perfil incompatível",
        },
      ],
    });
    userFindMany.mockResolvedValue([{ id: "user-1", email: "c@test.com" }]);

    const preview = await previewMasterSignalDispatch("ms-test-001");
    expect(preview!.eligibleCount).toBe(1);
    expect(preview!.skipped[0].code).toBe("PROFILE_MISMATCH");
    expect(dispatchValidated).not.toHaveBeenCalled();
  });
});

describe("sanitizeRawPayloadForAdmin / redact", () => {
  it("rawPayloadRedacted remove chaves sensíveis", () => {
    const redacted = redactMasterSignalPayload({
      symbol: "PETR4",
      api_secret: "hidden",
      Authorization: "Bearer hidden",
      password: "hidden-password",
      DATABASE_URL: "postgres://hidden",
      activation_code: "hidden-code",
      strategy_hint: "x",
      nested: {
        device_token: "hidden-token",
        comment: "Bearer hidden-value",
      },
    });
    expect(redacted).not.toHaveProperty("api_secret");
    expect(redacted).not.toHaveProperty("Authorization");
    expect(redacted).not.toHaveProperty("password");
    expect(redacted).not.toHaveProperty("DATABASE_URL");
    expect(redacted).not.toHaveProperty("activation_code");
    expect(redacted).not.toHaveProperty("strategy_hint");
    expect(JSON.stringify(redacted)).not.toContain("hidden");
    expect(redacted.symbol).toBe("PETR4");
  });

  it("sanitizeRawPayloadForAdmin remove authorization sem omitir payload seguro", () => {
    const out = sanitizeRawPayloadForAdmin({
      authorization: "Bearer xyz",
      symbol: "PETR4",
    } as never);
    expect(out).toEqual({ symbol: "PETR4" });
  });
});

describe("dispatchMasterSignalFromAdmin", () => {
  beforeEach(() => {
    dispatchValidated.mockReset();
    recordAdminAction.mockReset();
  });

  it("chama dispatchValidatedMasterSignal e registra admin action", async () => {
    dispatchValidated.mockResolvedValue({
      ok: true,
      masterSignalId: "ms-test-001",
      status: MasterSignalStatus.DISPATCHED,
      instructionsCreated: 1,
      skipped: 0,
      failed: 0,
      idempotent: false,
    });
    recordAdminAction.mockResolvedValue({ id: "act-1" });

    const result = await dispatchMasterSignalFromAdmin({
      masterSignalKey: "ms-test-001",
      actorId: "admin-1",
    });

    expect(dispatchValidated).toHaveBeenCalledWith("ms-test-001");
    expect(result.instructionsCreated).toBe(1);
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "MASTER_SIGNAL_DISPATCH",
        targetType: "master_signal",
      })
    );
  });
});

describe("MasterSignalDispatchButton", () => {
  it("não renderiza botão de disparo quando o sinal não é VALIDATED", () => {
    const html = renderToStaticMarkup(
      createElement(MasterSignalDispatchButton, {
        masterSignalId: "ms-test-001",
        signalStatus: MasterSignalStatus.REJECTED,
        disabled: true,
        disabledReason: "Status REJECTED — disparo só para VALIDATED.",
      })
    );

    expect(html).toContain("Status REJECTED");
    expect(html).not.toContain("Disparar para clientes");
  });
});

describe("permissões admin dispatch API", () => {
  beforeEach(() => {
    authMock.mockReset();
  });

  it("SUPERADMIN pode disparar master signals", () => {
    expect(canDispatchMasterSignals("SUPERADMIN")).toBe(true);
  });

  it("SUPPORT não pode disparar master signals", () => {
    expect(canDispatchMasterSignals("SUPPORT")).toBe(false);
  });

  it("requireAdminApiSession nega dispatchInstructions para SUPPORT", async () => {
    authMock.mockResolvedValue({
      user: { id: "u1", role: "SUPPORT" },
    });
    const result = await requireAdminApiSession({ dispatchInstructions: true });
    expect("error" in result).toBe(true);
  });

  it("requireAdminApiSession permite OPS com dispatchInstructions", async () => {
    authMock.mockResolvedValue({
      user: { id: "u1", role: "OPS" },
    });
    const result = await requireAdminApiSession({ dispatchInstructions: true });
    expect("error" in result).toBe(false);
    expect(result.session?.user?.role).toBe("OPS");
  });
});

describe("contrato e idempotência (integração com dispatch mock)", () => {
  it("retry idempotente não incrementa instructionsCreated no resultado", async () => {
    dispatchValidated.mockResolvedValue({
      ok: true,
      masterSignalId: "ms-test-001",
      status: MasterSignalStatus.DISPATCHED,
      instructionsCreated: 1,
      skipped: 0,
      failed: 0,
      idempotent: true,
    });

    const r1 = await dispatchMasterSignalFromAdmin({
      masterSignalKey: "ms-test-001",
      actorId: "admin-1",
    });
    const r2 = await dispatchMasterSignalFromAdmin({
      masterSignalKey: "ms-test-001",
      actorId: "admin-1",
    });
    expect(r1.idempotent).toBe(true);
    expect(r2.idempotent).toBe(true);
    expect(r1.instructionsCreated).toBe(1);
    expect(r2.instructionsCreated).toBe(1);
  });

  it("MASTER_EA_API_SECRET não aparece em helpers admin", () => {
    expect(process.env.MASTER_EA_API_SECRET).toBeUndefined();
    expect(isAdminRole("OPS")).toBe(true);
  });
});
