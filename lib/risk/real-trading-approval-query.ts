import {
  RealTradingApprovalStatus,
} from "@prisma/client";
import prisma from "@/lib/prisma";

function normalizeAccount(value: string): string {
  return value.trim();
}

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

export async function findActiveRealTradingApproval(
  licenseId: string,
  userId: string,
  accountLogin: string,
  accountServer: string,
  symbol: string,
  magicNumber: number
) {
  return prisma.realTradingApproval.findFirst({
    where: {
      licenseId,
      userId,
      accountLogin: normalizeAccount(accountLogin),
      accountServer: normalizeAccount(accountServer),
      symbol: normalizeSymbol(symbol),
      magicNumber,
      status: RealTradingApprovalStatus.APPROVED,
      allowReal: true,
      revokedAt: null,
    },
  });
}
