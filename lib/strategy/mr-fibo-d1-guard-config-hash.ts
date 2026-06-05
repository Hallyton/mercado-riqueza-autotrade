import { createHash } from "node:crypto";
import type { MrFiboD1GuardConfig } from "@/lib/strategy/mr-fibo-d1-guard-config";

export function hashMrFiboD1GuardConfig(config: MrFiboD1GuardConfig): string {
  const payload = JSON.stringify(config);
  return createHash("sha256").update(payload).digest("hex");
}
