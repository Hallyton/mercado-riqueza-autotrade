import { assertLicenseUsable } from "@/lib/ea/auth";
import { buildEaConfigResponse } from "@/lib/ea/config";
import { withEaAuth } from "@/lib/ea/handler";
import { eaJson } from "@/lib/ea/json";

export const GET = withEaAuth(
  async (ctx) => {
    assertLicenseUsable(ctx);
    const config = await buildEaConfigResponse(ctx);
    return eaJson(config);
  },
  { rateLimit: "config" }
);
