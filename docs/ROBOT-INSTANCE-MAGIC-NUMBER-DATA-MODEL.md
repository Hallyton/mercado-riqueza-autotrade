# RobotInstance & MagicNumber Data Model — Mercado da Riqueza AutoTrade

---

> **Aviso inicial**
>
> Este documento define o **modelo conceitual** de robôs, instâncias e número mágico para a plataforma comercial.
>
> - **Não** cria schema.  
> - **Não** cria migration.  
> - **Não** altera código.  
> - **Não** altera EA.  
> - **Não** autoriza conta real.  
> - **Não** autoriza produção real.  
> - **Não** ativa dispatch automático.  
> - **Não** revela a estratégia interna dos robôs.

**Data:** 2026-05-27  
**Fase:** 11.4 — RobotInstance & MagicNumber Data Model  
**Status:** `ROBOT_INSTANCE_MAGIC_NUMBER_MODEL_DEFINED`  
**Decisão:** `REAL_ACCOUNT_NOT_APPROVED_AUTOMATICALLY`

Base: [`COMMERCIAL-SUBSCRIPTION-MULTI-ROBOT-ARCHITECTURE.md`](COMMERCIAL-SUBSCRIPTION-MULTI-ROBOT-ARCHITECTURE.md), [`COMMERCIAL-PLAN-CATALOG.md`](COMMERCIAL-PLAN-CATALOG.md), [`SUBSCRIPTION-LICENSE-DATA-MODEL.md`](SUBSCRIPTION-LICENSE-DATA-MODEL.md)

---

## 1. Objetivo

Definir como **robôs comerciais** (`RobotProduct`), **instâncias por cliente** (`RobotInstance`) e **`magicNumber`** funcionam para permitir que um mesmo cliente tenha um ou mais robôs controlados separadamente — com rastreabilidade, bloqueio de colisão e preparação para **tracking/execution por robô**, mantendo **estratégia caixa preta**.

---

## 2. Status atual

| Item | Valor |
|------|--------|
| Catálogo comercial | `COMMERCIAL_PLAN_CATALOG_DEFINED_WITH_PRICE_AND_REAL_CONTROLS` |
| Assinatura/licença | `SUBSCRIPTION_LICENSE_DATA_MODEL_DEFINED` |
| RC | `RELEASE_CANDIDATE_DEMO_STAGING_READY` |
| Preço | R$ 300,00 / robô ativo (`30000` centavos BRL) |
| Limite inicial | **1** `RobotInstance` ativa por cliente |
| Estrutura futura | Até **4** `RobotInstances` |
| Estratégia | Caixa preta |
| Conta real | **Não** aprovada automaticamente |
| Dispatch automático | **Desativado** |
| Esta fase | **Modelagem conceitual** apenas |

**Nota:** `RobotProduct` / `RobotInstance` / `MagicNumberRegistry` **não** existem ainda no Prisma. `Instruction` / `Execution` / `License` existem sem `robotInstanceId` / `magicNumber` — evolução futura.

---

## 3. Problema a resolver

Um cliente pode ter **vários robôs** rodando no MT5. Sem identidade separada por robô, há risco de:

- Conflito entre ordens e execuções  
- Tracking e auditoria ambíguos  
- Impossibilidade de cobrar/limitar por robô ativo  
- Colisão de `magicNumber` na mesma conta  

Cada robô precisa de:

- Identidade e **status** próprios  
- Vínculo com **assinatura** e **licença**  
- Conta MT5 vinculada (`accountLogin` / `accountServer`)  
- **Símbolo** e **perfil** autorizados (comercial — sem tática)  
- **`magicNumber` exclusivo** no escopo definido  
- Controle de ativação / pausa / bloqueio  
- Trilha futura de **execution** / **tracking** por robô  

---

## 4. Conceito de RobotProduct

`RobotProduct` representa o **produto/robô** disponível comercialmente no catálogo — **não** a instância de um cliente.

**Exemplos de nomes comerciais (sem revelar estratégia):**

| Nome comercial | Uso |
|----------------|-----|
| Robô Principal | Slot padrão |
| Robô Conservador | Perfil de exposição comercial |
| Robô Institucional | Revisão custom |
| Robô Simulador | Homologação / demo interno |

**Proibido em `RobotProduct`:**

- Lógica operacional, setup, filtros, gatilhos  
- Stop, alvo, horário, regra matemática  
- Nomes que revelem tática interna  

### Campos conceituais de RobotProduct

