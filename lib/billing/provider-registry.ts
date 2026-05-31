import { BillingProvider } from "@prisma/client";
import {
  ManualBillingProvider,
  MockBillingProvider,
} from "@/lib/billing/manual-provider";
import { AsaasBillingProvider } from "@/lib/billing/asaas-provider";
import type { BillingProviderAdapter } from "@/lib/billing/provider";

export function getBillingProviderAdapter(
  provider?: BillingProvider
): BillingProviderAdapter {
  const selected = provider ?? BillingProvider.MANUAL;
  if (selected === BillingProvider.MOCK) return new MockBillingProvider();
  if (selected === BillingProvider.ASAAS) return new AsaasBillingProvider();
  return new ManualBillingProvider();
}

export { defaultInvoiceDueDate } from "@/lib/billing/manual-provider";
