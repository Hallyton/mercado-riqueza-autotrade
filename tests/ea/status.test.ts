import { describe, expect, it } from "vitest";
import { isEaOffline, EA_OFFLINE_THRESHOLD_SEC } from "@/lib/ea/status";

describe("EA offline", () => {
  it("considera offline sem lastSeenAt", () => {
    expect(isEaOffline(null)).toBe(true);
  });

  it("considera online com heartbeat recente", () => {
    const now = new Date();
    const recent = new Date(now.getTime() - 30_000);
    expect(isEaOffline(recent, EA_OFFLINE_THRESHOLD_SEC, now)).toBe(false);
  });

  it("considera offline após threshold", () => {
    const now = new Date();
    const old = new Date(now.getTime() - (EA_OFFLINE_THRESHOLD_SEC + 1) * 1000);
    expect(isEaOffline(old, EA_OFFLINE_THRESHOLD_SEC, now)).toBe(true);
  });
});
