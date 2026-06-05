import { LicenseStatus, RealTradingApprovalStatus } from "@prisma/client";
import { z } from "zod";
import { recordAdminAction } from "@/lib/admin/record-action";
import { linkRobotInstanceToLicense } from "@/lib/commercial/robot-instance";
import { ACTIVE_DEVICE_WHERE } from "@/lib/licensing/device-lifecycle";
import { isEaOffline } from "@/lib/ea/status";
import prisma from "@/lib/prisma";
import {
  MR_FIBO_D1_GUARD_CODE,
  MR_FIBO_D1_GUARD_DISPLAY_NAME,
} from "@/lib/risk/autonomous-strategy-reasons";

export const AUTONOMOUS_STRATEGY_ENABLE_CONFIRM_PHRASE =
  "HABILITAR MR FIBO D1 GUARD";
export const AUTONOMOUS_STRATEGY_DISABLE_CONFIRM_PHRASE =
  "DESABILITAR MR FIBO D1 GUARD";

export const AUTONOMOUS_STRATEGY_BLOCKER_MESSAGES: Record<string, string> = {
  ROBOT_INSTANCE_MISSING:
    "Robô comercial ainda não provisionado para esta licença.",
  MT5_ACCOUNT_NOT_LINKED: "Vincule a conta MT5 antes de habilitar.",
  DAILY_FINANCIAL_STOP_NOT_CONFIGURED:
    "Configure o stop financeiro diário para esta licença/conta.",
  LICENSE_NOT_ACTIVE: "Licença inativa ou não elegível.",
  EXPECTED_MAGIC_MISSING: "MagicNumber esperado ausente na licença.",
  EXPECTED_SYMBOL_MISSING: "Símbolo esperado ausente na licença.",
};

export const autonomousStrategyUpdateSchema = z.object({
  strategy_code: z.literal(MR_FIBO_D1_GUARD_CODE),
  autonomous_strategy_enabled: z.boolean(),
  admin_confirmation: z.string().min(1),
});

export class LicenseAutonomousStrategyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "LicenseAutonomousStrategyError";
  }
}

function resolveMaxContracts(input: {
  approvalMax: number | null | undefined;
}): number {
  return input.approvalMax ?? 1;
}

