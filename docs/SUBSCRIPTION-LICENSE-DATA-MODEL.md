# Subscription & License Data Model — Mercado da Riqueza AutoTrade

---

> **Aviso inicial**
>
> Este documento define o **modelo conceitual** de assinatura e licença para a plataforma comercial.
>
> - **Não** cria schema.  
> - **Não** cria migration.  
> - **Não** altera código.  
> - **Não** implementa gateway de pagamento.  
> - **Não** autoriza conta real.  
> - **Não** autoriza produção real.  
> - **Não** ativa dispatch automático.

**Data:** 2026-05-27  
**Fase:** 11.3 — Subscription & License Data Model  
**Status:** `SUBSCRIPTION_LICENSE_DATA_MODEL_DEFINED`  
**Decisão:** `REAL_ACCOUNT_NOT_APPROVED_AUTOMATICALLY`

Base: [`COMMERCIAL-SUBSCRIPTION-MULTI-ROBOT-ARCHITECTURE.md`](COMMERCIAL-SUBSCRIPTION-MULTI-ROBOT-ARCHITECTURE.md), [`COMMERCIAL-PLAN-CATALOG.md`](COMMERCIAL-PLAN-CATALOG.md)

---

## 1. Objetivo

Definir como **planos comerciais**, **assinaturas**, **licenças**, **aceite de termos** e **aprovação administrativa** se relacionam para liberação controlada de clientes — operação inicial em **DEMO/STAGING**, base para **múltiplos robôs** por cliente (`robotQuantity`).

---

## 2. Status atual

| Item | Valor |
|------|--------|
| RC | `RELEASE_CANDIDATE_DEMO_STAGING_READY` |
| Catálogo | `COMMERCIAL_PLAN_CATALOG_DEFINED_WITH_PRICE_AND_REAL_CONTROLS` |
| Preço | R$ 300,00 / robô ativo (`30000` centavos BRL) |
| Robôs iniciais | 1 · estrutura até **4** |
| Conta real | **Não** automática pelo pagamento |
| Dispatch automático | **Desativado** |
| Gateway | Ainda não definido (fase 11.8) |
| Esta fase | **Modelagem conceitual** apenas |

### Já existente no Prisma (referência — sem alteração)

| Modelo | Papel |
|--------|--------|
| `Plan` | Plano / catálogo |
| `PlanPrice` | Preço por intervalo |
| `Subscription` | Assinatura usuário ↔ plano |
| `License` | Licença operacional EA (`subscriptionId` opcional hoje) |
| `Invoice` / `Payment` | Billing parcial |
| `WebhookEvent` | Eventos gateway |

**Evolução proposta:** alinhar enums/campos comerciais (§9–10) e adicionar `TermsAcceptance`, `SubscriptionEvent`, `PaymentEvent` comercial estendido na implementação futura.

---

## 3. Problema a resolver

Formalizar:

- Assinatura **comercial** (status, robôs, valor)  
- Status de **pagamento** e revisão admin  
- **Aceite de termos** versionado  
- Relação **Subscription ↔ License** obrigatória para novos clientes  
- Bloqueio por vencimento / cancelamento / suspensão  
- Liberação pós-contratação  
- **Trilha** de eventos comerciais  
- Base para cobrança **por robô ativo**

---

## 4. Fluxo de liberação desejado

```text
Cliente acessa site
  → escolhe plano (CommercialPlan / Plan)
  → cria cadastro (User)
  → aceita termos DEMO/disclaimers (TermsAcceptance)
  → solicita assinatura ou pagamento
  → Subscription: PENDING_PAYMENT ou PENDING_ADMIN_REVIEW
  → admin revisa
  → admin aprova
  → Subscription: ACTIVE
  → License criada ou vinculada
  → activation code liberado (Device)
  → RobotInstance (Fase 11.4)
  → magicNumber (Fase 11.4)
  → cliente ativa EA
  → device ativo
  → admin: heartbeat / tracking
```

---

## 5. Entidades conceituais

