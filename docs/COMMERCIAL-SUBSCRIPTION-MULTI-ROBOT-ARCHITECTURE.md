# Commercial Subscription & Multi-Robot Control Architecture — Mercado da Riqueza AutoTrade

**Data:** 2026-05-27  
**Fase:** 11.1 — Commercial Plans, Subscriptions & Multi-Robot Control Architecture  
**Status:** `COMMERCIAL_SUBSCRIPTION_MULTI_ROBOT_ARCHITECTURE_DEFINED`  
**Decisão:** `REAL_ACCOUNT_NOT_APPROVED`

Documentos relacionados: [`MASTER-EA-IMPLEMENTATION-PLAN.md`](MASTER-EA-IMPLEMENTATION-PLAN.md), [`RELEASE-CANDIDATE-FINAL-REPORT.md`](RELEASE-CANDIDATE-FINAL-REPORT.md), [`DEMO-CLIENT-FLOW.md`](DEMO-CLIENT-FLOW.md), [`BETA-DEMO-TERMS-DISCLAIMER-DRAFT.md`](BETA-DEMO-TERMS-DISCLAIMER-DRAFT.md), [`REAL-TRADING-GUARD-FINAL-REPORT.md`](REAL-TRADING-GUARD-FINAL-REPORT.md).

**Escopo desta fase:** arquitetura documental/conceitual apenas — **sem** schema, migration, EA, backend crítico, env ou deploy.

---

## 1. Objetivo

Definir a arquitetura **comercial** e **operacional** para que clientes possam:

- Contratar **planos** no site  
- Ser **liberados** administrativamente  
- Utilizar **um ou mais** robôs/estratégias em ambiente **DEMO/STAGING**  
- Operar com controle por **licença**, **assinatura**, **robô** e **número mágico** exclusivo  

Mantendo **caixa preta** de estratégia (sem expor lógica interna ao cliente) e **conta real bloqueada**.

---

## 2. Status atual

| Campo | Valor |
|-------|--------|
| Produto / RC | `RELEASE_CANDIDATE_DEMO_STAGING_READY` |
| Conta real | **Não aprovada** — bloqueada |
| Produção real | **Não aprovada** — bloqueada |
| Dispatch automático | **Desativado** |
| Comercialização real | **Não liberada** |
| Esta fase | Estrutura arquitetura comercial e multi-robô |

**Já existente no produto (referência):** `User`, `Plan`, `Subscription`, `License`, `Device`, EA cliente, MasterSignal, dispatch manual, tracking — ver `prisma/schema.prisma` (sem alteração nesta fase).

---

## 3. Problema identificado

O projeto já possui cliente, licença, device, EA, MasterSignal, dispatch e tracking, mas falta uma **camada comercial clara** para:

| Lacuna | Descrição |
|--------|-----------|
| Plano no site | Cliente escolher plano de forma guiada |
| Cadastro / assinatura | Fluxo de contratação e aluguel |
| Liberação admin | Aprovação explícita antes de operar |
| Licença ↔ plano | Vínculo comercial explícito |
| Portal do cliente | Acompanhamento de status |
| Multi-robô | Mais de um robô/estratégia por cliente |
| Identificação por robô | Instância e metadados por slot |
| **Magic number** | Distinguir ordens/execuções no MT5 |
| Conflitos MT5 | Evitar colisão entre robôs na mesma conta |

---

## 4. Fluxo comercial desejado

```text
Cliente acessa site
  → escolhe plano
  → cria cadastro
  → aceita termos DEMO / disclaimers
  → realiza pagamento OU solicita ativação (manual inicial)
  → assinatura é criada
  → admin revisa cliente
  → admin aprova / libera plano
  → sistema cria ou atualiza licença
  → sistema cria um ou mais robôs / slots (RobotInstance)
  → sistema define magicNumber por instância
  → sistema gera activation code (device)
  → cliente instala EA no MT5 DEMO
  → EA ativa device
  → cliente aparece online no admin
  → admin envia sinais conforme plano (dispatch manual)
  → cliente acompanha status no portal
```