| Campo | Descrição |
|-------|-----------|
| `id` | PK |
| `name` | Nome interno admin |
| `slug` | ex.: `robo-principal` |
| `publicName` | Nome exibido ao cliente |
| `internalCode` | Código operacional (admin; não expor lógica) |
| `descriptionPublic` | Texto comercial genérico |
| `status` | ACTIVE / DEPRECATED |
| `defaultSymbol` | Símbolo padrão sugerido (ex.: WDOM26) |
| `defaultProfile` | Perfil de exposição padrão |
| `allowDemo` | **true** (inicial) |
| `allowReal` | **false** (até gate) |
| `maxInstancesPerUser` | 1 inicial; até 4 futuro |
| `requiresAdminApproval` | **true** |
| `createdAt` / `updatedAt` | timestamps |

---

## 5. Conceito de RobotInstance

`RobotInstance` representa um **robô específico liberado** para um cliente — unidade de cobrança (R$ 300,00/ativo) e de rastreio operacional.

**Exemplo — cliente HALLYTON:**

| Instância | Produto | MagicNumber |
|-----------|---------|-------------|
| RobotInstance 1 | Robô Principal | 910001 |
| RobotInstance 2 | Robô Complementar | 910002 |

### Campos conceituais de RobotInstance

| Campo | Descrição |
|-------|-----------|
| `id` | PK |
| `userId` | FK User |
| `subscriptionId` | FK Subscription |
| `licenseId` | FK License |
| `robotProductId` | FK RobotProduct |
| `name` | Nome interno |
| `displayName` | Nome exibido (opcional) |
| `symbol` | Símbolo autorizado |
| `profile` | Perfil de exposição (slug comercial) |
| `environment` | DEMO / STAGING / REAL (REAL bloqueado até gate) |
| `accountLogin` | Login MT5 |
| `accountServer` | Servidor MT5 |
| `magicNumber` | **Obrigatório** — ver §6–8 |
| `status` | §10 |
| `allowDemo` | **true** (inicial) |
| `allowReal` | **false** (até gate explícito) |
| `createdByAdminId` | Quem criou |
| `approvedByAdminId` / `approvedAt` | Aprovação admin |
| `pausedAt` / `suspendedAt` / `cancelledAt` | Ciclo de vida |
| `createdAt` / `updatedAt` | timestamps |

---

## 6. Conceito de MagicNumber

`magicNumber` é o identificador **numérico MT5** que diferencia ordens e execuções de cada robô na conta.

| Regra | Descrição |
|-------|-----------|
| Obrigatoriedade | Toda `RobotInstance` possui **um** `magicNumber` |
| Origem | Gerado ou validado por **backend/admin** |
| Cliente | **Não** escolhe livremente |
| Unicidade | Único no **escopo** definido (§7) |
| Config / instruction | Preservado em payloads futuros (allowlist) |
| Execution report | Registrado para auditoria e reconciliação |
| Colisão | **Bloqueia** criação/ativação → `MAGIC_NUMBER_COLLISION` |

---

## 7. Escopo de unicidade do MagicNumber

**Regra recomendada:** `magicNumber` único na combinação:

- `accountLogin`  
- `accountServer`  
- `environment`  
- `symbol`  
- (`robotProductId` **ou** `robotInstanceId` conforme política de produto)

**Prática:** não permitir **dois robôs ativos** na mesma conta + servidor + ambiente + símbolo com o mesmo `magicNumber`.

**Se colisão:**

1. Bloquear **criação** ou **ativação**  
2. Status `MAGIC_NUMBER_COLLISION`  
3. Exigir correção **admin** (reassign ou liberar registry)

**Implementação futura:** constraint unique composta em `RobotInstance` e/ou `MagicNumberRegistry` (§21).

---

## 8. Faixa inicial de MagicNumber

| Item | Valor |
|------|--------|
| Faixa sugerida | **910001** – **910999** (Mercado da Riqueza AutoTrade) |
| Demo inicial (exemplo) | 910001, 910002, 910003, 910004 |

**Observações:**

- Faixa pode ser **revista** antes da implementação.  
- **Não** usar `magicNumber` aleatório sem registro em `MagicNumberRegistry` ou `RobotInstance`.  
- Reserva via admin ou job controlado — nunca input livre no EA cliente.

---

## 9. Limite por cliente

| Regra | Valor |
|-------|--------|
| Limite inicial | **1** `RobotInstance` **ativa** |
| Estrutura futura | Até **4** `RobotInstances` |
| Cobrança | 1 robô ativo = R$ 300,00/mês (conceitual) |
| Assinatura | `Subscription.robotQuantity` = teto de instâncias |
| Criação | **Não** criar acima de `robotQuantity` |
| Ampliação | Exige **admin approval** + ajuste de assinatura |

---

## 10. Status de RobotInstance