### CommercialPlan

Plano comercial disponível no site.  
Exemplos: **Single Robot**, **Multi-Robot Ready**, **Institutional**.  
**Mapeamento:** `Plan` existente + campos/features futuros (`maxRobots`, `pricePerRobotCents`).

### Subscription

Assinatura do cliente a um plano.  
Controla: status comercial, validade, `robotQuantity`, valor total, aprovação admin.  
**Mapeamento:** `Subscription` existente + extensões.

### License

Autorização **operacional** para EA (heartbeat, instructions).  
**Deve** vincular-se a `Subscription` ativa (regra nova para clientes comerciais).

### TermsAcceptance

Aceite de termos, disclaimers, ciência de risco.  
Versão do documento, data, hashes de IP/UA se política exigir.

### SubscriptionEvent

Trilha histórica: criada, aprovada, suspensa, cancelada, etc.

### PaymentEvent

Eventos de pagamento (gateway futuro). Conceitual nesta fase.  
**Relacionado:** `Invoice` / `Payment` / `WebhookEvent` existentes.

---

## 6. Relação entre entidades

```text
User
  → Subscription (N)
      → CommercialPlan / Plan

Subscription
  → License (1..N — inicialmente 1 principal)
  → TermsAcceptance (1..N por versão)
  → SubscriptionEvent (auditoria)
  → PaymentEvent / Invoice / Payment (futuro)

License
  → Device
  → EA Cliente (executor)

Subscription (futuro)
  → RobotInstance (Fase 11.4)
      → magicNumber
```

---

## 7. Regra principal de assinatura

| Regra | Descrição |
|-------|-----------|
| Acesso robô | `Subscription` válida necessária |
| ACTIVE ≠ real | `ACTIVE` **não** libera conta real automaticamente |
| ACTIVE permite | Portal, licença, onboarding, robô **DEMO/STAGING** |
| License | Bloqueada se assinatura suspensa/cancelada/expirada |
| Vencida | Suspende novas liberações |
| Cancelamento | Impede novos dispatches (política futura no motor) |
| Pagamento pendente | `PENDING_PAYMENT` ou `PENDING_ADMIN_REVIEW` |

---

## 8. Relação assinatura → licença

- Uma `Subscription` pode ter **uma ou mais** `License` (evolução); **inicialmente 1** licença principal.  
- `License.subscriptionId` — **obrigatório** para fluxo comercial novo.  
- `License` sem assinatura ativa → **restrita** (sem novas ativações).  
- Assinatura **suspensa** → licença `LICENSE_SUSPENDED_BY_SUBSCRIPTION` (conceitual).  
- Device já ativado → política de suspensão/reativação em fase de implementação.

---

## 9. Status da assinatura

| Status comercial (11.x) | Descrição | Mapeamento Prisma atual (referência) |
|-------------------------|-----------|-------------------------------------|
| `PENDING_PAYMENT` | Contratação iniciada; pagamento não confirmado | `INCOMPLETE` / extensão |
| `PENDING_ADMIN_REVIEW` | Aguardando revisão admin | Novo / `INCOMPLETE` |
| `ACTIVE` | Aprovada e operacional no escopo permitido | `ACTIVE` |
| `SUSPENDED` | Suspensa temporariamente | `PAUSED` |
| `CANCELLED` | Cancelada | `CANCELLED` |
| `EXPIRED` | Vencida | `currentPeriodEnd` + regra |
| `BLOCKED` | Bloqueio risco/fraude/termos | Novo |

**Nota implementação futura:** unificar enum ou camada de mapeamento comercial ↔ `SubscriptionStatus` existente.

---

## 10. Status da licença em contexto comercial

Camada **comercial** sobre `LicenseStatus` existente (`PENDING_ACTIVATION`, `ACTIVE`, `SUSPENDED`, `REVOKED`):

