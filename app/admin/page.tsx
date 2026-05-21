import { AdminOperationsDashboard } from "@/components/admin/admin-operations-dashboard";
import { canRunEmergencyActions } from "@/lib/admin/permissions";
import { getAdminOperationsDashboard } from "@/lib/admin/overview";
import { requireAppRole } from "@/lib/auth/session";

export default async function AdminPage() {
  const session = await requireAppRole("ADMIN");
  const adminRole = session.user.role ?? "OPS";
  const data = await getAdminOperationsDashboard();

  return (
    <AdminOperationsDashboard
      data={data}
      adminRole={adminRole}
      canEmergency={canRunEmergencyActions(adminRole)}
    />
  );
}
