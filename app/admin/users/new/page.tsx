import Link from "next/link";
import { CreateUserForm } from "@/components/admin/create-user-form";
import { listPlansForAdminCreate } from "@/lib/admin/users";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminNewUserPage() {
  const plans = await listPlansForAdminCreate();

  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="text-sm text-gold hover:underline">
        ← Voltar aos usuários
      </Link>

      <Card className="p-6">
        <CardHeader className="p-0">
          <CardTitle>Novo usuário</CardTitle>
          <CardDescription className="mt-2">
            Senha temporária, se gerada, é exibida uma única vez. Não é armazenada em texto claro.
          </CardDescription>
        </CardHeader>
        <div className="mt-6">
          <CreateUserForm plans={plans} />
        </div>
      </Card>
    </div>
  );
}
