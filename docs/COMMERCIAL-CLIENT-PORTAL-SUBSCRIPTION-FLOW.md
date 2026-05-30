# Commercial Client Portal & Subscription Flow — Mercado da Riqueza AutoTrade

**Fase:** 13.1 — Commercial Client Portal & Subscription Flow  
**Status:** `COMMERCIAL_CLIENT_PORTAL_SUBSCRIPTION_FLOW_IMPLEMENTED`  
**Data:** 2026-05-27  
**Decisão:** `REAL_ACCOUNT_NOT_APPROVED_AUTOMATICALLY` · `LIVE_ORDER_VALIDATION_DEFERRED` mantido

---

## 1. Objetivo

Implementar o fluxo comercial inicial para o cliente contratar o plano **AutoTrade Single Robot** (R$ 300,00/mês por robô), aceitar termos, acompanhar assinatura, licença, robô, device, magicNumber e status operacional — **sem** expor estratégia e **sem** liberar conta real por pagamento.

---

## 2. Plano comercial

| Campo | Valor |
|-------|--------|
| Slug | `autotrade-single-robot` |
| Nome | AutoTrade Single Robot |
| Preço | R$ 300,00 / robô / mês (`30000` centavos) |
| Robôs (fase atual) | **1** por cliente |
| Estrutura futura | Até **4** robôs (R$ 300 × quantidade) |
| Modelo | Caixa preta |

---

## 3. Fluxo do cliente

1. Acessa `/planos` — preço, riscos, CTAs.  
2. Cadastro em `/cadastro` — nome, e-mail, senha, aceites.  
3. Login → `/dashboard/comercial` — status assinatura, pagamento, robô, licença, EA.  
4. Solicita assinatura (se necessário) — status `INCOMPLETE` + `adminPaymentStatus: PENDING`.  
5. Aguarda confirmação administrativa do pagamento.  
6. Admin confirma → licença + `RobotInstance` + `magicNumber` provisionados.  
7. Cliente vincula MT5 e ativa EA (fluxo existente).  
8. Conta real **somente** após approval + preflight + protection (Real Trading Guard).

---

## 4. Rotas

| Rota | Público | Descrição |
|------|---------|-----------|
| `/planos` | Sim | Página comercial |
| `/cadastro` | Sim | Cadastro + aceites |
| `/dashboard/comercial` | Cliente | Portal comercial |
| `/dashboard/assinatura` | Cliente | Licença / MT5 / activation |
| `POST /api/commercial/signup` | Sim | Cadastro |
| `POST /api/me/subscription/request` | Cliente | Solicitar plano |
| `POST /api/admin/subscriptions/[id]/confirm-payment` | Admin | Pagamento em dia |
| `POST /api/admin/subscriptions/[id]/mark-pending` | Admin | Pagamento pendente |
| `POST /api/admin/subscriptions/[id]/suspend` | Admin | Suspender |
| `POST /api/admin/subscriptions/[id]/reactivate` | Admin | Reativar |
| `POST /api/admin/subscriptions/[id]/cancel` | Admin | Cancelar |
| `POST /api/admin/subscriptions/[id]/create-license` | Admin | Licença + robô |

---

## 5. Schema

- `Plan.maxRobots` — limite de robôs por plano.  
- `Subscription.adminPaymentStatus` — `PENDING` \| `CONFIRMED` \| `OVERDUE`.  
- `Subscription.robotCount` — quantidade contratada.  
- `RobotProduct` — catálogo comercial do robô.  
- `RobotInstance` — instância por cliente com `magicNumber` (910001–910999).  
- `User.phone` — telefone opcional no cadastro.

---

## 6. magicNumber

- Gerado pelo **backend/admin** na criação da instância.  
- Faixa **910001–910999**; colisão bloqueada.  
- Cliente **não** altera magicNumber.  
- Sincronizado em `License.expectedMagicNumber` ao vincular licença.

---

## 7. Termos aceitos (cadastro)

- `COMMERCIAL_SUBSCRIPTION_TERMS`  
- `RISK_DISCLAIMER`  
- `NO_RETURN_GUARANTEE`  
- `REAL_REQUIRES_ADMIN_APPROVAL`  
- `BLACK_BOX_ACKNOWLEDGMENT`  

Versão: `2026-05-27` · registrados em `terms_acceptances`.

---

## 8. Admin comercial

Em `/admin/users/[userId]` — card **Gestão comercial**:

- Marcar pagamento em dia (ativa assinatura, licença, robô, fatura manual).  
- Pagamento pendente / suspender / reativar / cancelar.  
- Criar licença + robô.  
- Todas as ações em `admin_actions` + `audit_logs`.

---

## 9. Bloqueios (invariantes)

- Pagamento **não** libera conta real.  
- Assinatura ativa **não** substitui admin approval, device, PRE_MARKET, preflight, protection.  
- Dispatch automático **desativado**.  
- Nenhuma ordem real enviada nesta fase.  
- Real Trading Guard **preservado**.  
- Caixa preta — sem estratégia/parâmetros ao cliente.

---

## 10. Próxima fase

**Fase 13.2 — Payment Gateway & Billing Automation**  
ou  
**Fase 13.2 — RobotInstance & Multi-Robot Scaling**  
(conforme prioridade de produto após esta entrega).

---

*Mercado da Riqueza AutoTrade — portal comercial v1, pagamento manual administrativo.*
