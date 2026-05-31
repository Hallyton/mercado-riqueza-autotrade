# Phase 13 — Commercial & Billing Final Report (Fase 13.4)

**Data:** 2026-05-27  
**Branch:** `staging-vps-homologacao`  
**Commit base:** `dd2c5f3` — feat: add asaas payment provider integration  
**Deploy staging:** https://autotrade-staging.mercadodariqueza.com.br  
**Status final:** `PHASE_13_COMMERCIAL_BILLING_READY_WITH_RESTRICTIONS`  
**Decisão operacional:** `COMMERCIAL_PORTAL_AND_BILLING_READY_PENDING_ASAAS_E2E`

---

## 1. Status final da Fase 13

A Fase 13 está **comercialmente pronta com restrições**. Portal, cadastro, termos, assinatura, billing manual/mock, webhooks idempotentes, admin billing e integração Asaas (código) foram validados. **Asaas sandbox E2E** e **mark-paid UI em fatura PENDING fresh** permanecem pendentes por credenciais/configuração no ambiente staging.

| Gate | Resultado |
|------|-----------|
| Portal comercial | **Aprovado** (browser staging) |
| Billing manual/mock | **Aprovado** (webhook mock + idempotência HTTP 200) |
| Asaas provider (código) | **Implementado** |
| Asaas sandbox E2E | **Pendente** — `ASAAS_SANDBOX_E2E_PENDING_CREDENTIALS` |
| Admin billing | **Aprovado** (herdado 13.2.2; mark-paid fresh PENDING UI pendente) |
| Testes automatizados | **388/388 OK** |
| Build | **OK** |
| Deploy staging | **OK** (ver §12) |
| Conta real / ordem real | **Bloqueadas** |

---

## 2. Resumo das subfases

| Subfase | Status | Commit / ref |
|---------|--------|--------------|
| **13.1** — Commercial Client Portal & Subscription Flow | `COMMERCIAL_CLIENT_PORTAL_SUBSCRIPTION_FLOW_IMPLEMENTED` | `93e1b25` |
| **13.1.1** — Staging Commercial Smoke & Catalog Seed | `APPROVED_WITH_RESTRICTIONS` | `d55ad9c` |
| **13.1.2** — Commercial Terms Page & Public Copy Refinement | `COMMERCIAL_TERMS_AND_COPY_REFINED` | `2c5a6fc` |
| **13.1.3** — Client Portal Manual Smoke & Subscription Acceptance | `APPROVED_WITH_RESTRICTIONS` | `0abc4ad` |
| **13.2** — Payment Gateway & Billing Automation | `BILLING_AUTOMATION_FOUNDATION_IMPLEMENTED` | `e641af9` |
| **13.2.1** — Billing Manual/Sandbox Smoke Test | `APPROVED_WITH_RESTRICTIONS` | `001dce1` |
| **13.2.2** — Billing Admin Mark-Paid & Mock Webhook Validation | `APPROVED_WITH_RESTRICTIONS` | `30caffc` |
| **13.2.3** — Billing Portal UI Consistency Fix | `APPROVED_WITH_RESTRICTIONS` | `6029300` |
| **13.3** — Asaas Payment Provider Integration | `ASAAS_PAYMENT_PROVIDER_IMPLEMENTED_PENDING_SANDBOX_CREDENTIALS` | `dd2c5f3` |
| **13.3.1** — Asaas Sandbox E2E | **Não executada** — credenciais sandbox ausentes/vazias no staging |
| **13.4** — Commercial & Billing Final Consolidation | `PHASE_13_COMMERCIAL_BILLING_READY_WITH_RESTRICTIONS` | *(esta sessão)* |

---

## 3. O que está aprovado

- **Página `/planos`** — R$ 300/mês, 1 robô, expansão futura até 4, avisos de risco, conta real depende de aprovação, sem promessa de rentabilidade, linguagem institucional (tecnologia proprietária, lógica interna protegida).
- **`/cadastro`** — checkboxes obrigatórios, link `/termos/autotrade`, copy comercial R$ 300, aceite de riscos e conta real.
- **`/termos/autotrade`** — público, sem promessa de resultado, pagamento não libera real, PI protegida.
- **Portal `/dashboard/comercial`** — plano, assinatura, faturas R$ 300, status pagamento, aviso conta real (PRE_MARKET/preflight/protection).
- **Detalhe fatura PAID** — copy "Pagamento confirmado." (13.2.3).
- **Assinatura comercial** — ACTIVE após pagamento confirmado (smoke user).
- **Billing manual/mock** — provider Manual no portal staging; mark-paid API idempotente (13.2.2).
- **Webhook mock** — HTTP 200, idempotência `duplicate: true` na segunda entrega (validado nesta sessão).
- **Admin billing** — painel faturas, provider mascarado, mark-paid/sync/cancel Asaas implementados (UI admin herdada 13.2.2).
- **Asaas provider** — código, migration `BillingCustomer`, webhook `/api/billing/webhook/asaas`, portal Pix/checkout, testes unitários.
- **Segurança** — RealTradingApproval **não** criado por pagamento; estratégia não exposta; cliente não acessa `/admin`; secrets não exibidos no portal.
- **Conta real** — continua travada por RealTradingApproval + PRE_MARKET + margem + preflight + dispatch manual + protection report.

