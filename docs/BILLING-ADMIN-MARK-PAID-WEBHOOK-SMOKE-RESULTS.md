# Billing Admin Mark-Paid & Mock Webhook — Fase 13.2.2

**Data:** 2026-05-31  
**Branch:** `staging-vps-homologacao`  
**Commit base:** `001dce1` — docs: record billing manual sandbox smoke test  
**Deploy:** https://autotrade-staging.mercadodariqueza.com.br  
**Deployment (env + admin sync):** `dpl_Huz3zwruW3VjEZcHDrWQbqqCgqsM` — **Ready**  
**Status:** `APPROVED_WITH_RESTRICTIONS`  
**Decisão operacional:** `LIVE_ORDER_VALIDATION_DEFERRED` mantido · nenhuma ordem real · dispatch automático desativado · gateway real não integrado

---

## 1. Resumo executivo

| Área | Resultado |
|------|-----------|
| Admin login browser staging | **OK** (após `SYNC_ADMIN_PASSWORD_ON_BUILD` no deploy) |
| Vercel env mock billing | **OK** (`MOCK_BILLING_WEBHOOK_ENABLED`, `BILLING_PROVIDER=manual`, `BILLING_REAL_PAYMENTS_ENABLED=false`) |
| Webhook mock `POST /api/billing/webhook/mock` | **OK** (HTTP 200, `processed: true`) |
| Idempotência webhook (duplicata) | **OK** (`duplicate: true`, `processed: false`) |
| PAID imutável (evento `payment.failed` tardio) | **OK** (`ignored: true`) |
| Provider desconhecido | **OK** (HTTP 404) |
| Admin painel `/admin/users/[userId]` | **OK** (fatura **Paga**, assinatura **ACTIVE**) |
| Admin mark-paid API (idempotente) | **OK** (`alreadyPaid: true`) |
| Admin mark-paid UI em fatura **PENDING** | **Não exercido** (fatura já PAID antes do clique UI) |
| Portal pós-pagamento (browser) | **OK** (fatura PAID R$ 300; aviso conta real) |
| Subscription atualizada | **OK** (ACTIVE · Pagamento CONFIRMED · Robôs 1/1 no admin) |
| RealTradingApproval automático | **Não** (0 registros para usuário smoke) |
| Conta real / ordem real | **Bloqueadas** |
| Login admin/cliente via fetch programático | **Pendente** (302 / session null — só browser OK) |

---

## 2. Artefatos de teste (herdados da 13.2.1)

| Campo | Valor |
|-------|--------|
| **Usuário smoke** | `portal-smoke-1313-20260530212108@example.com` |
| **userId** | `cmpt1br6z0000ib04icl7nwj7` |
| **subscriptionId** | `cmpt1brdo0002ib049ajziz2e` |
| **invoiceId** | `cmpt3ahzo0044l70447agvdsg` |
| **Valor** | R$ 300,00 (`amountCents: 30000`, BRL, manual) |

---

## 3. Admin staging — acesso browser

### 3.1 Problema da 13.2.1

Login admin browser falhou: credencial local ≠ hash no Neon staging.

### 3.2 Solução aplicada

| Item | Detalhe |
|------|---------|
| Script build | `scripts/homologation/sync-staging-admin-from-env.ts` |
| Opt-in | `SYNC_ADMIN_PASSWORD_ON_BUILD=true` no Vercel staging |
| Hash | bcrypt cost 12 · upsert `ADMIN_EMAIL` / `ADMIN_PASSWORD` do ambiente |
| Saída build | `[sync-staging-admin] email: admin@mercadodariqueza.com.br` · `userId: cmpj3nfdy002dsxeoie8s2jyt` · `role: SUPERADMIN` · `ADMIN_SYNC_OK` |
| Script alternativo | `scripts/homologation/reset-staging-admin-password.ts` (requer `DATABASE_URL` no shell — `vercel env pull` retorna vazio para Neon) |