| Status | Descrição |
|--------|-----------|
| `PENDING_SETUP` | Criada; ainda não configurada |
| `PENDING_ADMIN_APPROVAL` | Aguardando revisão admin |
| `ACTIVE_DEMO` | Ativa em DEMO/STAGING |
| `ACTIVE_REAL_PENDING_CONTROLS` | Conceitualmente preparada para real; aguarda gate + snapshots + margem (11.5) |
| `PAUSED` | Pausada operacionalmente |
| `SUSPENDED` | Suspensa (assinatura/licença/admin) |
| `CANCELLED` | Cancelada |
| `EXPIRED` | Expirada com assinatura |
| `BLOCKED` | Bloqueio risco/regra |
| `REAL_NOT_ALLOWED` | Real explicitamente negado |
| `MAGIC_NUMBER_COLLISION` | Colisão de `magicNumber` |
| `EXECUTOR_OFFLINE` | EA Executor sem heartbeat |

**Transições:** documentar em implementação via `RobotInstanceEvent` (futuro) ou reutilizar padrão `SubscriptionEvent`.

---

## 11. Relação com Subscription

| Regra | Descrição |
|-------|-----------|
| Limite | `Subscription.robotQuantity` = máximo de `RobotInstances` |
| Ativação | `Subscription` **ACTIVE** necessária para instância ativa |
| Suspensão/cancelamento | Propaga para `RobotInstance` (`SUSPENDED` / `CANCELLED` / `EXPIRED`) |
| Vencimento | Impede **novos** dispatches/instructions para o robô |
| Pagamento | **Não** define `allowReal=true` automaticamente |

---

## 12. Relação com License

| Regra | Descrição |
|-------|-----------|
| Vínculo | Toda `RobotInstance` referencia `licenseId` |
| License suspensa | Bloqueia `RobotInstance` |
| Device | Heartbeat do EA via `License` → `Device` |
| Multi-robô | Uma `License` pode atender **até 4** `RobotInstances` (futuro aprovado) |
| Inicial | 1 licença principal + 1 instância ativa |

---

## 13. Relação com EA Cliente / EA Executor

**Futuro** — EA deve receber ou conhecer (allowlist, sem estratégia):

- `robotInstanceId`  
- `magicNumber`  
- `symbol`  
- `profile`  
- `environment`  
- `accountLogin` / `accountServer`  
- Status permitido da instância  
- Se pode receber **instruction** (`haltNewEntries`, etc.)

**Esta fase:** **não** alterar EA. Contratos em `docs/` e rotas `/ea/*` evoluem em fase de implementação.

---

## 14. Relação com Instruction

**Futuro** — `Instruction` deve poder carregar:

| Campo | Uso |
|-------|-----|
| `robotInstanceId` | Destino do dispatch |
| `magicNumber` | Filtro MT5 / auditoria |
| `robotProductId` | Produto comercial |
| `symbol` | Símbolo alvo |
| `profile` | Perfil autorizado |
| `source` | `MASTER_SIGNAL` (admin/homologação) |
| Account target | `accountLogin` / `accountServer` |

**Atual:** tracking por `licenseId` + `Instruction` existente — compatível até migração gradual.

---

## 15. Relação com Execution

**Futuro** — execution report (`/ea/executions` ou equivalente) deve registrar:

- `robotInstanceId`  
- `magicNumber`  
- `accountLogin` / `accountServer`  
- `symbol`  
- `orderTicket` / `dealTicket`  
- Result status / `retcode`  
- Execution source  

**Objetivo:** auditoria **por robô** e reconciliação MT5 via `magicNumber` + `OrderLog` (`RECEIVED` → `EXECUTED`).

---

## 16. Relação com AccountSnapshot e margem

`AccountSnapshot` (Fase **11.5**) deve incluir, por conta:

- Robôs ativos e `magicNumbers` ativos  
- Status por `RobotInstance`  
- Margem geral da conta  
- Posições/ordens por `magicNumber` (quando MT5/report permitir)  
- Snapshots **pré-pregão** e **pós-pregão**  

`RobotInstance` **ACTIVE** em DEMO **não** substitui gate de conta real.

---

## 17. Controle de colisão

Validações futuras (criação/ativação):

| Validação | Ação se falhar |
|-----------|----------------|
| `magicNumber` ausente | Rejeitar |
| Não numérico | Rejeitar |
| Fora da faixa 910001–910999 (ou faixa vigente) | Rejeitar |
| Duplicado no escopo (§7) | `MAGIC_NUMBER_COLLISION` |
| Ativo em instância cancelada recentemente | Bloquear até **liberação admin** |
| Colisão detectada | Bloquear ativação; alerta admin |

---

## 18. Exemplos práticos

**Cliente:** HALLYTON  
**Plano:** Multi-Robot Ready (futuro; hoje Single Robot = 1 ativo)  
**Conta:** `52609973` @ `XPMT5-DEMO`  