---

## 4. O que ficou pendente

| Pendência | Detalhe |
|-----------|---------|
| **Asaas sandbox credentials** | Variáveis `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `BILLING_PROVIDER`, `ASAAS_ENV` presentes no Vercel mas **valores vazios** no `vercel env pull` local (len=0). Portal staging exibe **Método: Manual**. |
| **Asaas E2E smoke (13.3.1)** | Não executado — sem credenciais sandbox válidas. |
| **Mark-paid UI fresh PENDING** | Não exercido em browser nesta sessão (fatura smoke já PAID; login programático retorna session null). Cobertura API/herdada 13.2.2. |
| **Login homolog programático** | Fetch credentials login 302/session null — browser OK. |
| **Provider production / gateway real** | Bloqueado — `BILLING_REAL_PAYMENTS_ENABLED=false`. |
| **Operação real Meta/BTG** | Fora de escopo Fase 13. |

---

## 5. Decisão operacional

A Fase 13 deixa a plataforma **comercialmente preparada** para aquisição, cadastro, assinatura, portal do cliente, faturas, pagamento manual/mock e integração Asaas (código pronto). **Pagamento confirmado não libera operação real automaticamente.** Operação real continua dependente de RealTradingApproval, PRE_MARKET, margem, preflight PASSED, dispatch manual e protection report.

---

## 6. Uso permitido após Fase 13

- Demonstração comercial e páginas públicas (`/planos`, `/cadastro`, `/termos/autotrade`).
- Cadastro de cliente e assinatura em staging.
- Cobrança manual/mock e confirmação administrativa (`MARCAR FATURA PAGA`).
- Webhook mock sandbox com idempotência.
- Portal cliente e admin billing.
- Geração de faturas e provisionamento comercial de licença/robô/magicNumber (após confirmação admin).
- Asaas sandbox **após** configurar credenciais e executar Fase 13.3.1.

---

## 7. Uso proibido

- Cobrança real de produção sem gate explícito.
- Chave Asaas production sem aprovação operacional.
- Promessa de rentabilidade ou liberação real por pagamento.
- Dispatch automático ou ordem real via fluxo comercial.
- Exposição de estratégia, parâmetros ou secrets.
- Múltiplos robôs comerciais reais sem fase específica.

---

## 8. Invariantes (confirmados)

| Invariante | Estado |
|------------|--------|
| Nenhuma ordem real enviada | **Sim** |
| Dispatch automático desativado | **Sim** |
| RealTradingApproval não criado por pagamento | **Sim** (testes + smoke 13.2.2) |
| Estratégia protegida | **Sim** |
| Secrets não expostos | **Sim** |
| Conta real travada (approval/preflight/protection) | **Sim** |
| `BILLING_REAL_PAYMENTS_ENABLED=false` staging | **Sim** (portal Manual; mock webhook OK) |

---

## 9. Validações desta sessão (13.4)

### 9.1 Ambiente e deploy

| Item | Resultado |
|------|-----------|
| Branch | `staging-vps-homologacao` |
| Working tree inicial | Limpo |
| Último commit histórico | `dd2c5f3` feat: add asaas payment provider integration |
| Deploy Vercel | Ready (~13 min antes da consolidação) |
| Migrations Neon (direct) | **Não verificável localmente** — `DATABASE_URL` vazio no env pull; app staging operacional indica schema compatível (deploy 13.3 + billing/portal OK) |

### 9.2 Catálogo comercial (herdado 13.1.1 + seed)

| Campo | Valor esperado | Fonte |
|-------|----------------|-------|
| Plan slug | `autotrade-single-robot` | `prisma/seed.ts` + smoke staging |
| Nome | AutoTrade Single Robot | `/planos` browser |
| Preço | 30000 centavos (R$ 300) | portal + seed |
| maxRobots | 1 (fase atual) | seed + copy pública |
| RobotProduct | ACTIVE | seed |
| magicNumber | 910001–910999 | documentação 13.1.1 |

### 9.3 Páginas públicas (browser staging)

| Rota | HTTP | Conteúdo validado |
|------|------|-------------------|
| `/planos` | 200 | R$ 300, 1 robô, até 4 futuro, riscos, conta real |
| `/cadastro` | 200 | Termos linkados, checkboxes obrigatórios, R$ 300 |
| `/termos/autotrade` | 200 | PI, sem promessa, pagamento ≠ libera real |

### 9.4 Portal cliente (browser staging)

| Item | Resultado |
|------|-----------|
| Usuário | Sessão browser ativa (portal comercial acessível) |
| Usuário smoke referência | `portal-smoke-1313-20260530212108@example.com` |
| `/dashboard/comercial` | OK — assinatura, faturas R$ 300, aviso conta real |
| `/dashboard/comercial/faturas/cmpt3ahzo0044l70447agvdsg` | OK — "Pagamento confirmado." |
| Cliente → `/admin` | Redirecionado / negado |
| Secrets / estratégia | Não visíveis |

### 9.5 Billing manual/mock

| Item | Resultado |
|------|-----------|
| invoiceId referência | `cmpt3ahzo0044l70447agvdsg` (PAID · R$ 300 · Manual) |
| Webhook mock idempotência | **OK** — 1ª `processed:true`, 2ª `duplicate:true` |
| Mark-paid fresh PENDING browser | **Pendente** |
| RealTradingApproval automático | **Não** |

### 9.6 Asaas sandbox

| Item | Resultado |
|------|-----------|
| Código / migration / webhook route | Implementado (13.3) |
| Credenciais staging | **Vazias** no env pull — E2E não tentado |
| BillingCustomer | **Pendente** E2E |
| providerPaymentId | **Pendente** E2E |
| Pix/checkout portal | **Pendente** E2E |
| Webhook Asaas idempotência | **Pendente** E2E |

### 9.7 Testes e build

| Comando | Resultado |
|---------|-----------|
| `npm test -- --run` | **388/388 OK** |
| `npm run build` | **OK** |

---

## 10. Artefatos de smoke

| Campo | Valor |
|-------|--------|
| **Usuário smoke** | `portal-smoke-1313-20260530212108@example.com` |
| **userId** | `cmpt1br6z0000ib04icl7nwj7` |
| **subscriptionId** | `cmpt1brdo0002ib049ajziz2e` |
| **invoiceId** | `cmpt3ahzo0044l70447agvdsg` |
| **Valor** | R$ 300,00 · Manual · PAID |
| **Webhook Asaas URL** | `https://autotrade-staging.mercadodariqueza.com.br/api/billing/webhook/asaas` |