**Regra:** nenhuma senha, hash ou `DATABASE_URL` registrados neste documento.

### 3.3 Validação browser

| Critério | Resultado |
|----------|-----------|
| Login `/login` como SUPERADMIN | **OK** |
| `/admin` acessível | **OK** |
| `/admin/users/cmpt1br6z0000ib04icl7nwj7` | **OK** |

---

## 4. Vercel staging — env billing (sem expor valores)

Variáveis configuradas no projeto `mercado-riqueza-autotrade-staging` (production target = staging):

| Variável | Estado |
|----------|--------|
| `MOCK_BILLING_WEBHOOK_ENABLED` | `true` |
| `BILLING_PROVIDER` | `manual` |
| `BILLING_REAL_PAYMENTS_ENABLED` | `false` |
| `SYNC_ADMIN_PASSWORD_ON_BUILD` | `true` |

Redeploy com build sync admin: **Ready** · alias `autotrade-staging.mercadodariqueza.com.br` atualizado.

---

## 5. Webhook mock

Script: `scripts/homologation/billing-admin-webhook-smoke-13222.ts` (usa secret do `.env.staging.pull` local — **não commitado**).

| Teste | HTTP | Corpo (campos relevantes) |
|-------|------|---------------------------|
| Primeiro `payment.approved` | **200** | `processed: true`, `duplicate: false` |
| Mesmo evento (idempotencyKey) | **200** | `processed: false`, `duplicate: true` |
| `payment.failed` tardio em fatura PAID | **200** | `ignored: true`, `processed: false` |
| `POST /api/billing/webhook/unknown-provider` | **404** | provider bloqueado |

**PaymentProviderEvent:** criado no primeiro evento (validação inferida por idempotência; `rawJson` redigido conforme testes unitários `tests/billing/webhook-service.test.ts`).

**Antes da 13.2.2:** webhook retornava **503** `WEBHOOK_DISABLED`.

---

## 6. Admin mark-paid

### 6.1 Estado antes/depois da fatura

| Campo | Antes (13.2.1) | Depois (13.2.2) |
|-------|-----------------|-----------------|
| `Invoice.status` | `PENDING` | `PAID` |
| `paidAt` | null | preenchido |
| Portal cliente | Pendente | **Paga** |
| Subscription (admin) | INCOMPLETE / pendente | **ACTIVE** · Pagamento **CONFIRMED** · Robôs **1/1** |

**Nota:** a transição para PAID ocorreu durante validação do webhook mock (primeiro evento `payment.approved` na fatura). O mark-paid admin foi validado em modo **idempotente** (`alreadyPaid: true`, HTTP 200) — confirmação `MARCAR FATURA PAGA` via API autenticada no browser; botão UI em fatura **PENDING** não foi o caminho primário nesta sessão.

### 6.2 Efeitos comerciais observados (admin)

| Critério | Resultado |
|----------|-----------|
| Fatura listada como **Paga** | OK |
| Assinatura **ACTIVE** | OK |
| `RealTradingApproval` criado | **Não** |
| Licença/robô automático via mark-paid idempotente | `licenseId: null`, `robotInstanceId: null` (já provisionados ou N/A neste replay) |

---

## 7. Portal cliente pós-pagamento (browser)

| Rota | Resultado |
|------|-----------|
| `/dashboard/comercial` | Fatura atual **R$ 300,00 · Paga** · aviso conta real |
| `/dashboard/comercial/faturas` | Lista **Paga · R$ 300,00** |
| `/dashboard/comercial/faturas/cmpt3ahzo0044l70447agvdsg` | Detalhe acessível · copy de conta real / aprovação |

| Critério | Resultado |
|----------|-----------|
| Plano R$ 300 visível | OK |
| Status PAID | OK (lista e comercial) |
| Token/secret/estratégia | **Não expostos** |
| Conta real liberada | **Não** (avisos explícitos) |
| Robô no portal cliente | "Nenhum robô provisionado" (admin mostra 1/1 — divergência UI menor) |

