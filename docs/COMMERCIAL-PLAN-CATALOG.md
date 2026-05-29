# Commercial Plan Catalog & Paid Robot Subscription Rules — Mercado da Riqueza AutoTrade

---

> **Aviso inicial**
>
> Este catálogo define a estrutura comercial inicial para **aluguel/assinatura de robôs** do Mercado da Riqueza AutoTrade.
>
> - **Não** revela a estratégia interna dos robôs.  
> - **Não** autoriza automaticamente conta real.  
> - **Não** autoriza dispatch automático.  
> - **Não** implementa gateway de pagamento.  
> - **Não** altera schema, código, EA ou produção.  
> - Qualquer operação **real** depende de controles internos, gate operacional e aprovação específica.

**Data:** 2026-05-27  
**Fase:** 11.2 — Commercial Plan Catalog & Paid Robot Subscription Rules  
**Status:** `COMMERCIAL_PLAN_CATALOG_DEFINED_WITH_PRICE_AND_REAL_CONTROLS`  
**Decisão:** `REAL_ACCOUNT_NOT_APPROVED_AUTOMATICALLY`

Base: [`COMMERCIAL-SUBSCRIPTION-MULTI-ROBOT-ARCHITECTURE.md`](COMMERCIAL-SUBSCRIPTION-MULTI-ROBOT-ARCHITECTURE.md)

---

## 1. Objetivo

Definir o **catálogo comercial inicial** para assinatura/aluguel de robôs, incluindo:

- Preço por robô (**R$ 300,00** inicial)  
- Limite inicial (**1** robô) e estrutura futura (**até 4** robôs por cliente)  
- Relação com licença, `RobotInstance`, `magicNumber`  
- Controles internos para **futura** operação real controlada  

---

## 2. Status atual

| Item | Valor |
|------|--------|
| Produto / RC | `RELEASE_CANDIDATE_DEMO_STAGING_READY` |
| Arquitetura comercial | `COMMERCIAL_SUBSCRIPTION_MULTI_ROBOT_ARCHITECTURE_DEFINED` (11.1) |
| Preço inicial | **R$ 300,00** por robô |
| Robôs disponíveis inicialmente | **1** |
| Estrutura futura | **Até 4** robôs por cliente |
| Estratégia ao cliente | **Caixa preta** — não revelada |
| Conta real | **Não** liberada automaticamente pelo pagamento |
| Dispatch automático | **Desativado** |
| Gateway pagamento | Fase futura |
| Schema / migration | Fase futura |

---

## 3. Princípios comerciais

- Produto vendido/alugado **por robô** (por `RobotInstance` ativa).  
- Valor inicial: **R$ 300,00** por robô.  
- Cliente pode ter mais de um robô conforme **plano aprovado**.  
- **Inicialmente:** apenas **1** robô disponibilizado por cliente.  
- **Estrutura:** suportar até **4** robôs por cliente.  
- Cada robô contratado = uma **`RobotInstance`**.  
- Cada `RobotInstance` = **`magicNumber` próprio**.  
- Cliente **não** escolhe `magicNumber` livremente — backend/admin gera ou valida.  
- Estratégia **caixa preta** — sem lógica interna ao cliente.  
- Cliente vê: produto, status, plano, licença, robô, conta, execução, tracking e resultado **permitido** (agregado).  
- **Pagamento não libera conta real** automaticamente.  
- Conta real exige: validação operacional, margem, controles internos, snapshots, gate e **aprovação administrativa**.

---

## 4. Política de sigilo da estratégia

O robô é **produto operacional de caixa preta**.

### Não expor ao cliente

- Lógica da estratégia  
- Critérios de entrada / saída  
- Stops, alvos, filtros, horários  
- Gatilhos, retrações, condições de entrada  
- Parâmetros internos, setup, regras matemáticas  
- Leitura de mercado que permita **replicar** a estratégia  

### Pode expor

- Nome **comercial** do robô  
- Status ativo / pausado / suspenso  
- Símbolo **autorizado**  
- Ambiente DEMO / REAL (quando aplicável e aprovado)  
- `magicNumber` (se política de UX permitir)  
- Conta MT5 vinculada (login/servidor, sem senha)  
- Histórico operacional **permitido**  
- Tracking consolidado **por robô** (futuro)  
- Resultado agregado permitido  
- Status de assinatura e do EA  

