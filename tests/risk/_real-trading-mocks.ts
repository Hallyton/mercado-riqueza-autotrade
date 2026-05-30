import { RealTradingApprovalStatus } from "@prisma/client";

export function buildMockApprovedRealTradingApproval(overrides?: {
  accountLogin?: string;
  accountServer?: string;
  symbol?: string;
  magicNumber?: number;
  maxContracts?: number;
  userId?: string;
}) {
  return {
    id: "appr-1",
    status: RealTradingApprovalStatus.APPROVED,
    allowReal: true,
    accountLogin: overrides?.accountLogin ?? "52609973",
    accountServer: overrides?.accountServer ?? "XPMT5-REAL",
    symbol: overrides?.symbol ?? "WDOM26",
    magicNumber: overrides?.magicNumber ?? 910001,
    marginBufferPercent: 10,
    minFreeMargin: 1000,
    maxContracts: overrides?.maxContracts ?? 2,
    userId: overrides?.userId ?? "user-1",
  };
}
