import {
  isRealTradingEnabled,
} from "@/lib/risk/real-trading-guard";

type EnvSource = Record<string, string | undefined>;

export type RealTradingGuardOperationalStatus =
  | "REAL_TRADING_BLOCKED"
  | "REAL_TRADING_PARTIALLY_ALLOWED_BY_ALLOWLIST";

export type RealTradingGuardAdminStatus = {
  realTradingEnabled: boolean;
  defaultPolicy: "BLOCK_REAL_BY_DEFAULT";
  enableRealTradingConfigured: boolean;
  allowedLicenseCount: number;
  allowedLicenseIdsMasked: string[];
  demoAllowed: true;
  realRequiresFlagAndAllowlist: true;
  currentOperationalStatus: RealTradingGuardOperationalStatus;
  warningMessages: string[];
};

function parseAllowedLicenseIds(env: EnvSource): string[] {
  return (
    env.REAL_TRADING_ALLOWED_LICENSE_IDS?.split(/[,\s;]+/)
      .map((value) => value.trim())
      .filter(Boolean) ?? []
  );
}

export function maskLicenseId(licenseId: string): string {
  const normalized = licenseId.trim();
  if (normalized.length === 0) return "***";
  if (normalized.length <= 8) {
    return `${normalized.slice(0, 2)}...${normalized.slice(-2)}`;
  }
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
}

export function getRealTradingGuardAdminStatus(
  env: EnvSource = process.env
): RealTradingGuardAdminStatus {
  const realTradingEnabled = isRealTradingEnabled(env);
  const enableRealTradingConfigured =
    env.ENABLE_REAL_TRADING != null && env.ENABLE_REAL_TRADING.trim().length > 0;
  const allowedLicenseIds = parseAllowedLicenseIds(env);
  const hasAllowlist = allowedLicenseIds.length > 0;
  const currentOperationalStatus =
    realTradingEnabled && hasAllowlist
      ? "REAL_TRADING_PARTIALLY_ALLOWED_BY_ALLOWLIST"
      : "REAL_TRADING_BLOCKED";

  const warningMessages = [
    "Esta tela é somente leitura.",
    "Conta real não está liberada por esta tela.",
    "Produção real continua bloqueada.",
    "Dispatch automático continua desativado.",
    "Qualquer avanço exige gate jurídico, operacional e técnico específico.",
  ];

  if (currentOperationalStatus === "REAL_TRADING_PARTIALLY_ALLOWED_BY_ALLOWLIST") {
    warningMessages.push(
      "Há configuração técnica futura detectada, mas isso não representa liberação operacional."
    );
  }

  return {
    realTradingEnabled,
    defaultPolicy: "BLOCK_REAL_BY_DEFAULT",
    enableRealTradingConfigured,
    allowedLicenseCount: allowedLicenseIds.length,
    allowedLicenseIdsMasked: allowedLicenseIds.map(maskLicenseId),
    demoAllowed: true,
    realRequiresFlagAndAllowlist: true,
    currentOperationalStatus,
    warningMessages,
  };
}