**Restrição transversal:** em todas as etapas, **conta real** e **dispatch automático** permanecem fora do escopo até gates futuros.

---

## 5. Entidades conceituais necessárias

### User / Cliente

- Representa o cliente cadastrado (auth, perfil, billing contact).  
- **Já existe** no modelo atual.

### CommercialPlan / Plano comercial

- Plano disponível no site (catálogo).  
- Exemplos placeholder: **DEMO**, **Starter**, **Professional**, **Institutional**.  
- Define limites: quantidade de robôs, ambiente (DEMO), recursos de portal, suporte.  
- **Parcialmente coberto** por `Plan` existente — evoluir catálogo na Fase 11.2.

### Subscription / Assinatura

- Vínculo cliente ↔ plano comercial.  
- Status comercial (ver §9).  
- **Já existe** `Subscription` — alinhar status e regras na Fase 11.3.

### License / Licença

- Autorização operacional (EA, heartbeat, instructions).  
- **Deve** vincular-se à `Subscription` ativa.  
- **Já existe** `License` com `subscriptionId` opcional — tornar regra explícita.

### RobotProduct / Produto robô

- Robô/estratégia **comercial** disponível (rótulo, não lógica).  
- Exemplos: EA FIBO D1, EA POC, EA Copy, EA Simulador.  
- **Não expõe** parâmetros estratégicos (caixa preta).

### RobotInstance / Instância do robô

- Robô **liberado** para um cliente específico.  
- Múltiplas instâncias por cliente conforme plano.  
- Campos conceituais: `licenseId`, `robotProductId`, `symbol`, `profile`, `magicNumber`, status (§10).  
- **Novo conceito** — modelagem Fase 11.4.

### MagicNumber / Número mágico

- Identificador numérico MT5 para distinguir ordens/execuções **por robô**.  
- Visível no admin; configurado no EA (futuro); correlacionado em execution report e tracking.  
- Ver §6.

---

## 6. Regra do número mágico

| Regra | Descrição |
|-------|-----------|
| Obrigatoriedade | Cada `RobotInstance` possui **um** `magicNumber` |
| Geração | **Não** escolha livre do cliente — backend/admin **gera** ou **valida** |
| Unicidade | Único por escopo definido: `licenseId` + `robotInstanceId` (e validação conta MT5) |
| Multi-robô | Mesmo cliente, vários `magicNumber` distintos |
| Mesmo MT5 | Vários EAs/instâncias permitidos se `magicNumber` distintos |
| Execution report | Informar `magicNumber` quando disponível (futuro) |
| Tracking | Filtrar por `robotInstanceId` / `magicNumber` (futuro) |
| EA cliente | Receber `magicNumber` em config ou instruction (implementação futura) |
| Colisão | **Bloquear** criação/ativação se `magicNumber` já em uso no escopo |

**Registry opcional:** tabela `MagicNumberRegistry` ou campo indexado em `RobotInstance` com constraint unique composta.

---

## 7. Exemplo prático

**Cliente:** HALLYTON / Cliente Beta DEMO  
**Plano:** Professional DEMO  
**Conta MT5:** `52609973 @ XPMT5-DEMO`

| Robô | Produto | Symbol | Profile | MagicNumber |
|------|---------|--------|---------|-------------|
| 1 | EA FIBO D1 | WDOM26 | conservador | `910001` |
| 2 | EA POC | WDOM26 | conservador | `910002` |
| 3 | EA Simulador | WIN | demo | `910003` |

Cada instância: `RobotInstance` própria, heartbeat/instruction rastreáveis por slot (futuro).

---

## 8. Limites por plano (conceitual — placeholders)

| Plano | Robôs máx. | Ambiente | Observações |
|-------|------------|----------|-------------|
| **DEMO** | 1 | DEMO | `DebugMode=true` padrão; dispatch manual |
| **Starter** | 1 | DEMO | Portal; onboarding DEMO; sem real |
| **Professional** | 3 | DEMO | Múltiplos símbolos DEMO; tracking; suporte operacional |
| **Institutional** | Custom | DEMO | Múltiplas contas DEMO; integração assistida; revisão jurídica/comercial |

