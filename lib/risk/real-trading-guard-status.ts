import {
  countActiveManualRealApprovals,
  isRealTradingEnabled,
} from "@/lib/risk/real-trading-guard";
import {
  isEnvLicenseAllowlistConfigured,
  parseEnvLicenseAllowlist,
} from "@/lib/risk/real-trading-config";

type EnvSource = Record<string, string | undefined>;

export type RealTradingGuardOperationalStatus =
  | "REAL_TRADING_BLOCKED"
  | "REAL_TRADING_MASTER_SWITCH_OPEN"
  | "REAL_TRADING_PARTIALLY_ALLOWED_BY_MANUAL_APPROVAL";

export type RealTradingGuardAdminStatus = {
  realTradingEnabled: boolean;
  defaultPolicy: "BLOCK_REAL_BY_DEFAULT";
  enableRealTradingConfigured: boolean;
  envAllowlistLicenseCount: number;
  envAllowlistLicenseIdsMasked: string[];
  activeManualApprovalCount: number;
  manualAllowlistConfigured: boolean;
  allowedLicenseCount: number;
  allowedLicenseIdsMasked: string[];
  demoAllowed: true;
  realRequiresMasterSwitchAndApproval: true;
  currentOperationalStatus: RealTradingGuardOperationalStatus;
  warningMessages: string[];
};


export function maskLicenseId(licenseId: string): string {
  const normalized = licenseId.trim();
  if (normalized.length === 0) return "***";
  if (normalized.length <= 8) {
    return `${normalized.slice(0, 2)}...${normalized.slice(-2)}`;
  }
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
}

export function maskAccountLogin(login: string): string {
  const normalized = login.trim();
  if (normalized.length <= 4) return "***";
  return `***${normalized.slice(-4)}`;
}

export async function getRealTradingGuardAdminStatus(
  env: EnvSource = process.env
): Promise<RealTradingGuardAdminStatus> {
  const realTradingEnabled = isRealTradingEnabled(env);
  const enableRealTradingConfigured =
    env.ENABLE_REAL_TRADING != null && env.ENABLE_REAL_TRADING.trim().length > 0;
  const envAllowlistLicenseIds = parseEnvLicenseAllowlist(env);
  const activeManualApprovalCount = await countActiveManualRealApprovals();
  const manualAllowlistConfigured = activeManualApprovalCount > 0;
  const envAllowlistConfigured = isEnvLicenseAllowlistConfigured(env);

  const allowedLicenseCount =
    activeManualApprovalCount + envAllowlistLicenseIds.length;

  const currentOperationalStatus: RealTradingGuardOperationalStatus =
    !realTradingEnabled
      ? "REAL_TRADING_BLOCKED"
      : manualAllowlistConfigured
        ? "REAL_TRADING_PARTIALLY_ALLOWED_BY_MANUAL_APPROVAL"
        : envAllowlistConfigured
          ? "REAL_TRADING_PARTIALLY_ALLOWED_BY_MANUAL_APPROVAL"
          : realTradingEnabled
            ? "REAL_TRADING_MASTER_SWITCH_OPEN"
            : "REAL_TRADING_BLOCKED";

  const warningMessages = [
    "Esta tela é somente leitura para envs — não altera o master switch pela UI.",
    "Conta real permanece bloqueada por padrão até aprovação manual APPROVED.",
    "Pagamento ou assinatura não libera REAL sozinho.",
    "A aprovação manual não envia ordem.",
    "A execução ainda depende de PRE_MARKET, margem, EA online, preflight PASSED e protection report.",
    "Dispatch automático continua desativado.",
    "Produção real global não está liberada por esta tela.",
    "Allowlist opcional de licenças no Vercel é trava adicional. Para novas licenças, não é necessário redeploy — crie RealTradingApproval APPROVED.",
  ];

  if (
    currentOperationalStatus ===
    "REAL_TRADING_PARTIALLY_ALLOWED_BY_MANUAL_APPROVAL"
  ) {
    warningMessages.push(
      "Há aprovação(ões) manual(is) ativa(s) — isso não substitui preflight nem dispatch manual."
    );
  }

  return {
    realTradingEnabled,
    defaultPolicy: "BLOCK_REAL_BY_DEFAULT",
    enableRealTradingConfigured,
    envAllowlistLicenseCount: envAllowlistLicenseIds.length,
    envAllowlistLicenseIdsMasked: envAllowlistLicenseIds.map(maskLicenseId),
    activeManualApprovalCount,
    manualAllowlistConfigured,
    allowedLicenseCount,
    allowedLicenseIdsMasked: [
      ...Array.from({ length: activeManualApprovalCount }, () => "(aprovação manual)"),
      ...envAllowlistLicenseIds.map(maskLicenseId),
    ],
    demoAllowed: true,
    realRequiresMasterSwitchAndApproval: true,
    currentOperationalStatus,
    warningMessages,
  };
}