export async function getLicenseAutonomousStrategyAdminView(licenseId: string) {
  const license = await prisma.license.findUnique({
    where: { id: licenseId },
    include: {
      user: { select: { id: true, email: true, name: true } },
      mt5Account: true,
      subscription: { select: { id: true, status: true, adminPaymentStatus: true } },
      exposureProfile: true,
      robotInstances: {
        orderBy: { createdAt: "desc" },
        take: 3,
        include: {
          robotProduct: {
            select: {
              id: true,
              slug: true,
              name: true,
              strategyCode: true,
              defaultSymbol: true,
            },
          },
        },
      },
    },
  });

  if (!license) return null;

  const robotInstance = license.robotInstances[0] ?? null;

  const [dailyRiskLimit, activeDevice, latestHeartbeat, approval] =
    await Promise.all([
      prisma.dailyFinancialRiskLimit.findFirst({
        where: { licenseId, enabled: true },
      }),
      prisma.device.findFirst({
        where: { licenseId, ...ACTIVE_DEVICE_WHERE },
        orderBy: { lastSeenAt: "desc" },
      }),
      prisma.eaHeartbeat.findFirst({
        where: { licenseId },
        orderBy: { receivedAt: "desc" },
      }),
      robotInstance?.magicNumber
        ? prisma.realTradingApproval.findFirst({
            where: {
              licenseId,
              magicNumber: robotInstance.magicNumber,
              status: RealTradingApprovalStatus.APPROVED,
              allowReal: true,
            },
            orderBy: { createdAt: "desc" },
          })
        : null,
    ]);

  const expectedSymbol =
    license.expectedSymbol ?? robotInstance?.symbol ?? robotInstance?.robotProduct?.defaultSymbol ?? null;
  const expectedMagicNumber =
    license.expectedMagicNumber ?? robotInstance?.magicNumber ?? null;
  const maxContracts = resolveMaxContracts({ approvalMax: approval?.maxContracts });

  const blockers: string[] = [];

  if (!robotInstance) {
    blockers.push("ROBOT_INSTANCE_MISSING");
  }
  if (!license.mt5Account) {
    blockers.push("MT5_ACCOUNT_NOT_LINKED");
  }
  if (
    license.status !== LicenseStatus.ACTIVE &&
    license.status !== LicenseStatus.PENDING_ACTIVATION
  ) {
    blockers.push("LICENSE_NOT_ACTIVE");
  }
  if (!expectedMagicNumber) {
    blockers.push("EXPECTED_MAGIC_MISSING");
  }
  if (!expectedSymbol) {
    blockers.push("EXPECTED_SYMBOL_MISSING");
  }
  if (!dailyRiskLimit?.enabled) {
    blockers.push("DAILY_FINANCIAL_STOP_NOT_CONFIGURED");
  }

  const deviceOnline =
    Boolean(activeDevice) &&
    Boolean(latestHeartbeat) &&
    !isEaOffline(activeDevice?.lastSeenAt ?? latestHeartbeat?.receivedAt);

  const deviceSummary = activeDevice
    ? `${activeDevice.status}${latestHeartbeat?.tradeMode ? ` / ${latestHeartbeat.tradeMode}` : ""}${deviceOnline ? " / Online" : " / Offline"}`
    : "Nenhum device ACTIVE";

  const canEnable = blockers.length === 0;

  const unlinkedInstance = license.subscription
    ? await prisma.robotInstance.findFirst({
        where: {
          subscriptionId: license.subscription.id,
          licenseId: null,
        },
        orderBy: { createdAt: "desc" },
      })
    : null;

  return {
    licenseId: license.id,
    client: {
      userId: license.user.id,
      email: license.user.email,
      name: license.user.name,
    },
    licenseStatus: license.status,
    robotInstanceId: robotInstance?.id ?? null,
    robotProduct: robotInstance?.robotProduct ?? null,
    strategyCode: MR_FIBO_D1_GUARD_CODE,
    strategyDisplayName: MR_FIBO_D1_GUARD_DISPLAY_NAME,
    currentStrategyCode:
      robotInstance?.autonomousStrategyCode ?? robotInstance?.robotProduct?.strategyCode ?? null,
    autonomousStrategyEnabled: robotInstance?.autonomousStrategyEnabled ?? false,
    expectedSymbol,
    expectedMagicNumber,
    maxContracts,
    mt5Account: license.mt5Account
      ? {
          login: license.mt5Account.login,
          server: license.mt5Account.server,
        }
      : null,
    dailyFinancialRisk: {
      configured: Boolean(dailyRiskLimit?.enabled),
      limitBrl: dailyRiskLimit
        ? dailyRiskLimit.dailyLossLimitCents / 100
        : null,
    },
    device: {
      summary: deviceSummary,
      active: Boolean(activeDevice),
      tradeMode: latestHeartbeat?.tradeMode ?? null,
      online: deviceOnline,
    },
    blockers,
    canEnable,
    canDisable: Boolean(robotInstance),
    canLinkExistingRobot: Boolean(unlinkedInstance && !robotInstance),
    unlinkedRobotInstanceId: unlinkedInstance?.id ?? null,
    enableConfirmPhrase: AUTONOMOUS_STRATEGY_ENABLE_CONFIRM_PHRASE,
    disableConfirmPhrase: AUTONOMOUS_STRATEGY_DISABLE_CONFIRM_PHRASE,
  };
}

export async function linkRobotInstanceToLicenseAdmin(input: {
  licenseId: string;
  robotInstanceId: string;
  actorId: string;
  ipAddress?: string | null;
}) {
  const license = await prisma.license.findUnique({
    where: { id: input.licenseId },
    select: { id: true, userId: true },
  });
  if (!license) {
    throw new LicenseAutonomousStrategyError(
      "Licença não encontrada.",
      "LICENSE_NOT_FOUND",
      404
    );
  }

  const instance = await prisma.robotInstance.findUnique({
    where: { id: input.robotInstanceId },
  });
  if (!instance || instance.userId !== license.userId) {
    throw new LicenseAutonomousStrategyError(
      "Robô não encontrado para este cliente.",
      "ROBOT_INSTANCE_NOT_FOUND",
      404
    );
  }

  await linkRobotInstanceToLicense(
    input.robotInstanceId,
    input.licenseId,
    input.actorId
  );

  await recordAdminAction({
    actorId: input.actorId,
    action: "license.robot_instance.link",
    targetType: "license",
    targetId: input.licenseId,
    auditEntityType: "robot_instance",
    ipAddress: input.ipAddress,
    metadata: {
      licenseId: input.licenseId,
      robotInstanceId: input.robotInstanceId,
    },
  });

  return { ok: true as const, robotInstanceId: input.robotInstanceId };
}

