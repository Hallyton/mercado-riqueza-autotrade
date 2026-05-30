import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  MAGIC_NUMBER_MAX,
  MAGIC_NUMBER_MIN,
  ROBOT_MONTHLY_PRICE_CENTS,
  AUTOTRADE_SINGLE_ROBOT_PLAN_SLUG,
  COMMERCIAL_SIGNUP_TERM_TYPES,
  MAX_ROBOTS_CURRENT_PHASE,
} from "@/lib/commercial/constants";

describe("commercial constants", () => {
  it("define plano AutoTrade Single Robot a R$ 300", () => {
    expect(AUTOTRADE_SINGLE_ROBOT_PLAN_SLUG).toBe("autotrade-single-robot");
    expect(ROBOT_MONTHLY_PRICE_CENTS).toBe(30000);
    expect(MAX_ROBOTS_CURRENT_PHASE).toBe(1);
  });

  it("define faixa magicNumber 910001–910999", () => {
    expect(MAGIC_NUMBER_MIN).toBe(910001);
    expect(MAGIC_NUMBER_MAX).toBe(910999);
  });

  it("exige cinco aceites no cadastro comercial", () => {
    expect(COMMERCIAL_SIGNUP_TERM_TYPES).toHaveLength(5);
    expect(COMMERCIAL_SIGNUP_TERM_TYPES).toContain("COMMERCIAL_SUBSCRIPTION_TERMS");
    expect(COMMERCIAL_SIGNUP_TERM_TYPES).toContain("BLACK_BOX_ACKNOWLEDGMENT");
  });
});

const prismaMock = vi.hoisted(() => ({
  robotInstance: { findMany: vi.fn(), findFirst: vi.fn() },
  license: { findMany: vi.fn(), findFirst: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import {
  allocateMagicNumber,
  isMagicNumberAvailable,
  MagicNumberError,
} from "@/lib/commercial/magic-number";

describe("magic number allocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.robotInstance.findMany.mockResolvedValue([]);
    prismaMock.license.findMany = vi.fn().mockResolvedValue([]);
  });

  it("aloca primeiro número livre na faixa", async () => {
    const n = await allocateMagicNumber();
    expect(n).toBe(910001);
  });

  it("bloqueia colisão", async () => {
    prismaMock.robotInstance.findFirst.mockResolvedValue({ id: "r1" });
    const ok = await isMagicNumberAvailable(910001);
    expect(ok).toBe(false);
  });

  it("rejeita número fora da faixa", async () => {
    expect(await isMagicNumberAvailable(900000)).toBe(false);
  });

  it("esgota faixa com erro", async () => {
    const used = [];
    for (let n = MAGIC_NUMBER_MIN; n <= MAGIC_NUMBER_MAX; n++) {
      used.push({ magicNumber: n });
    }
    prismaMock.robotInstance.findMany.mockResolvedValue(used);
    prismaMock.license.findMany.mockResolvedValue([]);
    await expect(allocateMagicNumber()).rejects.toBeInstanceOf(MagicNumberError);
  });
});