| Status comercial | Significado |
|------------------|-------------|
| `LICENSE_PENDING_SUBSCRIPTION` | Criada; assinatura ainda não ativa |
| `LICENSE_ACTIVE` | Ativa com assinatura válida |
| `LICENSE_SUSPENDED_BY_SUBSCRIPTION` | Assinatura suspensa |
| `LICENSE_CANCELLED_BY_SUBSCRIPTION` | Assinatura cancelada |
| `LICENSE_EXPIRED_BY_SUBSCRIPTION` | Assinatura expirada |
| `LICENSE_BLOCKED_BY_ADMIN` | Bloqueio manual admin |

---

## 11. Campos conceituais de CommercialPlan

*(Proposta — não implementar agora. Evoluir `Plan` + `PlanFeature`.)*

| Campo | Tipo / notas |
|-------|----------------|
| `id` | PK |
| `name` | ex.: Single Robot |
| `slug` | ex.: `single-robot` |
| `description` | Comercial — **sem** estratégia |
| `status` | ACTIVE / DEPRECATED |
| `pricePerRobotCents` | **30000** |
| `currency` | **BRL** |
| `maxRobots` | 1 (Single) / 4 (Multi) |
| `initialRobotLimit` | 1 |
| `allowDemo` | **true** |
| `allowReal` | **false** |
| `allowAutoDispatch` | **false** |
| `requiresAdminApproval` | **true** |
| `requiresLegalReview` | false / true (Institutional) |
| `requiresTermsAcceptance` | **true** |
| `supportLevel` | standard / institutional |
| `billingCycle` | monthly (placeholder) |
| `createdAt` / `updatedAt` | timestamps |

---

## 12. Campos conceituais de Subscription

| Campo | Tipo / notas |
|-------|----------------|
| `id` | PK |
| `userId` | FK User |
| `commercialPlanId` / `planId` | FK Plan |
| `status` | §9 |
| `robotQuantity` | 1 inicial; até 4 |
| `pricePerRobotCents` | 30000 (snapshot na contratação) |
| `totalAmountCents` | `robotQuantity × pricePerRobotCents` |
| `currency` | BRL |
| `billingCycle` | monthly |
| `startsAt` / `expiresAt` | vigência |
| `cancelledAt` / `suspendedAt` | |
| `paymentProvider` | stripe / mercadopago / manual |
| `externalCustomerId` / `externalSubscriptionId` | gateway |
| `adminApprovedBy` / `adminApprovedAt` | obrigatório para ACTIVE |
| `termsAcceptedAt` / `termsVersion` | denormalizado ou via TermsAcceptance |
| `createdAt` / `updatedAt` | |

---

## 13. Campos conceituais de TermsAcceptance

| Campo | Tipo / notas |
|-------|----------------|
| `id` | PK |
| `userId` | FK |
| `subscriptionId` | FK |
| `documentType` | BETA_DEMO_TERMS · COMMERCIAL_SUBSCRIPTION · RISK_DISCLAIMER · REAL_GATE (futuro) |
| `documentVersion` | ex.: `2026-05-27` |
| `acceptedAt` | |
| `acceptedByName` / `acceptedByEmail` | |
| `ipAddressHash` / `userAgentHash` | não IP bruto se política exigir |
| `source` | web_checkout · admin_manual |
| `createdAt` | |

---

## 14. Campos conceituais de SubscriptionEvent

| Campo | Tipo / notas |
|-------|----------------|
| `id` | PK |
| `subscriptionId` | FK |
| `userId` | FK |
| `eventType` | ver lista |
| `previousStatus` / `newStatus` | |
| `reason` | texto admin/sistema |
| `metadataRedacted` | JSON redigido |
| `createdBy` | userId admin ou system |
| `createdAt` | |

**eventType:** `CREATED` · `TERMS_ACCEPTED` · `PAYMENT_PENDING` · `PAYMENT_CONFIRMED` · `ADMIN_APPROVED` · `ACTIVATED` · `SUSPENDED` · `CANCELLED` · `EXPIRED` · `BLOCKED` · `REACTIVATED`

---

## 15. Campos conceituais de PaymentEvent

