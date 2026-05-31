# Billing Manual/Sandbox Smoke Results — Fase 13.2.1

**Data:** 2026-05-31  
**Branch:** `staging-vps-homologacao`  
**Commit base:** `e641af9` — feat: add billing automation foundation  
**Deploy:** https://autotrade-staging.mercadodariqueza.com.br  
**Status:** `APPROVED_WITH_RESTRICTIONS`  
**Decisão operacional:** `LIVE_ORDER_VALIDATION_DEFERRED` mantido · nenhuma ordem real enviada · dispatch automático desativado

---

## 1. Resumo executivo

| Área | Resultado |
|------|-----------|
| Ambiente staging (provider manual, real off) | **OK** (inferido por UI + respostas HTTP) |
| Migration billing foundation | **OK** (Invoice/PaymentAttempt operacionais) |
| Portal `/dashboard/comercial` — faturas | **OK** |
| Portal `/dashboard/comercial/faturas` | **OK** |
| Portal `/dashboard/comercial/faturas/[invoiceId]` | **OK** |
| Solicitar fatura (UI) | **OK** |
| API fatura (browser autenticado) | **OK** (`amountCents=30000`, `BRL`, `PENDING`, manual) |
| Admin mark-paid (browser) | **Pendente** (credencial admin local ≠ Neon staging) |
| Webhook mock | **Pendente** (`MOCK_BILLING_WEBHOOK_ENABLED` não habilitado no staging) |
| Idempotência webhook | **Pendente** (depende de mock habilitado) |
| Isolamento cliente / bloqueio admin | **OK** |
| Provider desconhecido / real off | **OK** |
| RealTradingApproval pós-pagamento | **OK** (fatura ainda pendente; gate herdado de 13.2 + testes unitários) |
| Conta real / ordem real | **Bloqueadas** |

---

## 2. Usuário utilizado

| Campo | Valor |
|-------|--------|
| **Usuário principal** | `portal-smoke-1313-20260530212108@example.com` |
| **userId** | `cmpt1br6z0000ib04icl7nwj7` |
| **subscriptionId** | `cmpt1brdo0002ib049ajziz2e` |
| **Origem** | Usuário smoke da Fase 13.1.3 (sessão browser persistente no staging) |

**Nota:** tentativa de cadastro `billing-smoke-13121-20260531@example.com` retornou HTTP 409 (e-mail já existente de tentativa anterior). Smoke principal reutilizou o usuário 13.1.3 com sessão browser válida.

---

## 3. Validação de ambiente (sem expor secrets)

Validação por comportamento observado — **nenhum valor de env impresso**.

| Variável / item | Evidência | Resultado |
|-----------------|-----------|-----------|
| `BILLING_PROVIDER` manual/mock | UI: método **Manual** · API: `providerLabel` = "Manual / administrativo" | **OK** (manual) |
| `BILLING_REAL_PAYMENTS_ENABLED=false` | `POST /api/billing/webhook/stripe` → HTTP **503** `REAL_BILLING_DISABLED` | **OK** |
| `MOCK_BILLING_WEBHOOK_ENABLED` | `POST /api/billing/webhook/mock` → HTTP **503** `WEBHOOK_DISABLED` | **Não habilitado no staging** |
| `DATABASE_URL` Neon staging | Deploy operacional + CRUD de Invoice no staging | **OK** (inferido) |
| Migration `20260530230000_billing_automation_foundation` | Criação/listagem/detalhe de Invoice via API autenticada | **OK** (aplicada) |

**Ação recomendada antes da Fase 13.3:** definir no Vercel staging `MOCK_BILLING_WEBHOOK_ENABLED=true` (mantendo `BILLING_REAL_PAYMENTS_ENABLED=false`) para repetir smoke de webhook/idempotência.

---

## 4. Portal cliente

### 4.1 `/dashboard/comercial`

| Critério | Resultado |
|----------|-----------|
| Seção **Faturas e pagamento** | OK |
| Plano R$ 300,00 visível | OK |
| Fatura atual ou botão solicitar | OK (após solicitar: fatura Pendente R$ 300) |
| Status de pagamento | OK ("Pagamento pendente") |
| Conta real não liberada | OK (avisos explícitos) |
| Sem token/secret/estratégia | OK |

### 4.2 `/dashboard/comercial/faturas`

| Critério | Resultado |
|----------|-----------|
| Lista de faturas do cliente | OK (1 fatura Pendente R$ 300,00) |
| Cliente vê apenas suas faturas | OK |
| Status, valor e vencimento | OK |

### 4.3 `/dashboard/comercial/faturas/[invoiceId]`

**URL validada:** `/dashboard/comercial/faturas/cmpt3ahzo0044l70447agvdsg`

| Critério | Resultado |
|----------|-----------|
| Detalhes da fatura | OK |
| Valor R$ 300 | OK (`amountCents: 30000`) |
| Status Pendente | OK |
| Método manual | OK |
| Aviso pagamento ≠ conta real | OK |

**Resposta API (browser autenticado, campos não sensíveis):**

```json
{
  "id": "cmpt3ahzo0044l70447agvdsg",
  "status": "PENDING",
  "amountCents": 30000,
  "currency": "BRL",
  "providerLabel": "Manual / administrativo",
  "methodLabel": "Manual"
}
```

---

## 5. Solicitar fatura

