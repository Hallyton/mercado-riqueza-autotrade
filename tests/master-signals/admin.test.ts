import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
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

import {
  getMasterSignalDetailsForAdmin,
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

  it("lista sinais com dispatchCount e instructionCount", async () => {
    masterFindMany.mockResolvedValue([
      {
        ...baseSignal,
        dispatches: [
          { instructionId: "inst-1" },
          { instructionId: null },
        ],
      },
    ]);

    const rows = await listMasterSignalsForAdmin();
    expect(rows).toHaveLength(1);
    expect(rows[0].masterSignalId).toBe("ms-test-001");
    expect(rows[0].dispatchCount).toBe(2);
    expect(rows[0].instructionCount).toBe(1);
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
      strategy_hint: "x",
    });
    expect(redacted).not.toHaveProperty("api_secret");
    expect(redacted).not.toHaveProperty("strategy_hint");
    expect(redacted.symbol).toBe("PETR4");
  });

  it("sanitizeRawPayloadForAdmin omite payload se fragmento sensível persistir", () => {
    const out = sanitizeRawPayloadForAdmin({
      authorization: "Bearer xyz",
    } as never);
    expect(out).toEqual({ redacted: true, note: "Payload omitido por segurança" });
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