**Restrição UI:** página de detalhe da fatura exibe simultaneamente texto de pagamento confirmado e "Aguardando confirmação administrativa" — revisar copy na Fase 13.3 ou hotfix UX.

---

## 8. Regras de segurança real

| Critério | Resultado |
|----------|-----------|
| Pagamento PAID cria `RealTradingApproval` | **Não** |
| Pagamento PAID altera `ENABLE_REAL_TRADING` | **Não** |
| Pagamento PAID ativa dispatch automático | **Não** |
| Pagamento PAID envia instruction/ordem real | **Não** |
| Preflight REAL | Continua exigindo approval + PRE_MARKET + margem + EA online + protection (herdado 12.x) |
| Gateway real (Stripe/etc.) | **503** `REAL_BILLING_DISABLED` |

---

## 9. Invariantes operacionais

| Item | Estado |
|------|--------|
| Nenhuma ordem real enviada | Confirmado |
| Dispatch automático desativado | Confirmado |
| Estratégia não exposta | Confirmado |
| Secrets no log/doc | Nenhum |

---

## 10. Restrições remanescentes

1. **Mark-paid UI** em fatura fresh `PENDING` → repetir com nova fatura smoke se exigir evidência do botão + frase `MARCAR FATURA PAGA` end-to-end.
2. **Login programático** (`fetch` / script smoke session): admin e cliente retornam 302 / HTML — operação manual browser permanece válida; corrigir em fase operacional se necessário.
3. **Copy inconsistente** no detalhe da fatura paga (portal).
4. **`vercel env pull`**: `DATABASE_URL` vazio — usar sync no build ou export manual no shell para `reset-staging-admin-password.ts`.
5. **Portal robôs** vs admin robôs 1/1 — validar provisionamento visível ao cliente.

**Próxima fase sugerida:** Fase 13.3 — Payment Provider Integration (gateway real), após fechar restrições opcionais acima.

---

## 11. Scripts adicionados (repo)

| Script | Uso |
|--------|-----|
| `sync-staging-admin-from-env.ts` | Build staging — sync admin hash |
| `reset-staging-admin-password.ts` | Reset manual Neon via shell env |
| `run-reset-staging-admin-from-vercel-pull.ts` | Wrapper pull (DATABASE_URL vazio no pull atual) |
| `billing-admin-webhook-smoke-13222.ts` | Smoke HTTP webhook + mark-paid |

---

## 12. Fase 13.2.3 — correção de consistência visual

**Documento:** [`BILLING-PORTAL-UI-CONSISTENCY-FIX-RESULTS.md`](BILLING-PORTAL-UI-CONSISTENCY-FIX-RESULTS.md)  
**Status:** `APPROVED_WITH_RESTRICTIONS`

| Restrição 13.2.2 | Fechamento 13.2.3 |
|------------------|-------------------|
| Copy detalhe fatura PAID inconsistente | **OK** |
| Portal "Nenhum robô provisionado" vs admin 1/1 | **OK** |
| Mark-paid UI fresh PENDING | **Pendente** browser (confirmado Fase 13.4) |

---

## 13. Fase 13.4 — consolidação

**Documento:** [`PHASE-13-COMMERCIAL-BILLING-FINAL-REPORT.md`](PHASE-13-COMMERCIAL-BILLING-FINAL-REPORT.md)

| Item | Resultado 13.4 |
|------|----------------|
| Webhook mock idempotência | **Revalidado OK** |
| Portal / fatura PAID browser | **OK** |
| Mark-paid fresh PENDING UI | **Pendente** |
| Asaas E2E | **Pendente** credenciais |

---

*Mercado da Riqueza AutoTrade — smoke admin + webhook mock. Nenhum segredo, DATABASE_URL, token ou Bearer registrado neste documento.*
