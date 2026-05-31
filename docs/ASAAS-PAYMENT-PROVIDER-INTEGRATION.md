# Asaas Payment Provider Integration — Fase 13.3

**Data:** 2026-05-31  
**Branch:** `staging-vps-homologacao`  
**Status:** `ASAAS_PAYMENT_PROVIDER_IMPLEMENTED` · E2E sandbox **pendente** (`ASAAS_SANDBOX_E2E_PENDING_CREDENTIALS`)  
**Consolidação Fase 13:** [`PHASE-13-COMMERCIAL-BILLING-FINAL-REPORT.md`](PHASE-13-COMMERCIAL-BILLING-FINAL-REPORT.md)

---

## 1. Objetivo

Integrar o **Asaas** como provider de cobrança Pix/checkout para o plano **AutoTrade Single Robot (R$ 300,00/mês)**, com customer, payment, webhook idempotente, portal cliente, painel admin e testes automatizados — **somente sandbox/staging nesta fase**.

---

## 2. Decisão por Asaas

| Critério | Asaas |
|----------|-------|
| Pix nativo + invoiceUrl | Sim |
| Sandbox dedicado | `https://api-sandbox.asaas.com/v3` |
| Webhooks documentados | `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, etc. |
| Reversível | Provider selector + manual/mock preservados |

---

## 3. Variáveis de ambiente

| Variável | Uso |
|----------|-----|
| `BILLING_PROVIDER` | `manual` \| `mock` \| `asaas` |
| `BILLING_REAL_PAYMENTS_ENABLED` | `false` em staging (obrigatório) |
| `MOCK_BILLING_WEBHOOK_ENABLED` | mock/manual webhook |
| `ASAAS_ENV` | `sandbox` (staging) ou `production` |
| `ASAAS_API_KEY` | API key sandbox — **nunca commitar** |
| `ASAAS_WEBHOOK_TOKEN` / `ASAAS_WEBHOOK_SECRET` | Header `asaas-access-token` |
| `ASAAS_BASE_URL_SANDBOX` | default `https://api-sandbox.asaas.com/v3` |
| `ASAAS_BASE_URL_PRODUCTION` | default `https://api.asaas.com/v3` |
| `ASAAS_SANDBOX_DEFAULT_CPF` | CPF teste sandbox para customer |

**Guards:**

- `ASAAS_ENV=production` + `BILLING_REAL_PAYMENTS_ENABLED !== true` → `REAL_BILLING_DISABLED`
- `ASAAS_API_KEY` ausente → `ASAAS_NOT_CONFIGURED`
- Webhook produção sem token → bloqueado

---

## 4. Arquitetura

```
Portal/Admin → invoice-service / asaas-invoice-service
                    ↓
              asaas-client (REST v3)
                    ↓
              Asaas Sandbox API
                    ↓
         POST /api/billing/webhook/asaas
                    ↓
           webhook-service (idempotente)
                    ↓
         applyInvoicePaidEffects (sem RealTradingApproval)
```

**Arquivos principais:**

| Arquivo | Função |
|---------|--------|
| `lib/billing/asaas-client.ts` | HTTP client seguro |
| `lib/billing/asaas-customer.ts` | BillingCustomer + create customer |
| `lib/billing/asaas-provider.ts` | Adapter billing |
| `lib/billing/asaas-webhook.ts` | normalize + verify token |
| `lib/billing/asaas-invoice-service.ts` | provision/sync/cancel |
| `lib/billing/provider-registry.ts` | Factory manual/mock/asaas |
| `prisma` `BillingCustomer` | Mapeamento user ↔ Asaas customer |

---

## 5. Fluxo customer Asaas

1. `ensureAsaasBillingCustomer(userId)` busca `BillingCustomer` local.
2. Se ausente, cria customer no Asaas sandbox (`POST /customers`).
3. Persiste `providerCustomerId`, email, name, `externalReference=userId`.
4. `rawJson` redigido — não exposto ao cliente.

---

## 6. Fluxo cobrança Pix

1. Invoice interna criada (`PENDING`, R$ 300).
2. `provisionAsaasPaymentForInvoice(invoiceId)`:
   - `POST /payments` · `billingType: PIX`
   - `externalReference: invoiceId`
   - `GET /payments/{id}/pixQrCode` (payload + QR base64)
3. Atualiza `Invoice`: `providerInvoiceId`, `paymentUrl`, `pixCopyPaste`, `pixQrCodeUrl`.
4. `PaymentAttempt` PIX `PENDING`.