**Preços:** placeholders — **não** definir preço definitivo nesta fase.

---

## 9. Status de assinatura

| Status | Significado |
|--------|-------------|
| `PENDING_PAYMENT` | Aguardando pagamento |
| `PENDING_ADMIN_REVIEW` | Pagamento/manual registrado; aguarda admin |
| `ACTIVE` | Assinatura ativa; pode operar conforme plano |
| `SUSPENDED` | Suspensa (inadimplência, risco, operação) |
| `CANCELLED` | Cancelada pelo cliente ou admin |
| `EXPIRED` | Vencida |
| `BLOCKED` | Bloqueio administrativo / compliance |

**Alinhar** com `SubscriptionStatus` existente no Prisma na Fase 11.3 (mapeamento, não implementar agora).

---

## 10. Status de instância de robô

| Status | Significado |
|--------|-------------|
| `PENDING_SETUP` | Criada; aguarda config/activation |
| `ACTIVE_DEMO` | Operando em DEMO |
| `PAUSED` | Pausada pelo admin ou cliente |
| `SUSPENDED` | Suspensa |
| `CANCELLED` | Cancelada |
| `EXPIRED` | Expirada com assinatura |
| `BLOCKED` | Bloqueio operacional |
| `REAL_NOT_ALLOWED` | Tentativa real bloqueada (guard) |

---

## 11. Liberação pelo admin

1. Cliente assina ou **solicita** plano → assinatura `PENDING_*`  
2. **Admin revisa** (compliance, DEMO, termos)  
3. **Admin aprova** → `ACTIVE`  
4. Sistema **cria/atualiza** `License` vinculada à subscription  
5. Sistema cria **`RobotInstance`(s)** conforme limite do plano  
6. Sistema **atribui** `magicNumber` (sem colisão)  
7. Cliente recebe **activation code** / orientação ([`DEMO-CLIENT-FLOW.md`](DEMO-CLIENT-FLOW.md))  
8. EA **ativa** device → heartbeat `ONLINE`  
9. Admin monitora e despacha sinais **manualmente**  

---

## 12. Portal do cliente (visão futura)

O cliente poderá ver (sem estratégia interna):

- Plano contratado e **status da assinatura**  
- **Licenças** e devices  
- **Robôs liberados** (rótulos comerciais)  
- `magicNumber` por robô — **somente** se seguro exibir (avaliar risco operacional)  
- Status do **EA** / heartbeat  
- **Conta MT5** vinculada  
- Indicador **ambiente DEMO**  
- Alertas: **conta real bloqueada**  
- **Tracking** resumido (agregado, sem vazar tática)  
- **Vencimento** / cancelamento  

---

## 13. Admin comercial (visão futura)

Admin poderá:

- Criar/editar **planos** (catálogo)  
- **Aprovar** / suspender / cancelar assinatura  
- **Liberar** licença  
- Criar **`RobotInstance`**  
- Definir / validar **`magicNumber`**  
- **Pausar** / bloquear robô  
- Listar robôs **por cliente**  
- Ver **magicNumbers** ativos e **colisões**  
- Consultar **tracking** por robô (futuro)  

---

## 14. Integração futura com pagamento

Possibilidades ( **não implementar** nesta fase):

- Stripe  
- Mercado Pago  
- Asaas  
- Pagamento manual + aprovação admin (MVP comercial DEMO)  

Fase dedicada: **11.7 — Payment Gateway Decision**.

---

## 15. Relação com Real Trading Guard

**Pagamento ou plano ativo NÃO libera conta real.**

A assinatura pode liberar:

- Portal  
- Licença **DEMO**  
- Robôs **DEMO** (`RobotInstance`)  
- Activation code  
- Acompanhamento / onboarding  

A assinatura **NÃO** libera:

