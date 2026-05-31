# Client Portal Manual Smoke Results — Fase 13.1.3

**Data:** 2026-05-30  
**Branch:** `staging-vps-homologacao`  
**Commit base:** `2c5a6fc` — feat: add commercial terms page and refine public copy  
**Deploy:** https://autotrade-staging.mercadodariqueza.com.br  
**Status:** `APPROVED_WITH_RESTRICTIONS`  
**Decisão operacional:** `LIVE_ORDER_VALIDATION_DEFERRED` mantido · nenhuma ordem real enviada

---

## 1. Resumo executivo

| Área | Resultado |
|------|-----------|
| `/planos` | **OK** |
| `/termos/autotrade` | **OK** |
| `/cadastro` | **OK** (link termos + aceites + API) |
| Login browser | **OK** (novo usuário smoke) |
| `/dashboard/comercial` browser | **OK** (novo usuário smoke) |
| Bloqueio `/admin` para CLIENT | **OK** |
| Solicitação assinatura (UI) | **OK** (formulário visível com aceites) |
| Admin comercial browser | **Herdado 13.1.1** (serviço + Neon — não revalidado em browser nesta sessão) |
| Pagamento manual + RobotInstance | **Herdado 13.1.1** (`cliente.homolog@example.com`, magic `910001`) |
| Login browser homolog | **Pendente** (senha local ≠ credencial Neon staging no ambiente do operador) |
| Conta real / dispatch | **Bloqueados** |

---

## 2. Usuários utilizados

| Usuário | Papel nesta fase |
|---------|------------------|
| `portal-smoke-1313-20260530212108@example.com` | **Principal** — cadastro API + login browser + portal comercial |
| `cliente.homolog@example.com` | **Referência 13.1.1** — assinatura ACTIVE, pagamento CONFIRMED, magic `910001` (Neon); login browser **não** concluído nesta sessão |

**Não utilizado:** `cliente.staging@mercadodariqueza.com.br` (ausente neste Neon).

**IDs smoke (HTTP 201):** `userId=cmpt1br6z0000ib04icl7nwj7` · `subscriptionId=cmpt1brdo0002ib049ajziz2e`

---

## 3. `/planos`

**URL:** https://autotrade-staging.mercadodariqueza.com.br/planos

| Critério | Resultado |
|----------|-----------|
| AutoTrade Single Robot | OK |
| R$ 300,00/mês | OK |
| Plano inicial 1 robô | OK |
| Estrutura futura até 4 robôs | OK |
| Copy institucional (tecnologia proprietária) | OK |
| Sem “caixa preta” como mensagem comercial | OK |
| Sem promessa de rentabilidade | OK |
| Riscos claros | OK |
| CTA cadastro | OK |
| Link direto para termos na página | N/A (termos linkados no `/cadastro` e no portal logado) |

---

## 4. `/termos/autotrade`

**URL:** https://autotrade-staging.mercadodariqueza.com.br/termos/autotrade

| Critério | Resultado |
|----------|-----------|
| Título comercial/beta | OK |
| Aviso versão beta (não contrato final) | OK |
| Risco de mercado | OK |
| Sem promessa de rentabilidade | OK (negação explícita) |
| Conta real depende de aprovação | OK |
| Pagamento não libera real automaticamente | OK |
| Tecnologia proprietária / lógica protegida | OK |
| Botões voltar cadastro/planos | OK |
| Estratégia não exposta | OK |
| Link abre em nova aba a partir do `/cadastro` | OK (browser) |

---

## 5. `/cadastro`

**URL:** https://autotrade-staging.mercadodariqueza.com.br/cadastro

| Critério | Resultado |
|----------|-----------|
| Link “Termos de Uso Comercial/Beta” → `/termos/autotrade` | OK |
| 5 aceites obrigatórios visíveis | OK |
| API rejeita sem `acceptTerms` | OK (HTTP 400) |
| API aceita cadastro completo | OK (HTTP 201) |
| `planSlug: autotrade-single-robot` | OK |
| `monthlyPriceCents: 30000` | OK |
| Conta real não liberada | OK |
| Licença não provisionada automaticamente | OK (portal: “Licença será emitida após confirmação comercial”) |

---

## 6. Login browser

**URL:** https://autotrade-staging.mercadodariqueza.com.br/login