---

## 7. Portal cliente

Rotas: `/dashboard/comercial`, `/faturas`, `/faturas/[invoiceId]`

**Asaas PENDING/OPEN:**

- Valor, vencimento, status, provider Asaas
- Botão **Abrir cobrança** (invoiceUrl)
- Pix copia e cola + **Copiar código Pix**
- QR Code Pix (quando disponível)
- Aviso: confirmação pode levar instantes
- Disclaimer: pagamento não libera conta real

**PAID:** copy "Pagamento confirmado." (Fase 13.2.3)

**Nunca expõe:** API key, webhook secret, rawJson, estratégia.

---

## 8. Admin billing

`/admin/users/[userId]` — painel faturas:

- Provider Asaas, `providerPaymentId` mascarado, status provider, Pix sim/não
- **Criar cobrança Asaas**
- **Sincronizar Asaas** (confirmação `SINCRONIZAR ASAAS`)
- **Cancelar cobrança Asaas** (confirmação `CANCELAR COBRANCA ASAAS`)
- Mark-paid manual preservado (`MARCAR FATURA PAGA`)
- AdminAction/AuditLog em todas as ações

APIs:

- `POST /api/admin/billing/invoices/[invoiceId]/asaas/create-payment`
- `POST /api/admin/billing/invoices/[invoiceId]/asaas/sync`
- `POST /api/admin/billing/invoices/[invoiceId]/asaas/cancel`

---

## 9. Webhook Asaas

**Endpoint:** `POST /api/billing/webhook/asaas`

**Auth:** header `asaas-access-token` = `ASAAS_WEBHOOK_TOKEN`

**Eventos mapeados:**

| Evento Asaas | Efeito interno |
|--------------|----------------|
| `PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED` | Invoice PAID + efeitos comerciais |
| `PAYMENT_OVERDUE` | Invoice OVERDUE |
| `PAYMENT_DELETED` / refund | Invoice CANCELLED |
| Falha cartão / reprovado | Invoice FAILED |

**Idempotência:** `unique(provider, eventId)` · duplicata → `duplicate: true`

**PAID imutável:** evento tardio failed/overdue ignorado

**rawJson:** redigido via `redactAsaasPayload`

**Sandbox:** webhook permitido com `ASAAS_ENV=sandbox` mesmo com `BILLING_REAL_PAYMENTS_ENABLED=false`

---

## 10. Segurança comercial

| Regra | Estado |
|-------|--------|
| Pagamento PAID cria RealTradingApproval | **Não** |
| Pagamento PAID libera conta real | **Não** |
| Dispatch automático | **Desativado** |
| Ordem real | **Nenhuma** |
| Estratégia exposta | **Não** |

---

## 11. Recorrência futura

Campos preparados: `providerSubscriptionId`, `recurringEnabled=false` em `Subscription`.

Nesta fase: cobrança **avulsa** por Invoice; assinatura interna continua fonte da verdade.

---

## 12. Testes

| Suite | Cobertura |
|-------|-----------|
| `tests/billing/asaas-provider.test.ts` | client Pix, customer, guards |
| `tests/billing/asaas-webhook.test.ts` | normalize, auth, redact |
| `tests/billing/webhook-service.test.ts` | idempotência (herdado) |
| `tests/billing/invoice-service.test.ts` | mark-paid (herdado) |

**Resultado:** 388/388 OK

---

## 13. Pendências — Fase 13.3.1

**Atualização Fase 13.4 (2026-05-27):** variáveis Asaas existem no projeto Vercel staging, porém **valores sandbox ainda não configurados** (env pull retorna vazios). Portal staging continua em **provider Manual**. E2E não executado — ver [`PHASE-13-COMMERCIAL-BILLING-FINAL-REPORT.md`](PHASE-13-COMMERCIAL-BILLING-FINAL-REPORT.md).

1. Configurar credenciais sandbox no Vercel staging (`ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `BILLING_PROVIDER=asaas`, `ASAAS_ENV=sandbox`, `BILLING_REAL_PAYMENTS_ENABLED=false`).
2. Smoke E2E: solicitar fatura → Pix → webhook → PAID → portal/admin.
3. Confirmar chave Pix registrada no dashboard Asaas sandbox (requisito Pix QR).

**Próxima fase:** Fase 13.3.1 — Asaas Sandbox End-to-End Payment Smoke

---

*Mercado da Riqueza AutoTrade — integração Asaas sandbox. Nenhum secret registrado neste documento.*
