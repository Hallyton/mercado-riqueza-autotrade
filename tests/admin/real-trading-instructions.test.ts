import { InstructionSource, OrderLogStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  REAL_TRADING_INSTRUCTION_SOURCES,
  serializeRealTradingInstructionListItem,
} from "@/lib/admin/real-trading-instructions";

describe("real-trading-instructions", () => {
  it("lista apenas REAL_MANUAL por padrão", () => {
    expect(REAL_TRADING_INSTRUCTION_SOURCES).toEqual([
      InstructionSource.REAL_MANUAL,
    ]);
    expect(REAL_TRADING_INSTRUCTION_SOURCES).not.toContain(
      InstructionSource.TEST
    );
    expect(REAL_TRADING_INSTRUCTION_SOURCES).not.toContain(
      InstructionSource.HOMOLOGATION
    );
  });

  it("serializa item sem secrets nem strategy", () => {
    const createdAt = new Date("2026-06-02T12:00:00Z");
    const serialized = serializeRealTradingInstructionListItem({
      id: "instr-1",
      createdAt,
      licenseId: "lic-1",
      accountLogin: "19583778",
      accountServer: "XPMT5-PRD",
      symbol: "WDON26",
      side: "BUY",
      orderType: "MARKET",
      orderPrice: null,
      stopLoss: { toString: () => "5640" } as never,
      takeProfit: { toString: () => "5660" } as never,
      quantity: { toString: () => "1" } as never,
      magicNumber: 910001,
      source: InstructionSource.REAL_MANUAL,
      currentStatus: OrderLogStatus.RECEIVED,
      license: { user: { email: "cliente@example.com" } },
      eaHeartbeat: { eaStatus: "ONLINE", tradeMode: "REAL", receivedAt: createdAt },
      preflightId: "pf-1",
      latestExecution: { id: "ex-1", status: "EXECUTED" },
      latestProtection: { protectionStatus: "CONFIRMED" },
      executions: [],
      executionProtectionReports: [],
      realTradePreflights: [],
    } as never);

    expect(serialized).toMatchObject({
      instructionId: "instr-1",
      clientEmail: "cliente@example.com",
      licenseId: "lic-1",
      source: "REAL_MANUAL",
      status: "RECEIVED",
      executionId: "ex-1",
      protectionStatus: "CONFIRMED",
      preflightId: "pf-1",
    });
    expect(JSON.stringify(serialized)).not.toMatch(/bearer|token|strategy/i);
  });
});