| # | Robô (comercial) | Symbol | Environment | MagicNumber | Status |
|---|------------------|--------|-------------|-------------|--------|
| 1 | Robô Principal | WDOM26 | DEMO | 910001 | `ACTIVE_DEMO` |
| 2 | Robô Complementar | WDOM26 | DEMO | 910002 | `PENDING_SETUP` |
| 3 | Robô Simulador | WIN | DEMO | 910003 | `PAUSED` |
| 4 | Robô Institucional | A DEFINIR | DEMO | 910004 | `PENDING_ADMIN_APPROVAL` |

*Apenas a instância 1 estaria **ativa** no limite inicial de 1 robô; demais slots ilustram modelo futuro até 4.*

---

## 19. Estratégia caixa preta

`RobotProduct` e `RobotInstance` **não** expõem:

- Lógica do robô, parâmetros internos  
- Regras de entrada/saída, filtros, horários  
- Stop, alvo, setup, racional operacional  

**Expor apenas ao cliente:**

- Nome comercial · status · ambiente  
- Símbolo permitido · `magicNumber` (se política UX permitir)  
- Conta vinculada · saúde do executor  
- Assinatura/licença · tracking agregado (sem tática)

Admin comercial **não** precisa ver vault de estratégia para liberar produto/instância.

---

## 20. Regras de bloqueio

Bloquear `RobotInstance` (criação, ativação ou instruction) se:

- Assinatura **não** `ACTIVE`  
- Licença **suspensa** / revogada  
- Termos **não** aceitos  
- `magicNumber` ausente ou **duplicado**  
- Conta MT5 **divergente** da licença  
- Símbolo **não** autorizado  
- EA Executor **offline** / heartbeat ausente  
- **Real Trading Guard** bloquear (ver [`REAL-TRADING-GUARD-FINAL-REPORT.md`](REAL-TRADING-GUARD-FINAL-REPORT.md))  
- Tentativa de **real** sem gate  
- Margem insuficiente (futuro — 11.5)  
- Snapshot pré-pregão ausente (futuro — 11.5)  
- Admin **não** aprovou  
- Limite de robôs **excedido** (`robotQuantity`)  
- Dispatch automático (política global — permanece **off**)

---

## 21. Campos conceituais de MagicNumberRegistry

*(Opcional — registro central de reserva/liberação; sem implementar nesta fase.)*

| Campo | Descrição |
|-------|-----------|
| `id` | PK |
| `magicNumber` | Int |
| `environment` | DEMO / STAGING / REAL |
| `accountLogin` / `accountServer` | Escopo |
| `symbol` | Símbolo |
| `robotInstanceId` | FK quando atribuído |
| `userId` | FK |
| `status` | § abaixo |
| `reservedAt` / `activatedAt` / `releasedAt` | Ciclo |
| `releasedByAdminId` | Liberação manual |
| `notes` | Admin (redigido) |
| `createdAt` / `updatedAt` | |

**Status do registry:** `RESERVED` · `ACTIVE` · `RELEASED` · `BLOCKED` · `COLLISION`

---

## 22. Decisões da Fase 11.4

| Decisão | Valor |
|---------|--------|
| `RobotProduct` | Produto comercial **sem** expor estratégia |
| `RobotInstance` | Robô liberado por cliente |
| `magicNumber` | **Obrigatório**; admin/backend |
| Faixa inicial | **910001–910999** |
| Limite inicial | **1** instância ativa |
| Futuro | Até **4** instâncias |
| Colisão | Bloqueia ativação |
| Instruction/Execution/tracking | Por robô — **implementação futura** |
| Schema/migration | **Não** nesta fase |
| Conta real / dispatch auto | **Bloqueados** |

---

## 23. Próximas fases sugeridas

| Fase | Nome |
|------|------|
| **11.5** | Account Snapshot & Margin Control Architecture |
| **11.6** | Customer Portal Commercial Flow |
| **11.7** | Admin Commercial Approval Flow |
| **11.8** | Payment Gateway Decision |
| **11.9** | Demo Commercial Flow Validation |
| **11.10** | Commercial Flow Final Report |

---

## 24. Status final

| Campo | Valor |
|-------|--------|
| **Status** | `ROBOT_INSTANCE_MAGIC_NUMBER_MODEL_DEFINED` |
| **Decisão** | `REAL_ACCOUNT_NOT_APPROVED_AUTOMATICALLY` |
| **Conta real** | Bloqueada até gate |
| **Produção real** | Bloqueada |
| **Dispatch automático** | Desativado |
| **Estratégia** | Caixa preta preservada |

---

*Mercado da Riqueza AutoTrade — modelo conceitual RobotInstance & MagicNumber (Fase 11.4). Sem alteração de schema ou EA.*