- Conta **real**  
- Dinheiro **real**  
- Produção **real**  
- Dispatch **automático**  
- Allowlist do **Real Trading Guard**  

Qualquer conta real: **gate separado** ([`REAL-ACCOUNT-GOVERNANCE-PACK-INDEX.md`](REAL-ACCOUNT-GOVERNANCE-PACK-INDEX.md)).

---

## 16. Requisitos técnicos futuros (sem implementar agora)

### Possíveis novos modelos

- `CommercialPlan` (ou evolução de `Plan`)  
- `Subscription` (evolução de status/eventos)  
- `RobotProduct`  
- `RobotInstance` (+ `magicNumber`)  
- `MagicNumberRegistry` (opcional)  
- `SubscriptionEvent`  
- `PaymentEvent`  
- `CustomerPortalCommercialStatus` (view/DTO)  

### Possíveis alterações em modelos existentes

| Modelo | Alteração conceitual |
|--------|---------------------|
| `License` | Obrigatório vínculo com `Subscription` ativa para novos clientes |
| `Instruction` | FK opcional `robotInstanceId` |
| `Execution` / report | `magicNumber`, `robotInstanceId` |
| EA cliente | Config: `robotInstanceId`, `magicNumber` (input operacional, não estratégia) |
| `MasterSignal` | Metadado `robotProduct` / target instance (futuro, sem vazar vault) |

---

## 17. Riscos

| Risco | Mitigação |
|-------|-----------|
| Colisão de `magicNumber` | Registry + unique constraint + validação admin |
| Cliente roda robô errado | Rótulo claro no portal; activation por instância |
| EA em conta MT5 errada | Fluxo “alterar conta” + revogação device |
| Múltiplos robôs no mesmo ativo | Limites por plano; política operacional |
| Assinatura ativa, licença suspensa | Regras de sincronização status |
| Inadimplência sem bloqueio | Job/evento suspende license + instances |
| Plano interpretado como “conta real” | Disclaimers + guard + UI |
| Plano sem disclaimer | [`BETA-DEMO-TERMS-DISCLAIMER-DRAFT.md`](BETA-DEMO-TERMS-DISCLAIMER-DRAFT.md) |
| Conflito ordens MT5 | `magicNumber` obrigatório por instância |

---

## 18. Decisões iniciais (Fase 11.1)

| Decisão | Valor |
|---------|--------|
| Comercialização primeiro | **DEMO/STAGING** |
| Todo plano comercial | **Sem** conta real inicial |
| Multi-robô | Conforme plano (`RobotInstance`) |
| Magic number | **Obrigatório** por instância; controlado backend/admin |
| Conta real | **Bloqueada** |
| Gateway pagamento | Fase futura (11.7) |
| Schema / migration | Fase futura (11.3–11.4) |
| Estratégia ao cliente | **Caixa preta** — sem parâmetros de entrada estratégicos |

---

## 19. Próximas fases sugeridas

| Fase | Nome |
|------|------|
| **11.2** | Commercial Plan Catalog |
| **11.3** | Subscription & License Data Model |
| **11.4** | RobotInstance & MagicNumber Data Model |
| **11.5** | Customer Portal Commercial Flow |
| **11.6** | Admin Commercial Approval Flow |
| **11.7** | Payment Gateway Decision |
| **11.8** | Demo Commercial Flow Validation |
| **11.9** | Commercial Flow Final Report |

---

## 20. Status final

| Campo | Valor |
|-------|--------|
| **Status** | `COMMERCIAL_SUBSCRIPTION_MULTI_ROBOT_ARCHITECTURE_DEFINED` |
| **Decisão** | `REAL_ACCOUNT_NOT_APPROVED` |
| **Conta real** | Bloqueada |
| **Produção real** | Bloqueada |
| **Dinheiro real** | Bloqueado |
| **Dispatch automático** | Desativado |

---

*Mercado da Riqueza AutoTrade — arquitetura comercial e multi-robô (Fase 11.1). Documentação apenas. Conta real, produção real e dispatch automático permanecem bloqueados.*
