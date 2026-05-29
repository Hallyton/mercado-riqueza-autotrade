import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RealTradingApprovalForm } from "@/components/admin/real-trading-approval-form";
import prisma from "@/lib/prisma";
import { LicenseStatus } from "@prisma/client";

export default async function AdminNewRealTradingApprovalPage() {
  const licenses = await prisma.license.findMany({
    where: { status: LicenseStatus.ACTIVE },
    take: 50,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { email: true } },
      mt5Account: true,
    },
  });

  const options = licenses.map((l) => ({
    licenseId: l.id,
    userId: l.userId,
    clientEmail: l.user.email,
    mt5Label: l.mt5Account
      ? `${l.mt5Account.login} @ ${l.mt5Account.server}`
      : null,
  }));

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <CardHeader className="p-0">
          <CardTitle>Nova aprovação de conta real</CardTitle>
          <CardDescription className="mt-2">
            Gate administrativo obrigatório. Cliente não pode criar aprovação via API
            pública.
          </CardDescription>
        </CardHeader>
      </Card>
      <RealTradingApprovalForm licenses={options} />
    </div>
  );
}
