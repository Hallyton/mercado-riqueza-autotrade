import type { Device } from "@prisma/client";
import prisma from "@/lib/prisma";

export type EaActivitySource =
  | "HEARTBEAT"
  | "CONFIG"
  | "DAILY_RISK_REPORT"
  | "OPERATION_SNAPSHOT"
  | "COMMANDS_POLL"
  | "COMMAND_ACK"
  | "COMMAND_RESULT"
  | "CAN_TRADE"
  | "HEALTH_CHECK_ACK"
  | "HEALTH_CHECK_RESULT"
  | "INSTRUCTIONS_POLL"
  | "EXECUTION_REPORT"
  | "EA_REQUEST";

export async function touchEaDeviceActivity(input: {
  deviceId: string;
  licenseId: string;
  source: EaActivitySource;
  requestId?: string | null;
  accountLogin?: string | null;
  accountServer?: string | null;
  symbol?: string | null;
  strategyCode?: string | null;
  at?: Date;
}): Promise<Pick<Device, "lastSeenAt" | "lastActivityAt" | "lastActivitySource" | "lastActivityRequestId">> {
  const at = input.at ?? new Date();
  const updated = await prisma.device.update({
    where: { id: input.deviceId },
    data: {
      lastSeenAt: at,
      lastActivityAt: at,
      lastActivitySource: input.source,
      lastActivityRequestId: input.requestId ?? null,
    },
    select: {
      lastSeenAt: true,
      lastActivityAt: true,
      lastActivitySource: true,
      lastActivityRequestId: true,
    },
  });
  return updated;
}

export function applyDeviceActivityToContext(
  device: Device,
  activity: Pick<
    Device,
    "lastSeenAt" | "lastActivityAt" | "lastActivitySource" | "lastActivityRequestId"
  >
): Device {
  return {
    ...device,
    lastSeenAt: activity.lastSeenAt,
    lastActivityAt: activity.lastActivityAt,
    lastActivitySource: activity.lastActivitySource,
    lastActivityRequestId: activity.lastActivityRequestId,
  };
}
