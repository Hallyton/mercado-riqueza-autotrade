import { jsonOk } from "@/lib/api/http";
import { requireAdminApiSession } from "@/lib/auth/admin-api";
import { getLiveMarketReadinessSnapshot } from "@/lib/admin/live-market-readiness";

export async function GET() {
  const authResult = await requireAdminApiSession();
  if ("error" in authResult && authResult.error) return authResult.error;

  const snapshot = await getLiveMarketReadinessSnapshot();
  return jsonOk(snapshot);
}
