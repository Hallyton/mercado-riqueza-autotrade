# Billing Portal UI Consistency Fix — Fase 13.2.3

**Data:** 2026-05-31  
**Branch:** `staging-vps-homologacao`  
**Commit base:** `30caffc` — docs: record billing admin and mock webhook validation  
**Deploy:** https://autotrade-staging.mercadodariqueza.com.br  
**Status:** `APPROVED_WITH_RESTRICTIONS`  
**Decisão operacional:** `LIVE_ORDER_VALIDATION_DEFERRED` mantido · nenhuma ordem real · dispatch automático desativado · gateway real não integrado

---

## 1. Resumo executivo

| Área | Resultado |
|------|-----------|
| Copy fatura PAID no detalhe | **Corrigida** — "Pagamento confirmado." |
| Copy fatura PENDING/OPEN | **OK** — "Aguardando confirmação de pagamento." |
| PAID não mostra "Aguardando confirmação…" | **OK** |
| Seção faturas (fatura atual PAID) | **Corrigida** — "Pagamento confirmado" |
| RobotInstance no portal | **Corrigida** — query fallback + exibição AWAITING_APPROVAL |
| magicNumber read-only | **OK** (`aria-readonly`, sem input) |
| Aviso conta real | **OK** — PRE_MARKET + preflight + protection |
| Mark-paid UI fresh PENDING | **Pendente** (browser staging — ver §6) |
| RealTradingApproval automático | **Não** |
| Conta real / ordem real | **Bloqueadas** |

---

## 2. Problemas corrigidos (13.2.2 → 13.2.3)

### 2.1 Detalhe da fatura PAID

**Antes:** mensagem fixa "Aguardando confirmação administrativa do pagamento." quando `checkoutUrl` ausente — inclusive em faturas PAID.

**Depois:** copy por status via `lib/billing/invoice-client-copy.ts`:

| Status | Mensagem |
|--------|----------|
| PAID | Pagamento confirmado. |
| PENDING / OPEN | Aguardando confirmação de pagamento. |
| OVERDUE | Pagamento vencido. |
| CANCELLED / VOID | Fatura cancelada. |

Campos exibidos em PAID: valor, status, **paidAt**, vencimento, período, método, provedor + disclaimer conta real.

### 2.2 Portal "Nenhum robô provisionado"

**Causa raiz:** admin mostrava `robotCount` contratado (1/1), enquanto o portal listava apenas `subscription.robotInstances` — vazio no smoke user quando instância não estava na relação carregada ou ainda não provisionada.

**Correções:**

- `pickPortalSubscription` — prioriza assinatura ACTIVE/CONFIRMED.
- `resolveSubscriptionRobotInstances` — fallback `robotInstance.findMany({ userId, subscriptionId })`.
- UI exibe robô com status derivado (incl. AWAITING_APPROVAL), magicNumber, símbolo, licença, device/EA.

**Mensagem quando não há instância:**  
"Nenhum robô provisionado ainda. Após confirmação administrativa do pagamento, o robô será alocado com magicNumber exclusivo."

---

## 3. Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `lib/billing/invoice-client-copy.ts` | **Novo** — copy por status + disclaimers |
| `app/dashboard/comercial/faturas/[invoiceId]/page.tsx` | Copy condicional PAID/PENDING |
| `components/billing/commercial-invoices-section.tsx` | Fatura atual PAID sem "Aguardando…" |
| `lib/commercial/portal-overview.ts` | Subscription pick + robot fallback + campos UI |
| `app/dashboard/comercial/page.tsx` | Card robôs enriquecido, magicNumber read-only |
| `tests/billing/invoice-client-copy.test.ts` | **Novo** |
| `tests/commercial/portal-billing-ui.test.ts` | **Novo** |
| `tests/billing/invoice-service.test.ts` | mark-paid idempotente + AdminAction |

---

## 4. Testes automatizados

| Suite | Resultado |
|-------|-----------|
| `npm test -- --run` | **377/377 OK** (+17 novos) |
| `npm run build` | **OK** |

Cobertura principal:

- invoice PAID → "Pagamento confirmado."
- invoice PENDING → "Aguardando confirmação de pagamento."
- PAID não usa copy de pendência.
- portal-overview retorna RobotInstance AWAITING_APPROVAL.
- fallback query quando relação vazia.
- mark-paid idempotente não duplica AdminAction.
- disclaimers não prometem conta real liberada.

---

## 5. Regras de segurança (inalteradas)

| Critério | Resultado |
|----------|-----------|
| Pagamento PAID cria RealTradingApproval | **Não** |
| Pagamento PAID altera ENABLE_REAL_TRADING | **Não** |
| Dispatch automático | **Desativado** |
| Ordem real enviada | **Nenhuma** |
| Estratégia exposta | **Não** |
| Real Trading Guard alterado | **Não** |

---

## 6. Mark-paid fresh PENDING (browser)

**Status:** **Pendente nesta sessão** — validação programática coberta em `invoice-service.test.ts`; fluxo browser admin `MARCAR FATURA PAGA` em fatura nova PENDING requer sessão admin + fixture dedicada pós-deploy.

**Recomendação:** repetir smoke operacional na 13.2.4 ou antes da 13.3 com nova fatura manual no admin.

---

## 7. Restrições remanescentes

1. Mark-paid UI em fatura fresh PENDING — pendente browser.
2. Login programático (fetch) — documentado na 13.2.2, fora de escopo.
3. Smoke user pode ainda não ter RobotInstance no Neon até mark-paid/fulfillment completo — UI agora exibe corretamente quando existir.

**Próxima fase sugerida:** Fase 13.3 — Payment Provider Integration (gateway real).

---

*Mercado da Riqueza AutoTrade — correção UI portal billing. Nenhum segredo registrado neste documento.*