| Campo | Tipo / notas |
|-------|----------------|
| `id` | PK |
| `subscriptionId` | FK |
| `userId` | FK |
| `provider` | stripe / mercadopago / asaas / manual |
| `providerEventId` | idempotência webhook |
| `eventType` | payment_succeeded / payment_failed / refund |
| `amountCents` / `currency` | |
| `status` | |
| `paidAt` / `failedAt` | |
| `metadataRedacted` | sem dados de cartão |
| `createdAt` | |

**Observação:** gateway não definido. Pode integrar com `Invoice`/`Payment` existentes na implementação.

---

## 16. Regras de bloqueio comercial

Bloquear assinatura/licença se:

- Termos **não** aceitos  
- Pagamento **pendente** (quando gateway ativo)  
- Admin **não** aprovou  
- Assinatura **vencida** / **cancelada** / **suspensa** / **bloqueada**  
- Tentativa **conta real** sem gate  
- Tentativa **dispatch automático**  
- Exceder **limite de robôs** (`robotQuantity`)  
- Criar `RobotInstance` sem assinatura `ACTIVE`  
- `magicNumber` duplicado (Fase 11.4)

---

## 17. Regras de liberação admin

Admin (futuro) poderá:

- Revisar / aprovar / rejeitar assinatura  
- Suspender / cancelar / bloquear / reativar  
- Vincular ou liberar **licença**  
- Consultar **TermsAcceptance**  
- Consultar **SubscriptionEvent**  
- Consultar status consolidado do cliente  

---

## 18. Relação com estratégia caixa preta

- `Subscription`, `License`, `Plan` — **sem** campos de estratégia.  
- Portal — **sem** regras internas do robô.  
- Admin comercial libera **acesso**, não **lógica**.  
- Cliente compra/aluga **produto operacional**, não a estratégia.

---

## 19. Relação com magicNumber e RobotInstance

| Item | Fase |
|------|------|
| Assinatura / licença | **11.3** (este documento) |
| `RobotInstance` + `magicNumber` | **11.4** |
| `Subscription.robotQuantity` | Limite de instâncias |
| `License` | Vínculo futuro 1:N com instâncias |
| Cada instância | `magicNumber` obrigatório |

---

## 20. Relação com Account Snapshot e margem

| Item | Fase |
|------|------|
| Snapshots / margem | **11.5** |
| `Subscription ACTIVE` | **Insuficiente** para operação real |
| Operação real | Snapshots pré-pregão + margem + EA online + gate |
| Pagamento | **Não** substitui controles operacionais |

---

## 21. Regras de segurança e redaction

- **Sem** dados de cartão em `PaymentEvent`.  
- `metadataRedacted` — sem secrets.  
- Term acceptance: preferir **hash** de IP/UA.  
- Logs admin — redaction auditada (Fase 7).  
- Dados financeiros — LGPD / revisão jurídica.

---

## 22. Decisões da Fase 11.3

| Decisão | Valor |
|---------|--------|
| Entidade central comercial | `Subscription` |
| `License` | Vinculada à `Subscription` |
| `TermsAcceptance` | Obrigatório antes de ativação |
| `SubscriptionEvent` | Trilha histórica obrigatória |
| `PaymentEvent` | Preparado para gateway |
| Pagamento | **Não** libera conta real |
| Admin approval | **Obrigatório** |
| Schema/migration | Fase de implementação posterior |

---

## 23. Próximas fases sugeridas

| Fase | Nome |
|------|------|
| **11.4** | RobotInstance & MagicNumber Data Model |
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
| **Status** | `SUBSCRIPTION_LICENSE_DATA_MODEL_DEFINED` |
| **Decisão** | `REAL_ACCOUNT_NOT_APPROVED_AUTOMATICALLY` |
| **Conta real** | Bloqueada até gate |
| **Produção real** | Bloqueada |
| **Dispatch automático** | Desativado |

---

*Mercado da Riqueza AutoTrade — modelo conceitual Subscription & License (Fase 11.3). Sem alteração de schema.*