---

## 5. Planos comerciais iniciais

### Plano Single Robot

| Campo | Valor |
|-------|--------|
| **Preço** | R$ 300,00 por robô |
| **Objetivo** | Plano inicial — liberação de **1** robô |
| **Status do plano** | `INITIAL_COMMERCIAL_PLAN` |
| **Conta real** | **Não** liberada automaticamente |

**Recursos:**

- 1 `RobotInstance`  
- 1 `magicNumber`  
- 1 conta MT5 vinculada  
- Acesso ao portal  
- Acompanhamento de status  
- Licença operacional vinculada  
- Dispatch **manual**  
- Real Trading Guard **ativo**  
- Estratégia **caixa preta**  

---

### Plano Multi-Robot Ready

| Campo | Valor |
|-------|--------|
| **Preço** | R$ 300,00 por robô **ativo** |
| **Objetivo** | Estrutura para cliente com mais de um robô |
| **Status do plano** | `FUTURE_READY` |
| **Conta real** | Somente via **gate específico** |

**Recursos:**

- Até **4** `RobotInstances`  
- Até **4** `magicNumbers`  
- 1 ou mais símbolos conforme aprovação  
- Tracking separado por robô (futuro)  
- Status individual por robô  
- Assinatura = **quantidade de robôs ativos × R$ 300,00**  

---

### Plano Institutional / Custom

| Campo | Valor |
|-------|--------|
| **Preço** | A definir |
| **Objetivo** | Parceiros, corretoras, mesas, validações institucionais |
| **Status do plano** | `CUSTOM_REVIEW_REQUIRED` |
| **Conta real** | Gate + revisão jurídica/comercial |

**Recursos:** limite customizado; múltiplos robôs; múltiplas contas se aprovado; integração assistida.

---

## 6. Regra de preço

| Regra | Detalhe |
|-------|---------|
| Preço base | **R$ 300,00** por robô (`RobotInstance` ativa) |
| Cálculo | Por instância ativa na assinatura |

**Exemplos:**

| Robôs ativos | Valor mensal (referência) |
|--------------|---------------------------|
| 1 | R$ 300,00 |
| 2 | R$ 600,00 |
| 3 | R$ 900,00 |
| 4 | R$ 1.200,00 |

- Preços **podem ser revisados** futuramente (nova versão de catálogo).  
- Preço **não** é promessa de rentabilidade.  
- Preço **não** autoriza conta real automaticamente.  
- Preço **não** autoriza dispatch automático.

**Representação técnica futura:** `pricePerRobotCents = 30000`, `currency = BRL`.

---

## 7. Limites por cliente

| Limite | Valor |
|--------|--------|
| **Inicial** | 1 robô por cliente |
| **Estrutural (futuro)** | Até **4** robôs por cliente |

Cada robô exige: `RobotInstance` · `magicNumber` · status próprio · vínculo assinatura/licença · controle de ambiente · tracking próprio (futuro).

**Ampliação 1 → 4:** exige **aprovação administrativa** e atualização de assinatura (quantidade × preço).

---

## 8. Matriz de recursos

| Recurso | Single Robot | Multi-Robot Ready | Institutional |
|---------|:------------:|:-----------------:|:-------------:|
| Preço por robô | R$ 300,00 | R$ 300,00 | A definir |
| Robôs ativos (máx.) | 1 | 4 | Custom |
| magicNumbers | 1 | até 4 | Custom |
| Portal do cliente | Sim | Sim | Sim |
| Tracking | Sim | Por robô (futuro) | Sim |
| Estratégia caixa preta | Sim | Sim | Sim |
| Licença vinculada | Sim | Sim | Sim |
| Dispatch manual | Sim | Sim | Sim |
| Dispatch automático | **Não** | **Não** | **Não** |
| Conta DEMO | Sim | Sim | Se aprovado |
| Conta REAL | Não automática | Gate futuro | Gate + revisão |
| Real Trading Guard | Ativo | Ativo | Ativo |
| Admin approval | Sim | Sim | Sim |
| Gateway pagamento | Futuro | Futuro | Futuro |
| Revisão jurídica | Recomendada | Recomendada | **Obrigatória** |