| Critério | Resultado |
|----------|-----------|
| Ação UI "Solicitar pagamento / renovar" | OK |
| Invoice criada `PENDING` | OK |
| `amountCents = 30000` | OK |
| `currency = BRL` | OK |
| Subscription vinculada | OK (`subscriptionId` acima) |
| PaymentAttempt criado (server-side) | OK (fluxo `createSubscriptionInvoice` + `methodLabel: Manual`; ID não exposto na API cliente) |
| RealTradingApproval criado | **Não** |
| Dispatch automático | **Não** |
| Conta real liberada | **Não** |

**invoiceId:** `cmpt3ahzo0044l70447agvdsg`  
**paymentAttemptId:** não exposto ao cliente (criação confirmada pelo serviço; validação admin pendente por login)

---

## 6. Admin billing

| Critério | Resultado |
|----------|-----------|
| Login admin browser (`admin@mercadodariqueza.com.br`) | **Falhou** — credencial do `.env` local não corresponde ao Neon staging |
| Painel `/admin/users/[userId]` | **Não revalidado em browser nesta sessão** |
| Mark-paid `MARCAR FATURA PAGA` | **Pendente** |
| AdminAction/AuditLog após mark-paid | **Pendente** |
| Cobertura de código | **OK** em `tests/billing/invoice-service.test.ts` (mark-paid sem RealTradingApproval) |

**Herança:** fluxo admin comercial da Fase 13.1.1 (`confirm-payment` legado) permanece válido; painel billing novo não foi exercido end-to-end no browser por bloqueio de credencial.

---

## 7. Webhook mock

| Critério | Resultado |
|----------|-----------|
| `POST /api/billing/webhook/mock` | HTTP **503** `WEBHOOK_DISABLED` |
| PaymentProviderEvent criado | **Pendente** |
| Idempotência (evento duplicado) | **Pendente** |
| `rawJson` redigido | **Pendente** (coberto em `tests/billing/webhook-service.test.ts`) |
| PAID imutável por evento atrasado | **Pendente** (coberto em testes unitários) |

**Provider desconhecido:** `POST /api/billing/webhook/unknown-provider` → HTTP **404** `UNKNOWN_PROVIDER` — **OK**

---

## 8. Regras de segurança

| Critério | Resultado |
|----------|-----------|
| Cliente não vê invoice de outro cliente | OK (`GET /api/me/billing/invoices/{outroId}` → **404**) |
| Cliente não acessa admin billing | OK (`GET /api/admin/billing/invoices` → **403**) |
| Cliente bloqueado em `/admin/*` | OK (redirect para `/dashboard`) |
| Webhook provider desconhecido falha | OK (404) |
| Payloads sensíveis na UI | OK (sem token/secret/estratégia) |
| Credenciais no log | OK (não observado) |
| Ordem real enviada | **Nenhuma** |

---

## 9. Gate conta real após pagamento

| Critério | Resultado |
|----------|-----------|
| Pagamento PAID cria RealTradingApproval | **Não testado live** (fatura permanece PENDING) |
| Código 13.2 garante ausência de approval automático | OK (unit tests + `applyInvoicePaidEffects`) |
| Conta real continua travada | OK (UI + subscription INCOMPLETE + sem licença ativa) |
| Preflight REAL exige approval + PRE_MARKET + protection | **Herdado** (fases 12.x — inalterado) |

---

## 10. Invariantes operacionais

| Item | Estado |
|------|--------|
| Nenhuma ordem real enviada | Confirmado |
| Dispatch automático desativado | Confirmado |
| Estratégia não exposta | Confirmado |
| Gateway real não configurado | Confirmado |

---

## 11. Restrições e próximos passos

1. **Habilitar** `MOCK_BILLING_WEBHOOK_ENABLED=true` no Vercel staging e repetir smoke webhook/idempotência.
2. **Sincronizar** credencial admin staging (ou reset controlado) para validar mark-paid no painel `/admin/users/[userId]`.
3. Após mark-paid validado: confirmar subscription ACTIVE, licença/robô comercial, **ausência** de RealTradingApproval e conta real ainda bloqueada.

**Próxima fase sugerida:** ~~repetir 13.2.1~~ → **Fase 13.2.2** (executada) → Fase 13.3 gateway real.

---

## 12. Fase 13.2.2 — fechamento das restrições

**Documento:** [`BILLING-ADMIN-MARK-PAID-WEBHOOK-SMOKE-RESULTS.md`](BILLING-ADMIN-MARK-PAID-WEBHOOK-SMOKE-RESULTS.md)  
**Status:** `APPROVED_WITH_RESTRICTIONS`

| Restrição 13.2.1 | Fechamento 13.2.2 |
|------------------|-------------------|
| Admin mark-paid pendente (login) | **OK** — sync admin no build + login browser SUPERADMIN |
| Webhook mock 503 | **OK** — `MOCK_BILLING_WEBHOOK_ENABLED=true` + redeploy |
| Idempotência pendente | **OK** — duplicata `duplicate: true`; PAID imutável `ignored: true` |
| Subscription INCOMPLETE/PENDING | **OK** — ACTIVE · CONFIRMED (fatura `cmpt3ahzo0044l70447agvdsg` PAID) |
| RealTradingApproval automático | **OK** — não criado |
| Conta real | **OK** — continua travada |

**Pendências menores herdadas:** mark-paid UI em fatura PENDING fresh; login fetch programático; copy detalhe fatura portal.

---

*Mercado da Riqueza AutoTrade — smoke manual/sandbox billing. Nenhum segredo, DATABASE_URL ou token registrado neste documento.*
