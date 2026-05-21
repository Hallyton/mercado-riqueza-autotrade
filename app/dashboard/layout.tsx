import { requireAppRole } from "@/lib/auth/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAppRole("CLIENT");

  return (
    <DashboardShell
      title="Dashboard"
      subtitle="Status, resultado e evolução patrimonial — sem exposição de estratégia ou parâmetros internos."
    >
      {children}
    </DashboardShell>
  );
}