---

## 9. Fluxo comercial desejado

```text
Cliente acessa site
  → escolhe plano
  → cria cadastro
  → aceita termos / disclaimers
  → seleciona quantidade de robôs (1 inicial; até 4 futuro)
  → visualiza valor estimado (robôs × R$ 300,00)
  → solicita contratação ou pagamento (gateway futuro)
  → assinatura PENDING_*
  → admin revisa
  → admin aprova
  → sistema vincula assinatura + licença
  → sistema cria RobotInstance(s) + magicNumber
  → cliente recebe activation / onboarding
  → EA ativa device
  → admin acompanha online
  → cliente acompanha portal
```

---

## 10. Estados da assinatura

`PENDING_PAYMENT` · `PENDING_ADMIN_REVIEW` · `ACTIVE` · `SUSPENDED` · `CANCELLED` · `EXPIRED` · `BLOCKED`

---

## 11. Estados da RobotInstance

`PENDING_SETUP` · `ACTIVE_DEMO` · `ACTIVE_REAL_PENDING_CONTROLS` · `PAUSED` · `SUSPENDED` · `CANCELLED` · `EXPIRED` · `BLOCKED` · `REAL_NOT_ALLOWED`

**Nota:** `ACTIVE_REAL_PENDING_CONTROLS` = robô aprovado comercialmente para discussão real, mas **sem** operação real até controles + gate + guard.

---

## 12. Número mágico

- **Obrigatório** por `RobotInstance`.  
- **Único** por cliente/conta/robô (regra de escopo a detalhar em 11.4).  
- Gerado/validado por **backend/admin**.  
- Usado pelo **EA** para diferenciar ordens (implementação futura).  
- Persistido no banco; em reports/executions; auditoria por robô.  
- **Colisão** → bloqueia liberação.

**Exemplo (4 robôs):** `910001` · `910002` · `910003` · `910004`

---

## 13. Controles internos obrigatórios antes de operação real

Antes de **qualquer** conta real, o sistema deve **controlar e persistir** (futuro):

| Controle | Descrição |
|----------|-----------|
| Envio de ordens | Funcionalidade habilitada só com gate |
| Confirmação EA Executor | Recebimento de instruction |
| Status EA Executor | Online / erro / pausado |
| Heartbeat | Atualização recente |
| Status conta MT5 | Conectada / divergente |
| Margem disponível | Pré-operação |
| Saldo / equity | Snapshot |
| Margem usada / livre / nível | Snapshot |
| Posições abertas | Contagem e símbolos |
| Ordens pendentes | Contagem |
| Símbolo autorizado | Por `RobotInstance` |
| Conta autorizada | Login/servidor |
| magicNumber ativo | Por robô |
| Robô ativo | `RobotInstance` status |
| Assinatura ativa | `ACTIVE` |
| Licença ativa | Operacional |
| Real Trading Guard | Não bloquear indevidamente / bloquear REAL sem gate |
| Autorização manual admin | Registro explícito |

---

## 14. Snapshots obrigatórios da conta

### Pré-pregão (`PRE_MARKET`)

Data · cliente · conta MT5 · servidor · ambiente · saldo · equity · margem disponível · margem usada · margem livre · nível de margem · posições abertas · ordens pendentes · robôs ativos · magicNumbers ativos · status EAs · status licenças · observações

### Fim de pregão (`POST_MARKET`)

Data · cliente · conta · servidor · saldo final · equity final · margens finais · posições/ordens remanescentes · resultado do dia (se disponível) · execuções do dia · robôs · magicNumbers usados · incidentes · observações

---

## 15. Regra operacional dos snapshots

- Snapshot **pré-pregão** antes de qualquer envio operacional **real** futuro.  
- Snapshot **fim de pregão** após encerramento operacional.  
- Ausência pré-pregão → **bloqueia** operação real futura.  
- Ausência fim de pregão → **pendência** operacional.  
- Snapshots **não** liberam conta real sozinhos — são **auditoria** e base de gate.

Fase dedicada sugerida: **11.5 — Account Snapshot & Margin Control Architecture**.

