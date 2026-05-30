import { DeviceStatus, TradeMode } from "@prisma/client";

export type OperationalCompatibilityStatus =
  | "OK"
  | "AWAITING_NEW_DEVICE"
  | "MISMATCH_ACCOUNT"
  | "MISMATCH_TRADE_MODE"
  | "NO_HEARTBEAT";

export type DeviceCompatibilityLabel =
  | "OK_REAL_ACTIVE"
  | "OK_DEMO_ACTIVE"
  | "MISMATCH_EXPECTED_REAL"
  | "MISMATCH_EXPECTED_DEMO"
  | "MISMATCH_ACCOUNT"
  | "HISTORICAL_REVOKED"
  | "HISTORICAL_BLOCKED"
  | "AWAITING_HEARTBEAT"
  | "INACTIVE";

export type LicenseExpectedFields = {
  expectedTradeMode: TradeMode;
  expectedAccountLogin: string | null;
  expectedAccountServer: string | null;
  expectedSymbol: string | null;
  expectedMagicNumber: number | null;
  mt5Account: { login: string; server: string } | null;
};

export function resolveExpectedAccount(license: LicenseExpectedFields) {
  return {
    login:
      license.expectedAccountLogin?.trim() ||
      license.mt5Account?.login ||
      null,
    server:
      license.expectedAccountServer?.trim() ||
      license.mt5Account?.server ||
      null,
  };
}

export function validateLicenseExpectedActivation(input: {
  license: LicenseExpectedFields;
  accountLogin?: string | null;
  accountServer?: string | null;
  tradeMode?: string | null;
}):
  | { ok: true }
  | {
      ok: false;
      code:
        | "LICENSE_EXPECTED_ACCOUNT_MISMATCH"
        | "LICENSE_EXPECTED_SERVER_MISMATCH"
        | "LICENSE_EXPECTED_TRADE_MODE_MISMATCH";
    } {
  const expected = resolveExpectedAccount(input.license);
  const login = input.accountLogin?.trim();
  const server = input.accountServer?.trim();
  const tradeMode = input.tradeMode?.trim().toUpperCase();

  if (expected.login && login && login !== expected.login) {
    return { ok: false, code: "LICENSE_EXPECTED_ACCOUNT_MISMATCH" };
  }
  if (expected.server && server && server !== expected.server) {
    return { ok: false, code: "LICENSE_EXPECTED_SERVER_MISMATCH" };
  }

  const expectedMode = input.license.expectedTradeMode;
  if (expectedMode === TradeMode.REAL) {
    if (!tradeMode) {
      return { ok: false, code: "LICENSE_EXPECTED_TRADE_MODE_MISMATCH" };
    }
    if (tradeMode !== "REAL") {
      return { ok: false, code: "LICENSE_EXPECTED_TRADE_MODE_MISMATCH" };
    }
  } else if (tradeMode && tradeMode !== "DEMO") {
    return { ok: false, code: "LICENSE_EXPECTED_TRADE_MODE_MISMATCH" };
  }

  return { ok: true };
}

export function computeLicenseOperationalStatus(input: {
  license: LicenseExpectedFields;
  activeDevices: Array<{
    status: DeviceStatus;
    tradeMode: string | null;
    accountLogin: string | null;
    accountServer: string | null;
  }>;
  latestHeartbeat: {
    tradeMode: TradeMode | null;
    deviceId: string;
    receivedAt: Date;
  } | null;
}): OperationalCompatibilityStatus {
  const expected = resolveExpectedAccount(input.license);
  const active = input.activeDevices.filter((d) => d.status === DeviceStatus.ACTIVE);

  if (active.length === 0) {
    if (!input.latestHeartbeat) return "NO_HEARTBEAT";
    return "AWAITING_NEW_DEVICE";
  }

  const activeRealOk = active.some((d) => {
    if (input.license.expectedTradeMode === TradeMode.REAL) {
      if (d.tradeMode !== "REAL") return false;
    } else if (d.tradeMode && d.tradeMode !== "DEMO") {
      return false;
    }
    if (expected.login && d.accountLogin && d.accountLogin !== expected.login) {
      return false;
    }
    if (
      expected.server &&
      d.accountServer &&
      d.accountServer !== expected.server
    ) {
      return false;
    }
    return true;
  });

  if (activeRealOk) return "OK";

  const accountMismatch = active.some((d) => {
    if (expected.login && d.accountLogin && d.accountLogin !== expected.login) {
      return true;
    }
    if (
      expected.server &&
      d.accountServer &&
      d.accountServer !== expected.server
    ) {
      return true;
    }
    return false;
  });
  if (accountMismatch) return "MISMATCH_ACCOUNT";

  const tradeMismatch = active.some((d) => {
    if (input.license.expectedTradeMode === TradeMode.REAL && d.tradeMode !== "REAL") {
      return true;
    }
    if (input.license.expectedTradeMode === TradeMode.DEMO && d.tradeMode === "REAL") {
      return true;
    }
    return false;
  });
  if (tradeMismatch) return "MISMATCH_TRADE_MODE";

  if (!input.latestHeartbeat) return "NO_HEARTBEAT";

  return "AWAITING_NEW_DEVICE";
}

