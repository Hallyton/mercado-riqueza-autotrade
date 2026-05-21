import { z } from "zod";

export const billingWebhookEventSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "payment.approved",
    "payment.failed",
    "subscription.renewed",
    "subscription.cancelled",
    "chargeback",
  ]),
  gateway: z.enum(["asaas", "mercado_pago", "stripe", "manual"]),
  data: z.object({
    /** ID interno da assinatura (preferencial). */
    subscriptionId: z.string().optional(),
    /** ID da assinatura no gateway. */
    gatewaySubscriptionId: z.string().optional(),
    /** Referência externa (userId ou subscriptionId). */
    externalReference: z.string().optional(),
    userId: z.string().optional(),
    planSlug: z.enum(["start", "pro", "black"]).optional(),
    amountCents: z.number().int().positive().optional(),
    currency: z.string().default("BRL"),
    paidAt: z.string().datetime().optional(),
    periodEnd: z.string().datetime().optional(),
    customerId: z.string().optional(),
  }),
});

export type BillingWebhookEvent = z.infer<typeof billingWebhookEventSchema>;
