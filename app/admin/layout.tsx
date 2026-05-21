import { requireAppRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/layout/admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAppRole("ADMIN");

  return (
    <AdminShell
      title="Painel administrativo"
      subtitle="Monitoramento operacional, billing e controles — acesso restrito a administradores."
    >
      {children}
    </AdminShell>
  );
}