export function computeDeviceCompatibility(input: {
  deviceStatus: DeviceStatus;
  reportedTradeMode: string | null;
  accountLogin: string | null;
  accountServer: string | null;
  hasHeartbeat: boolean;
  expectedTradeMode: TradeMode;
  expectedAccountLogin: string | null;
  expectedAccountServer: string | null;
}): DeviceCompatibilityLabel {
  if (
    input.deviceStatus === DeviceStatus.REVOKED ||
    input.deviceStatus === DeviceStatus.BLOCKED
  ) {
    return input.deviceStatus === DeviceStatus.REVOKED
      ? "HISTORICAL_REVOKED"
      : "HISTORICAL_BLOCKED";
  }

  if (input.deviceStatus !== DeviceStatus.ACTIVE) {
    return "INACTIVE";
  }

  if (!input.hasHeartbeat) return "AWAITING_HEARTBEAT";

  const login = input.expectedAccountLogin ?? input.accountLogin;
  const server = input.expectedAccountServer ?? input.accountServer;

  if (login && input.accountLogin && input.accountLogin !== login) {
    return "MISMATCH_ACCOUNT";
  }
  if (server && input.accountServer && input.accountServer !== server) {
    return "MISMATCH_ACCOUNT";
  }

  if (input.expectedTradeMode === TradeMode.REAL) {
    if (input.reportedTradeMode === "REAL") return "OK_REAL_ACTIVE";
    return "MISMATCH_EXPECTED_REAL";
  }

  if (input.reportedTradeMode === "DEMO" || !input.reportedTradeMode) {
    return "OK_DEMO_ACTIVE";
  }
  return "MISMATCH_EXPECTED_DEMO";
}

export function parseDeviceIdAccount(deviceId: string): {
  login: string | null;
  server: string | null;
} {
  const prefix = "mt5-";
  if (!deviceId.startsWith(prefix)) {
    return { login: null, server: null };
  }
  const rest = deviceId.slice(prefix.length);
  const dash = rest.indexOf("-");
  if (dash <= 0) return { login: null, server: null };
  return {
    login: rest.slice(0, dash),
    server: rest.slice(dash + 1),
  };
}

export const OPERATIONAL_STATUS_LABELS: Record<
  OperationalCompatibilityStatus,
  string
> = {
  OK: "OK — device ativo compatível com modo esperado",
  AWAITING_NEW_DEVICE: "Aguardando novo device",
  MISMATCH_ACCOUNT: "Mismatch conta/servidor",
  MISMATCH_TRADE_MODE: "Mismatch tradeMode",
  NO_HEARTBEAT: "Sem heartbeat",
};

export const DEVICE_COMPATIBILITY_LABELS: Record<DeviceCompatibilityLabel, string> =
  {
    OK_REAL_ACTIVE: "OK — device real ativo",
    OK_DEMO_ACTIVE: "OK — device demo ativo",
    MISMATCH_EXPECTED_REAL: "MISMATCH — esperado REAL",
    MISMATCH_EXPECTED_DEMO: "MISMATCH — esperado DEMO",
    MISMATCH_ACCOUNT: "Mismatch conta/servidor",
    HISTORICAL_REVOKED: "Histórico revogado",
    HISTORICAL_BLOCKED: "Histórico bloqueado",
    AWAITING_HEARTBEAT: "Aguardando heartbeat",
    INACTIVE: "Inativo",
  };