export async function updateLicenseAutonomousStrategy(input: {
  licenseId: string;
  strategyCode: string;
  autonomousStrategyEnabled: boolean;
  adminConfirmation: string;
  actorId: string;
  ipAddress?: string | null;
}) {
  if (input.strategyCode !== MR_FIBO_D1_GUARD_CODE) {
    throw new LicenseAutonomousStrategyError(
      "Código de estratégia não permitido.",
      "STRATEGY_CODE_INVALID",
      400
    );
  }

  const expectedPhrase = input.autonomousStrategyEnabled
    ? AUTONOMOUS_STRATEGY_ENABLE_CONFIRM_PHRASE
    : AUTONOMOUS_STRATEGY_DISABLE_CONFIRM_PHRASE;

  if (input.adminConfirmation.trim() !== expectedPhrase) {
    throw new LicenseAutonomousStrategyError(
      `Confirmação inválida. Digite exatamente: ${expectedPhrase}`,
      "ADMIN_CONFIRMATION_INVALID",
      400
    );
  }

  const view = await getLicenseAutonomousStrategyAdminView(input.licenseId);
  if (!view) {
    throw new LicenseAutonomousStrategyError(
      "Licença não encontrada.",
      "LICENSE_NOT_FOUND",
      404
    );
  }

  if (!view.robotInstanceId) {
    throw new LicenseAutonomousStrategyError(
      AUTONOMOUS_STRATEGY_BLOCKER_MESSAGES.ROBOT_INSTANCE_MISSING,
      "ROBOT_INSTANCE_MISSING",
      409
    );
  }

  if (input.autonomousStrategyEnabled && !view.canEnable) {
    throw new LicenseAutonomousStrategyError(
      "Pré-requisitos não atendidos para habilitar a estratégia autônoma.",
      view.blockers[0] ?? "PREREQUISITES_NOT_MET",
      409
    );
  }

  const instance = await prisma.robotInstance.findUnique({
    where: { id: view.robotInstanceId },
    select: {
      id: true,
      autonomousStrategyEnabled: true,
      autonomousStrategyCode: true,
    },
  });

  if (!instance) {
    throw new LicenseAutonomousStrategyError(
      "RobotInstance não encontrado.",
      "ROBOT_INSTANCE_MISSING",
      404
    );
  }

  const previousEnabled = instance.autonomousStrategyEnabled;

  const updated = await prisma.robotInstance.update({
    where: { id: instance.id },
    data: {
      autonomousStrategyEnabled: input.autonomousStrategyEnabled,
      autonomousStrategyCode: input.autonomousStrategyEnabled
        ? MR_FIBO_D1_GUARD_CODE
        : null,
      symbol: view.expectedSymbol ?? undefined,
    },
    select: {
      id: true,
      autonomousStrategyEnabled: true,
      autonomousStrategyCode: true,
    },
  });

  const action = input.autonomousStrategyEnabled
    ? "license.autonomous_strategy.enable"
    : "license.autonomous_strategy.disable";

  await recordAdminAction({
    actorId: input.actorId,
    action,
    targetType: "license",
    targetId: input.licenseId,
    auditEntityType: "robot_instance",
    ipAddress: input.ipAddress,
    metadata: {
      licenseId: input.licenseId,
      robotInstanceId: updated.id,
      strategyCode: MR_FIBO_D1_GUARD_CODE,
      previousEnabled,
      newEnabled: updated.autonomousStrategyEnabled,
      adminId: input.actorId,
      timestamp: new Date().toISOString(),
    },
  });

  return {
    ok: true as const,
    robotInstanceId: updated.id,
    autonomousStrategyEnabled: updated.autonomousStrategyEnabled,
    autonomousStrategyCode: updated.autonomousStrategyCode,
    strategyCode: MR_FIBO_D1_GUARD_CODE,
  };
}
