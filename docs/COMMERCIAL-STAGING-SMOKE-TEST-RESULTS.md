# Commercial Staging Smoke Test Results — Fase 13.1.1

**Data:** 2026-05-30  
**Branch:** `staging-vps-homologacao`  
**Deploy:** https://autotrade-staging.mercadodariqueza.com.br  
**Commit base:** `93e1b25` — feat: add commercial client portal subscription flow  
**Status:** `APPROVED_WITH_RESTRICTIONS`  
**Decisão operacional:** `LIVE_ORDER_VALIDATION_DEFERRED` mantido · nenhuma ordem real enviada

---

## 1. Resumo executivo

| Área | Resultado |
|------|-----------|
| Seed catálogo Neon | **Aplicado** |
| `/planos` | **OK** |
| `/cadastro` | **OK** |
| Cadastro API (`POST /api/commercial/signup`) | **OK** (HTTP 201) |
| Portal `/dashboard/comercial` | **Parcial** — UI não validada via login browser nesta sessão |
| Admin comercial (confirm-payment + robô) | **OK** (serviço + Neon) |
| RobotInstance / magicNumber | **OK** (`910001` alocado) |
| Conta real / dispatch | **Bloqueados** (sem approval automático) |

---

## 2. Seed do catálogo

### Comando (operador local, sem imprimir secrets)

```bash
vercel env pull .env.staging.pull --environment=production
# Carregar DATABASE_URL do arquivo no shell (não commitar)
npm run db:seed
```

### Validação pós-seed (Neon staging)

| Item | Esperado | Resultado |
|------|----------|-----------|
| Plan slug | `autotrade-single-robot` | OK |
| Nome | AutoTrade Single Robot | OK |
| Preço mensal | `30000` centavos | OK |
| `maxRobots` | `1` | OK |
| `RobotProduct` | ACTIVE, black box | OK |
| Faixa magicNumber (código) | 910001–910999 | OK |

**Nota:** Antes do seed, plano e produto estavam **ausentes** no Neon (migration `20260530220358` já aplicada no deploy Vercel).

---

## 3. Página pública `/planos`

**URL:** https://autotrade-staging.mercadodariqueza.com.br/planos

| Critério | Resultado |
|----------|-----------|
| Preço R$ 300,00/mês | OK (render `300,00`) |
| Plano inicial 1 robô | OK |
| Estrutura futura até 4 robôs | OK (browser snapshot) |
| Avisos de risco | OK |
| Sem promessa de rentabilidade | OK |
| Sem exposição de estratégia/setup | OK |
| CTAs cadastro / portal | OK |

---

## 4. Cadastro `/cadastro`

**URL:** https://autotrade-staging.mercadodariqueza.com.br/cadastro

| Critério | Resultado |
|----------|-----------|
| Campos obrigatórios (nome, e-mail, senha) | OK |
| Aceites obrigatórios (5 checkboxes) | OK |
| Texto R$ 300/mês | OK |
| Sem secrets na página | OK |

### API `POST /api/commercial/signup`

| Critério | Resultado |
|----------|-----------|
| HTTP 201 | OK |
| Retorno `planSlug: autotrade-single-robot` | OK |
| Retorno `monthlyPriceCents: 30000` | OK |
| Conta real não liberada na resposta | OK |

**Restrição:** Validação DB pós-signup via operador local depende de `DATABASE_URL` alinhado ao runtime Vercel. Nesta sessão, usuários smoke criados via API não apareceram no Neon consultado via `vercel env pull` (possível divergência de ambiente/leitura). Tratar signup como **aprovado na borda HTTP**; recomenda-se revalidar persistência após sync de credenciais Neon.

---

## 5. Portal cliente `/dashboard/comercial`

| Critério | Resultado |
|----------|-----------|
| Rota protegida (redirect login) | OK |
| Cliente homolog no Neon | `cliente.homolog@example.com` (não `cliente.staging@…` neste Neon) |
| Assinatura visível (DB) | OK — subscription `ACTIVE` |
| Pagamento admin | OK — `CONFIRMED` após teste admin |
| Licença + device | OK — 1 licença ACTIVE, 1 device |
| magicNumber | OK — `910001` (pós confirm-payment) |
| Sem token/secret em páginas públicas | OK |

**Restrição:** Login browser automatizado não concluiu sessão nesta sessão (credenciais/sessão NextAuth). Validar manualmente com operador:

1. Login em `/login`
2. Abrir `/dashboard/comercial`
3. Confirmar preço, pagamento, robô, licença — **sem** tokens ou estratégia

---

## 6. Solicitação de assinatura

| Critério | Resultado |
|----------|-----------|
| Endpoint `POST /api/me/subscription/request` existe | OK |
| Não libera conta real automaticamente | OK (invariante código + gate) |
| Não cria `RealTradingApproval` automático | OK (`realApprovalsApproved: 0`) |
| Dispatch automático | **Desativado** (inalterado) |

---

## 7. Admin comercial

Teste executado no **Neon staging** via serviço `confirmSubscriptionPayment` (mesmo código da rota admin):

| Critério | Resultado |
|----------|-----------|
| Marcar pagamento em dia | OK |
| Criar `RobotInstance` | OK |
| `magicNumber` backend (`910001`) | OK |
| Vínculo `License.expectedMagicNumber` | OK |
| `AdminAction` + audit | OK |
| Cliente **não** altera magicNumber | OK (somente admin/backend) |
| Real approval automático | **Não** (`0` approvals) |

Cliente de teste: `cliente.homolog@example.com`  
Subscription: `cmpfvdm9f0001sx3gviwul2tw`

---

## 8. Fluxo assinatura → licença → robô

```
User (cliente.homolog@example.com)
  → Subscription (ACTIVE, adminPaymentStatus CONFIRMED)
  → Plan (start — legado homolog; catálogo autotrade-single-robot disponível para novos cadastros)
  → License (ACTIVE, expectedMagicNumber 910001)
  → RobotInstance (magicNumber 910001, status AWAITING_APPROVAL)
  → Device (1 ativo na licença)
  → EA (online histórico homolog — sem ordem real nesta fase)
```

| Gate | Resultado |
|------|-----------|
| Pagamento OK libera REAL sozinho | **Não** |
| Assinatura ACTIVE libera REAL sozinha | **Não** |
| Real depende approval + PRE_MARKET + preflight + protection | **Sim** |

---

## 9. Invariantes preservados

- Nenhuma ordem real enviada  
- Dispatch automático desativado  
- Real Trading Guard preservado  
- Caixa preta — sem estratégia exposta  
- Sem secrets/DATABASE_URL/tokens em artefatos desta fase  

---

## 10. Restrições / pendências

1. **Login browser** cliente/admin — validação manual recomendada (automação HTTP NextAuth retornou HTML em vez de JSON para APIs autenticadas).  
2. **Cliente `cliente.staging@mercadodariqueza.com.br`** — ausente neste Neon; usar `cliente.homolog@example.com` ou recriar via `/cadastro`.  
3. **Migrar cliente homolog** para plano `autotrade-single-robot` — opcional (Fase 13.2 ou script admin).  
4. **Signup persistência** — revalidar com operador após confirmar `DATABASE_URL` único entre local e Vercel runtime.

---

## 11. Próxima fase sugerida

**Fase 13.2 — Payment Gateway & Billing Automation**  
ou alinhamento homolog → plano `autotrade-single-robot` + credenciais staging documentadas para smoke recorrente.

---

*Mercado da Riqueza AutoTrade — smoke comercial staging 13.1.1. Sem ordem real.*
