# Billing Gateway Automation Flow — Mercado da Riqueza AutoTrade

**Fase:** 13.2 — Payment Gateway & Billing Automation  
**Status:** `BILLING_AUTOMATION_FOUNDATION_IMPLEMENTED`  
**Data:** 2026-05-30

---

## 1. Objetivo

Base de cobrança para o plano **AutoTrade Single Robot** (R$ 300,00/mês · 1 robô), com faturas, tentativas de pagamento, webhooks idempotentes e modo **manual/sandbox** — **sem** cobrança real sem env explícito e **sem** liberar conta real automaticamente.

---

## 2. Plano comercial

| Campo | Valor |
|-------|--------|
| Plano | AutoTrade Single Robot |
| Preço | R$ 300,00 / mês (`30000` centavos) |
| Robôs (fase) | 1 |
| Futuro | até 4 (aprovação admin) |

---

## 3. Modelos

| Modelo | Função |
|--------|--------|
| `Invoice` | Fatura mensal — OPEN/PENDING → PAID |
| `PaymentAttempt` | Tentativa de pagamento (PIX/CARD/MANUAL) |
| `PaymentProviderEvent` | Eventos de gateway — idempotência |
| `Subscription` | `nextBillingAt`, `lastInvoiceId`, `adminPaymentStatus` |

Status de fatura: `DRAFT`, `OPEN`, `PENDING`, `PAID`, `OVERDUE`, `CANCELLED`, `VOID`, `FAILED`.

---

## 4. Provider abstraction

| Provider | Modo |
|----------|------|
| `MANUAL` | Padrão — confirmação admin |
| `MOCK` | Sandbox — webhook de teste |
| `ASAAS` / `MERCADO_PAGO` / `STRIPE` | Estrutura futura (sem credenciais nesta fase) |

Env:

- `BILLING_PROVIDER=manual|mock`
- `BILLING_REAL_PAYMENTS_ENABLED=false` (obrigatório para bloquear cartão/Pix real)
- `MOCK_BILLING_WEBHOOK_ENABLED=true` (sandbox em staging/dev)

---

## 5. Fluxo

1. Cadastro/solicitação → `Subscription` INCOMPLETE + `Invoice` OPEN/PENDING.  
2. Cliente vê faturas em `/dashboard/comercial` e `/dashboard/comercial/faturas`.  
3. Admin marca fatura paga (`MARCAR FATURA PAGA`) ou confirma pagamento comercial legado.  
4. `Invoice` PAID → assinatura ACTIVE + licença/robô comercial.  
5. **Conta real** continua exigindo RealTradingApproval + PRE_MARKET + preflight + protection.  
6. Webhook mock: `POST /api/billing/webhook/mock` (idempotente).

---

## 6. APIs

### Cliente

| Método | Rota |
|--------|------|
| GET | `/api/me/billing/invoices` |
| POST | `/api/me/billing/invoices/request` |
| GET | `/api/me/billing/invoices/[invoiceId]` |

### Admin

| Método | Rota |
|--------|------|
| GET/POST | `/api/admin/billing/invoices` |
| POST | `/api/admin/billing/invoices/[id]/mark-paid` |
| POST | `/api/admin/billing/invoices/[id]/cancel` |
| POST | `/api/admin/billing/invoices/[id]/mark-pending` |

### Webhook

| Método | Rota |
|--------|------|
| POST | `/api/billing/webhook/[provider]` |
| POST | `/api/webhooks/billing` (legado) |

---

## 7. Idempotência

- `PaymentProviderEvent` — unique `(provider, eventId)` + `idempotencyKey`.  
- Fatura `PAID` não regride para `FAILED`.  
- Payload `rawJson` redigido (sem secrets/tokens).

---

## 8. Invariantes

- Pagamento **não** libera conta real sozinho.  
- **Nenhuma** ordem real enviada nesta fase.  
- Dispatch automático **desativado**.  
- Estratégia **protegida** — billing não expõe vault.  
- Sem `.env` commitado · sem secrets na UI.

---

## 9. Próxima fase

**Fase 13.3 — Payment Provider Integration** (Asaas/Mercado Pago/Stripe com credenciais)  
ou **Fase 13.3 — Multi-Robot Admin Scaling**

---

*Mercado da Riqueza AutoTrade — billing foundation v1.*
