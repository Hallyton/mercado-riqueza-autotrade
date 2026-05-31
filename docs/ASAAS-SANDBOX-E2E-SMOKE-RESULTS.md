# Asaas Sandbox End-to-End Smoke — Fase 13.3.1

**Data:** 2026-05-31  
**Branch:** `staging-vps-homologacao`  
**Deploy:** https://autotrade-staging.mercadodariqueza.com.br  
**Deployment:** `dpl_gbczobh1p` (pós-config env Asaas) — **Ready**  
**Status:** `APPROVED_WITH_RESTRICTIONS`  
**Decisão:** Provider Asaas **ativo no runtime** · cobrança/checkout **validados** · webhook PAID/idempotência **pendentes** (secrets sensíveis indisponíveis no CLI local)

---

## 1. Resumo executivo

| Área | Resultado |
|------|-----------|
| Env runtime staging | **OK** — `ASAAS_SANDBOX_RUNTIME_OK` (sonda webhook) |
| Env pull local Vercel | **Vazio** para secrets (criptografados no CLI) |
| `BILLING_PROVIDER=asaas` | **Ativo** (fatura nova = provider ASAAS) |
| `ASAAS_ENV=sandbox` | **Ativo** (checkout `sandbox.asaas.com`) |
| `BILLING_REAL_PAYMENTS_ENABLED=false` | **OK** |
| `MOCK_BILLING_WEBHOOK_ENABLED=false` | **OK** (mock webhook 503) |
| Fatura Asaas criada | **OK** |
| BillingCustomer | **OK** (cobrança Asaas criada — customer implícito) |
| providerPaymentId | **OK** — mascarado `pay_ef…pbg9` |
| Checkout / Pix | **Parcial** — Pix na página Asaas hosted; portal sem `pixCopyPaste` |
| Webhook PAID | **Pendente** |
| Idempotência webhook | **Pendente** |
| RealTradingApproval automático | **Não** |
| Conta real / ordem real | **Bloqueadas** |

---

## 2. Validação de env

### 2.1 Pull local (`vercel env pull`)

Variáveis listadas no projeto Vercel Production, porém **valores sensíveis retornam vazios** no pull local (comportamento esperado do CLI para secrets).

### 2.2 Runtime staging (sonda segura)

Script: `scripts/homologation/check-asaas-runtime-env.mjs`

| Probe | Resultado |
|-------|-----------|
| `POST /api/billing/webhook/asaas` | HTTP **401** `INVALID_SIGNATURE` → Asaas configurado |
| `POST /api/billing/webhook/mock` | HTTP **503** `WEBHOOK_DISABLED` → mock off |
| **status** | `ASAAS_SANDBOX_RUNTIME_OK` |

---

## 3. Artefatos de smoke

| Campo | Valor |
|-------|--------|
| **Usuário** | `portal-smoke-1313-20260530212108@example.com` |
| **userId** | `cmpt1br6z0000ib04icl7nwj7` |
| **subscriptionId** | `cmpt1brdo0002ib049ajziz2e` |
| **invoiceId (Asaas)** | `cmptcblws0001jo04wwag9y97` |
| **providerPaymentId** | `pay_ef…pbg9` (checkout `sandbox.asaas.com/i/efunfd39uzugpbg9`) |
| **Valor** | R$ 300,00 (`amountCents: 30000`) |
| **Fatura anterior (Manual)** | `cmpt3ahzo0044l70447agvdsg` — **preservada** (PAID · Manual) |

---

## 4. Fluxo E2E executado

### 4.1 Login cliente

**OK** — sessão browser + API (`/api/auth/callback/credentials`).

### 4.2 Solicitar fatura

**OK** — `POST /api/me/billing/invoices/request` → `invoiceId=cmptcblws0001jo04wwag9y97`, status `PENDING`.

### 4.3 Provider Asaas

| Campo | Valor |
|-------|--------|
| provider | `ASAAS` |
| providerLabel | Asaas |
| amountCents | 30000 |
| paymentUrl | `sandbox.asaas.com` |
| status | PENDING |

Faturas **Manual** antigas permanecem intactas.

### 4.4 Admin billing (API)

| Item | Resultado |
|------|-----------|
| Admin login | **OK** (`.env` local ADMIN sync) |
| Fatura provider Asaas | **OK** |
| providerPaymentId mascarado | `pay_…pbg9` |
| pixAvailable (admin) | false (QR via hosted page) |

