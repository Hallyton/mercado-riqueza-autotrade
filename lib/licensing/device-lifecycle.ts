import { DeviceStatus, type Device } from "@prisma/client";

export const ACTIVE_DEVICE_WHERE = {
  status: DeviceStatus.ACTIVE,
  revokedAt: null,
  blockedAt: null,
} as const;

export function resolveDeviceStatus(device: Pick<Device, "status" | "revokedAt" | "blockedAt">): DeviceStatus {
  if (device.status === DeviceStatus.BLOCKED || device.blockedAt) {
    return DeviceStatus.BLOCKED;
  }
  if (device.status === DeviceStatus.REVOKED || device.revokedAt) {
    return DeviceStatus.REVOKED;
  }
  return DeviceStatus.ACTIVE;
}

export function isDeviceActive(device: Pick<Device, "status" | "revokedAt" | "blockedAt">): boolean {
  return resolveDeviceStatus(device) === DeviceStatus.ACTIVE;
}