| Critério | Resultado |
|----------|-----------|
| Login `portal-smoke-1313-20260530212108@example.com` | OK |
| Redirecionamento pós-login | OK → `/dashboard` |
| CLIENT não acessa `/admin` | OK (redirect `/dashboard`) |
| Login `cliente.homolog@example.com` nesta sessão | **Pendente** (credencial staging não disponível no `.env` local alinhada ao Neon) |

---

## 7. `/dashboard/comercial` (browser — usuário smoke)

**URL:** https://autotrade-staging.mercadodariqueza.com.br/dashboard/comercial

| Critério | Resultado |
|----------|-----------|
| Plano AutoTrade Single Robot | OK |
| R$ 300,00/mês (formulário solicitação) | OK |
| Status assinatura / pagamento pendente | OK (“Aguardando pagamento” no dashboard; alertas comerciais no portal) |
| Licença | OK — pendente provisionamento |
| Robô / RobotInstance | OK — “Nenhum robô provisionado” (esperado pré-pagamento) |
| magicNumber | N/A — ainda não alocado |
| EA/device | OK — mensagem de licença pendente |
| Riscos / conta real depende aprovação | OK (alertas visíveis) |
| Tecnologia proprietária (rodapé) | OK |
| Estratégia não exposta | OK |
| Tokens/secrets na página | OK — nenhum exposto |

---

## 8. Solicitação de assinatura (portal)

| Critério | Resultado |
|----------|-----------|
| Formulário “Solicitar assinatura” visível | OK |
| Aceites com link para termos | OK |
| Texto R$ 300,00/mês | OK |
| Não libera conta real automaticamente | OK (mensagens explícitas) |
| Não cria RealTradingApproval automático | OK (invariante 13.1.1 mantida) |
| Dispatch automático | **Desativado** |

**Nota:** Usuário smoke já possui `Subscription` criada no signup (HTTP 201). Formulário permanece visível com pagamento `PENDING` — comportamento esperado até confirmação admin.

---

## 9. Admin comercial (pós-solicitação)

| Critério | Resultado |
|----------|-----------|
| UI `/admin/users/[userId]` nesta sessão | **Não revalidada em browser** |
| Serviço `confirmSubscriptionPayment` (13.1.1) | **OK** — homolog |
| RobotInstance + magicNumber backend | **OK** — `910001` (homolog, 13.1.1) |
| AdminAction / AuditLog | **OK** (13.1.1) |
| Cliente não escolhe magicNumber | OK (invariante) |

**Restrição:** Validar UI admin com operador logado como ADMIN quando credenciais staging estiverem documentadas para smoke recorrente.

---

## 10. Portal após pagamento manual

| Critério | Resultado |
|----------|-----------|
| Usuário smoke (novo) | **Pendente** — aguarda confirmação admin |
| Usuário homolog (13.1.1) | **OK** em Neon — ACTIVE + CONFIRMED + magic `910001` |
| Browser homolog pós-pagamento | **Pendente** (login homolog nesta sessão) |
| Operação real | **Bloqueada** (approval + PRE_MARKET + preflight + protection) |

---

## 11. Invariantes preservados

- Nenhuma ordem real enviada  
- Dispatch automático desativado  
- Real Trading Guard preservado  
- Estratégia / parâmetros internos não expostos  
- Sem secrets, tokens, Bearer, DATABASE_URL ou passwordHash em artefatos desta fase  

---

## 12. Restrições remanescentes

1. **Login browser homolog** — requer senha Neon staging alinhada (`cliente.homolog@example.com`).  
2. **Admin comercial UI** — smoke browser admin não repetido; confiar em 13.1.1 + validação manual futura.  
3. **Novo usuário smoke** — pagamento manual e RobotInstance pendentes (fluxo esperado).

---

## 13. Fechamento da restrição 13.1.1

| Restrição 13.1.1 | Status pós 13.1.3 |
|------------------|-------------------|
| Login browser portal | **Fechada** (usuário smoke) |
| Confirmação visual `/dashboard/comercial` | **Fechada** (usuário smoke) |
| Homolog completo em browser | **Parcial** (dados Neon OK; login browser pendente) |

---

## 14. Próxima fase sugerida

**Fase 13.2 — Payment Gateway & Billing Automation**  
ou documentação de credenciais staging recorrentes + smoke homolog browser.

---

*Mercado da Riqueza AutoTrade — smoke manual portal cliente 13.1.3. Sem ordem real.*