### 4.5 Portal cliente (browser)

Rota: `/dashboard/comercial/faturas/cmptcblws0001jo04wwag9y97`

| Item | Resultado |
|------|-----------|
| Copy PENDING | "Aguardando confirmação de pagamento." |
| Botão **Abrir cobrança** | **OK** → Asaas sandbox |
| Secrets / estratégia | **Não expostos** |
| Aviso conta real | **OK** |

### 4.6 Checkout Asaas sandbox (browser)

URL hosted: `https://sandbox.asaas.com/i/efunfd39uzugpbg9`

| Item | Resultado |
|------|-----------|
| Valor | R$ 300,00 |
| Vencimento | 07/06/2026 |
| Pix copia e cola | **OK** (página Asaas — não replicado no portal) |
| QR Code Pix | **OK** (página Asaas) |

---

## 5. Webhook e pagamento PAID

### 5.1 Tentativas

| Caminho | Resultado |
|---------|-----------|
| `ASAAS_WEBHOOK_TOKEN` local | **Indisponível** (pull Vercel vazio) |
| Simulação webhook segura | **Não executada** (sem token local) |
| `receiveInCash` API local | **Não executada** (sem `ASAAS_API_KEY` local) |
| Webhook real Asaas | **Não recebido** (pagamento não confirmado no sandbox) |

### 5.2 Script para fechamento operador

Quando o operador tiver o token no shell (nunca commitar):

```bash
cmd /c "set ASAAS_WEBHOOK_TOKEN=<token sandbox> && node scripts/homologation/asaas-webhook-complete.mjs cmptcblws0001jo04wwag9y97 pay_efunfd39uzugpbg9"
```

Ou confirmar pagamento no dashboard Asaas sandbox (dispara webhook real se URL configurada):

`https://autotrade-staging.mercadodariqueza.com.br/api/billing/webhook/asaas`

### 5.3 Estado final da fatura

| Campo | Valor |
|-------|--------|
| status | **PENDING** |
| paidAt | null |

---

## 6. Idempotência

**Pendente** — depende do fechamento do webhook (§5).

---

## 7. Segurança

| Regra | Estado |
|-------|--------|
| RealTradingApproval automático | **Não** |
| Conta real liberada por pagamento | **Não** |
| Dispatch automático | **Desativado** |
| Ordem real | **Nenhuma** |
| Estratégia exposta | **Não** |
| ASAAS_API_KEY / WEBHOOK_TOKEN expostos | **Não** |
| Produção Asaas bloqueada | **Sim** (`BILLING_REAL_PAYMENTS_ENABLED=false`) |

---

## 8. Restrições remanescentes

1. **Webhook PAID + idempotência** — pendente confirmação sandbox + token local ou webhook real Asaas.
2. **Pix no portal** — `pixCopyPaste`/`pixQrCodeUrl` null no portal; Pix visível na página hosted Asaas (limitação sandbox/API QR documentada na 13.3).
3. **Pull Vercel local** — secrets criptografados; usar sonda runtime + scripts com env injetado manualmente para webhook.

---

## 9. Scripts adicionados

| Script | Função |
|--------|--------|
| `check-asaas-runtime-env.mjs` | Valida pull + sonda runtime |
| `probe-asaas-runtime-staging.mjs` | Sonda webhook Asaas/mock |
| `asaas-sandbox-e2e-smoke-1331.ts` | Smoke HTTP E2E |
| `asaas-webhook-complete.mjs` | Webhook + idempotência (requer token env) |
| `fetch-invoice-url.mjs` | Metadados fatura sem secrets |

---

## 10. Próximo passo

1. Confirmar pagamento sandbox (dashboard Asaas ou `receiveInCash` com API key).
2. Validar webhook HTTP 200 + invoice PAID + idempotência.
3. Reexecutar smoke ou `asaas-webhook-complete.mjs` com token.
4. Atualizar status para `ASAAS_SANDBOX_E2E_SMOKE_APPROVED` e Fase 13 para `PHASE_13_COMMERCIAL_BILLING_READY`.

---

*Mercado da Riqueza AutoTrade — smoke Asaas sandbox. Nenhum secret registrado neste documento.*