---

## 11. Scripts de homologação adicionados (13.4)

| Script | Função |
|--------|--------|
| `scripts/homologation/phase-13-4-final-consolidation-smoke.ts` | Smoke HTTP staging (público, webhook, env check) |
| `scripts/homologation/check-asaas-env.mjs` | Verifica presença env Asaas sem expor valores |
| `scripts/homologation/check-staging-migrations.mjs` | Migrate status Neon (requer DATABASE_URL no pull) |

---

## 12. Deploy staging final

Deploy executado nesta sessão via `vercel deploy --prod --force`. Alias: https://autotrade-staging.mercadodariqueza.com.br

**Deployment ID:** `dpl_3KkuMSQeZxpyxhyjbWEXZRMxUPYM` — **Ready**

---

## 13. Próxima fase recomendada

**Fase 13.3.1 — Asaas Sandbox End-to-End Payment Smoke**

Pré-requisitos:

1. Configurar no Vercel staging (valores reais, não vazios):
   - `BILLING_PROVIDER=asaas`
   - `ASAAS_ENV=sandbox`
   - `ASAAS_API_KEY` (sandbox)
   - `ASAAS_WEBHOOK_TOKEN`
   - `BILLING_REAL_PAYMENTS_ENABLED=false`
2. Registrar webhook no dashboard Asaas sandbox apontando para `/api/billing/webhook/asaas`.
3. Executar smoke: solicitar fatura → Pix → pagamento sandbox → webhook → PAID → idempotência.
4. Revalidar mark-paid UI em fatura PENDING fresh (browser admin).

Após 13.3.1 aprovada: **Fase 14.1 — Production Billing Gate & Commercial Launch Preparation**.

---

*Mercado da Riqueza AutoTrade — Fase 13 fechada com restrições. Nenhum secret registrado neste documento.*
