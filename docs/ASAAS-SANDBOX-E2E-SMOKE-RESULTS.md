# Asaas Sandbox End-to-End Smoke — Fase 13.3.1

**Data:** 2026-05-31  
**Branch:** `staging-vps-homologacao`  
**Deploy:** https://autotrade-staging.mercadodariqueza.com.br  
**Deployment:** `dpl_gbczobh1p` (pós-config env Asaas) — **Ready**  
**Status:** `ASAAS_SANDBOX_E2E_SMOKE_APPROVED`  
**Decisão:** Provider Asaas **ativo** · cobrança/checkout **validados** · webhook PAID **processado** · idempotência **validada** · PAID **imutável** · conta real **não liberada**

---

## 1. Resumo executivo

| Área | Resultado |
|------|-----------|
| Env runtime staging | **OK** — `ASAAS_SANDBOX_RUNTIME_OK` |
| `BILLING_PROVIDER=asaas` | **Ativo** |
| `ASAAS_ENV=sandbox` | **Ativo** |
| `BILLING_REAL_PAYMENTS_ENABLED=false` | **OK** |
| `MOCK_BILLING_WEBHOOK_ENABLED=false` | **OK** |
| Fatura Asaas criada | **OK** |
| BillingCustomer | **OK** (criado/reutilizado) |
| providerPaymentId | **OK** — mascarado `pay_ef…pbg9` |
| Checkout / Pix hosted | **OK** (página Asaas sandbox) |
| Webhook PAID | **OK** — `processed: true` |
| Idempotência webhook | **OK** — `duplicate: true` |
| PAID imutável (late fail) | **OK** — `ignored: true` |
| Invoice PAID | **OK** |
| Subscription ACTIVE | **OK** |
| Portal pós-pagamento | **OK** — "Pagamento confirmado." |
| RealTradingApproval automático | **Não** |
| Conta real / ordem real | **Bloqueadas** |
| Token removido pós-teste | **OK** (operador) |

---

## 2. Validação de env

Script: `scripts/homologation/check-asaas-runtime-env.mjs`

| Probe | Resultado |
|-------|-----------|
| `POST /api/billing/webhook/asaas` | HTTP **401** `INVALID_SIGNATURE` → Asaas configurado |
| `POST /api/billing/webhook/mock` | HTTP **503** `WEBHOOK_DISABLED` |
| **status** | `ASAAS_SANDBOX_RUNTIME_OK` |

Pull local Vercel: secrets criptografados (vazio no CLI) — validação via runtime + script operador.

---

## 3. Artefatos de smoke

| Campo | Valor |
|-------|--------|
| **Usuário** | `portal-smoke-1313-20260530212108@example.com` |
| **userId** | `cmpt1br6z0000ib04icl7nwj7` |
| **subscriptionId** | `cmpt1brdo0002ib049ajziz2e` |
| **invoiceId (Asaas)** | `cmptcblws0001jo04wwag9y97` |
| **providerPaymentId** | `pay_ef…pbg9` |
| **Valor** | R$ 300,00 (`amountCents: 30000`) |
| **paidAt** | `2026-05-31T05:56:30.825Z` |
| **Fatura anterior (Manual)** | `cmpt3ahzo0044l70447agvdsg` — preservada (PAID · Manual) |

---

## 4. Fluxo E2E executado

### 4.1 Cobrança Asaas sandbox

- Login cliente **OK**
- `POST /api/me/billing/invoices/request` → fatura `cmptcblws0001jo04wwag9y97` · provider **ASAAS** · R$ 300
- Checkout hosted `sandbox.asaas.com/i/efunfd39uzugpbg9` · Pix copia e cola **OK** (página Asaas)
- Faturas Manual antigas **preservadas**

### 4.2 Webhook sandbox (operador)

Script executado com sucesso (token removido do ambiente após uso):

```bash
node scripts/homologation/asaas-webhook-complete.mjs cmptcblws0001jo04wwag9y97 pay_efunfd39uzugpbg9
```

| Evento | HTTP | Resultado |
|--------|------|-----------|
| **webhookFirst** (`PAYMENT_CONFIRMED`) | 200 | `processed: true`, `duplicate: false` |
| **webhookDuplicate** (reenvio) | 200 | `duplicate: true`, `processed: false` |
| **webhookLateFail** (falha tardia) | 200 | `ignored: true`, `processed: false` |

### 4.3 Estado pós-webhook (staging)

| Campo | Valor |
|-------|--------|
| invoice.status | **PAID** |
| paidAt | **Preenchido** |
| provider | **ASAAS** |
| subscription.status | **ACTIVE** |
| adminPaymentStatus | **CONFIRMED** (via `activateCommercialSubscriptionFromPayment`) |
| PaymentProviderEvent | **Criado** (primeiro evento) |
| rawJson | **Redigido** (política `redactBillingPayload`) |
| Portal copy | **"Pagamento confirmado."** |

---

## 5. Idempotência e PAID imutável

| Regra | Validado |
|-------|----------|
| Reenvio mesmo evento → `duplicate: true` | **Sim** |
| Invoice não duplica efeitos | **Sim** (permanece PAID) |
| Evento late fail após PAID → `ignored: true` | **Sim** |
| Invoice não regride para FAILED/CANCELLED | **Sim** |

---

## 6. Segurança

| Regra | Estado |
|-------|--------|
| RealTradingApproval automático | **Não** |
| Conta real liberada por pagamento | **Não** |
| Dispatch automático | **Desativado** |
| Ordem real | **Nenhuma** |
| Estratégia exposta | **Não** |
| ASAAS_API_KEY / WEBHOOK_TOKEN expostos | **Não** |
| Token permaneceu no ambiente | **Não** (removido após teste) |
| Produção Asaas bloqueada | **Sim** (`BILLING_REAL_PAYMENTS_ENABLED=false`) |

Pagamento confirmado **não libera operação real** — continua exigindo RealTradingApproval, PRE_MARKET, preflight e protection report.

---

## 7. Restrições menores remanescentes (não bloqueiam aprovação)

1. **Pix no portal** — `pixCopyPaste` null no portal cliente; Pix visível na página hosted Asaas (limitação sandbox/API QR documentada na 13.3).
2. **Mark-paid UI fresh PENDING** — pendência herdada 13.2.x (fora de escopo Asaas).
3. **Pull Vercel local** — secrets criptografados no CLI.

---

## 8. Scripts de homologação

| Script | Função |
|--------|--------|
| `check-asaas-runtime-env.mjs` | Valida pull + sonda runtime |
| `asaas-sandbox-e2e-smoke-1331.ts` | Smoke HTTP E2E |
| `asaas-webhook-complete.mjs` | Webhook + idempotência (token via env, nunca commitar) |
| `fetch-invoice-url.mjs` | Metadados fatura sem secrets |

---

## 9. Próxima fase

**Fase 14.1 — Production Billing Gate & Commercial Launch Preparation**

ou **Fase 14.1 — Multi-Robot Commercial Scaling & Production Billing Readiness**

---

*Mercado da Riqueza AutoTrade — smoke Asaas sandbox aprovado. Nenhum secret registrado neste documento.*
