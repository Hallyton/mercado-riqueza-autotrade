import { BillingProvider } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  createAsaasCustomer,
  getAsaasCustomer,
} from "@/lib/billing/asaas-client";
import { getSandboxDefaultCpfCnpj } from "@/lib/billing/asaas-config";
import { redactAsaasPayload } from "@/lib/billing/asaas-redact";

export async function ensureAsaasBillingCustomer(userId: string) {
  const existing = await prisma.billingCustomer.findUnique({
    where: {
      provider_userId: {
        provider: BillingProvider.ASAAS,
        userId,
      },
    },
  });

  if (existing) {
    return existing;
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, name: true, phone: true },
  });

  const remote = await createAsaasCustomer({
    name: user.name?.trim() || user.email,
    email: user.email,
    cpfCnpj: getSandboxDefaultCpfCnpj(),
    mobilePhone: user.phone,
    externalReference: user.id,
  });

  if (!remote.id) {
    throw new Error("Asaas não retornou providerCustomerId.");
  }

  return prisma.billingCustomer.create({
    data: {
      userId: user.id,
      provider: BillingProvider.ASAAS,
      providerCustomerId: remote.id,
      email: user.email,
      name: user.name?.trim() || user.email,
      cpfCnpj: getSandboxDefaultCpfCnpj(),
      phone: user.phone,
      externalReference: user.id,
      rawJson: redactAsaasPayload(remote) as object,
    },
  });
}

export async function getAsaasBillingCustomer(userId: string) {
  const local = await prisma.billingCustomer.findUnique({
    where: {
      provider_userId: {
        provider: BillingProvider.ASAAS,
        userId,
      },
    },
  });

  if (!local) return null;

  try {
    const remote = await getAsaasCustomer(local.providerCustomerId);
    await prisma.billingCustomer.update({
      where: { id: local.id },
      data: { rawJson: redactAsaasPayload(remote) as object },
    });
  } catch {
    // best-effort sync
  }

  return local;
}
