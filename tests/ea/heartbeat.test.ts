import { describe, expect, it, vi, beforeEach } from "vitest";
import { LicenseStatus, SubscriptionStatus } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  default: {
    device: { update: vi.fn() },
    eaHeartbeat: { create: vi.fn() },
    equitySnapshot: { create: vi.fn() },
    positionSnapshot: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    instruction: { count: vi.fn().mockResolvedValue(0) },
  },
}));

vi.mock("@/lib/audit/log", () => ({
  createAuditLog: vi.fn(),
}));

vi.mock("@/lib/licensing/service", () => ({
  getLicenseOperationalFlags: vi.fn().mockResolvedValue({
    licenseId: "lic1",
    licenseStatus: LicenseStatus.ACTIVE,
    subscriptionStatus: SubscriptionStatus.ACTIVE,
    haltNewEntries: false,
    haltAllTrading: false,
    canAcceptNewEntries: true,
    canManageOpenPositions: true,
    displayMessage: "OK",
  }),
}));

import prisma from "@/lib/prisma";
import { processHeartbeat } from "@/lib/ea/heartbeat";
import { createAuditLog } from "@/lib/audit/log";

const ctx = {
  device: { id: "dev1", deviceId: "mt5-1", licenseId: "lic1", lastSeenAt: null },
  license: {
    id: "lic1",
    userId: "user1",
    status: LicenseStatus.ACTIVE,
    subscription: { status: SubscriptionStatus.ACTIVE },
    mt5Account: { login: "123", server: "Broker" },
  },
  requestId: "req-hb",
  deviceIdHeader: "mt5-1",
  eaVersion: "1.0.0",
} as const;

describe("Posição aberta", () => {
  beforeEach(() => vi.clearAllMocks());

  it("registra snapshots de posição aberta", async () => {
    await processHeartbeat(ctx as never, {
      login: "123",
      server: "Broker",
      ea_status: "ONLINE",
      equity: 100_000,
      balance: 100_000,
      pending_orders: [{ symbol: "PETR4", side: "BUY", volume: 100 }],
      open_positions: [
        { symbol: "PETR4", quantity: 100, avg_price: 28.5, unrealized_pnl: 150 },
      ],
    });

    expect(prisma.positionSnapshot.deleteMany).toHaveBeenCalled();
    expect(prisma.positionSnapshot.createMany).toHaveBeenCalled();
    expect(prisma.eaHeartbeat.create).toHaveBeenCalled();
  });
});

describe("Posição encerrada", () => {
  beforeEach(() => vi.clearAllMocks());

  it("audita quando não há posições abertas", async () => {
    await processHeartbeat(ctx as never, {
      login: "123",
      server: "Broker",
      ea_status: "ONLINE",
      equity: 99_000,
      balance: 99_000,
      pending_orders: [],
      open_positions: [],
    });

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ea.positions_closed" })
    );
    expect(prisma.positionSnapshot.createMany).not.toHaveBeenCalled();
  });
});
