import { auth } from "@/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import { getSubscriptionDisplayLabel } from "@/lib/licensing/display";
import { getClientSubscriptionOverview } from "@/lib/licensing/service";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("Unauthorized", 401);
  }

  const overview = await getClientSubscriptionOverview(session.user.id);

  return jsonOk({
    displayStatus: overview.displayStatus,
    displayLabel: getSubscriptionDisplayLabel(overview.displayStatus),
    subscription: overview.subscription
      ? {
          id: overview.subscription.id,
          status: overview.subscription.status,
          planName: overview.subscription.plan.name,
          planSlug: overview.subscription.plan.slug,
          currentPeriodStart:
            overview.subscription.currentPeriodStart?.toISOString() ?? null,
          currentPeriodEnd:
            overview.subscription.currentPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: overview.subscription.cancelAtPeriodEnd,
        }
      : null,
    licenses: overview.licenses.map((lic) => ({
      id: lic.id,
      status: lic.status,
      haltNewEntries: lic.haltNewEntries,
      canAcceptNewEntries: lic.flags.canAcceptNewEntries,
      canManageOpenPositions: lic.flags.canManageOpenPositions,
      message: lic.flags.displayMessage,
      mt5Account: lic.mt5Account
        ? {
            login: lic.mt5Account.login,
            server: lic.mt5Account.server,
          }
        : null,
      exposureProfile: lic.exposureProfile?.name ?? null,
    })),
  });
}