---

## 16. Controle de margem

- Margem consultada **antes** de liberar operação real.  
- Margem **insuficiente** → bloqueio operação.  
- Regra considera ativo, quantidade, conta, risco, config **interna** (não exposta ao cliente).  
- Valores variam — dado **operacional**, não fixo no catálogo.  
- Registrar margem pré-sessão e fim de sessão.  
- Status sugerido: `BLOCKED_INSUFFICIENT_MARGIN`.

---

## 17. Regras de bloqueio comercial/operacional

Bloquear cliente/robô se:

- Assinatura não `ACTIVE`  
- Licença suspensa  
- `RobotInstance` suspensa  
- `magicNumber` ausente ou duplicado  
- EA Executor offline  
- Heartbeat ausente  
- Margem insuficiente  
- Snapshot pré-pregão ausente (real futuro)  
- Conta ou símbolo divergente  
- Tentativa conta real sem gate  
- Real Trading Guard bloqueia  
- Dispatch automático sem autorização  
- Termos não aceitos  
- Pagamento pendente (quando gateway ativo)

---

## 18. Relação com Real Trading Guard

Mesmo com **pagamento ativo**:

- **Conta real não** liberada automaticamente.  
- Real Trading Guard **permanece ativo**.  
- Allowlist futura só após **gate específico**.  
- Assinatura libera **plano / robô DEMO** e portal — **não** libera risco real automaticamente.

---

## 19. Campos conceituais futuros (sem implementar)

### CommercialPlan

`pricePerRobotCents` · `currency` · `maxRobots` · `allowReal` · `allowAutoDispatch` · `requiresAdminApproval`

### Subscription

`robotQuantity` · `totalAmountCents` · `status` · `billingCycle` · `acceptedTermsAt` · `adminApprovedAt`

### RobotInstance

`magicNumber` · `robotProductId` · `subscriptionId` · `licenseId` · `status` · `symbol` · `accountLogin` · `accountServer` · `environment`

### AccountSnapshot

`userId` · `licenseId` · `robotInstanceId?` · `accountLogin` · `accountServer` · `snapshotType` (`PRE_MARKET` / `POST_MARKET`) · `balance` · `equity` · `margin` · `freeMargin` · `marginLevel` · `openPositions` · `pendingOrders` · `activeMagicNumbers` · `capturedAt`

### ExecutorHealth

`robotInstanceId` · `deviceId` · `heartbeatAt` · `executorStatus` · `lastInstructionAt` · `lastExecutionReportAt` · `canReceiveOrders`

---

## 20. Decisões da Fase 11.2

| Decisão | Valor |
|---------|--------|
| Preço base | R$ 300,00 / robô |
| Disponibilidade inicial | 1 robô |
| Estrutura futura | Até 4 robôs |
| Estratégia | Caixa preta |
| MagicNumber | Obrigatório por instância |
| Pagamento | Não libera real automaticamente |
| Operação real futura | Margem + snapshots + EA online + gate |
| Schema/migration | **Não** nesta fase |

---

## 21. Próximas fases sugeridas

| Fase | Nome |
|------|------|
| **11.3** | Subscription & License Data Model |
| **11.4** | RobotInstance & MagicNumber Data Model |
| **11.5** | Account Snapshot & Margin Control Architecture |
| **11.6** | Customer Portal Commercial Flow |
| **11.7** | Admin Commercial Approval Flow |
| **11.8** | Payment Gateway Decision |
| **11.9** | Demo Commercial Flow Validation |
| **11.10** | Commercial Flow Final Report |

---

## 22. Status final

| Campo | Valor |
|-------|--------|
| **Status** | `COMMERCIAL_PLAN_CATALOG_DEFINED_WITH_PRICE_AND_REAL_CONTROLS` |
| **Decisão** | `REAL_ACCOUNT_NOT_APPROVED_AUTOMATICALLY` |
| **Conta real** | Bloqueada até gate |
| **Produção real** | Bloqueada |
| **Dispatch automático** | Desativado |

---

*Mercado da Riqueza AutoTrade — catálogo comercial e regras de assinatura paga por robô (Fase 11.2). Documentação apenas.*
