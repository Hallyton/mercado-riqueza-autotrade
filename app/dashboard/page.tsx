import { requireAppRole } from "@/lib/auth/session";
import { getClientDashboard } from "@/lib/dashboard/get-client-dashboard";
import { ClientDashboard } from "@/components/dashboard/client-dashboard";

export default async function DashboardPage() {
  const session = await requireAppRole("CLIENT");
  const data = await getClientDashboard(session.user.id);

  return <ClientDashboard data={data} />;
}
