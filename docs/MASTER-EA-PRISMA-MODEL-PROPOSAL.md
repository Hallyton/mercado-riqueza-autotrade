# Proposta de modelagem Prisma — Master Signal (EA Mãe)

**Fase 2.2** — proposta técnica detalhada para revisão e gate antes de alterar `prisma/schema.prisma` ou criar migrations.

**Documentos base:** [`MASTER-EA-SIGNAL-ARCHITECTURE.md`](MASTER-EA-SIGNAL-ARCHITECTURE.md), [`MASTER-EA-IMPLEMENTATION-PLAN.md`](MASTER-EA-IMPLEMENTATION-PLAN.md)  
**Branch:** `staging-vps-homologacao`  
**Último commit de referência:** `c1fe57f` (plano de implementação)

> **Não aplicar** os blocos Prisma abaixo até aprovação da seção [13](#13-critérios-para-aprovar-a-próxima-fase-fase-23).

---

## 1. Objetivo

Este documento define **como** os modelos Prisma futuros devem suportar o fluxo homologado na arquitetura, sem implementar código nesta etapa:

```text
EA Mãe
  → POST /api/master/signals
  → MasterSignal (persistência + estados)
  → seleção de licenças elegíveis
  → MasterSignalDispatch (trilha por licença)
  → Instruction (modelo atual, uma por licença)
  → EA cliente (GET /instructions, POST /executions — inalterado)
  → Execution + InstructionStatusLog + OrderLogStatus
  → painel admin consolidado (fase posterior)
```

A modelagem deve:

- Garantir **idempotência** em retries do EA Mãe e do dispatch.
- Permitir **auditoria** sem vazar estratégia.
- **Reutilizar** enums e relações já usados por `createAdminDispatchedInstruction` (`lib/admin/instruction-dispatch.ts`) e `pullInstructionsForEa` (`lib/ea/instructions.ts`).
- Manter `Instruction` como **fonte operacional individual** para o EA cliente.

---

## 2. Modelos existentes relevantes

### 2.1 Mapa resumido (schema atual)

| Model | Papel no fluxo atual | Relação com Master Signal (futuro) |
|-------|----------------------|-----------------------------------|
| **User** | Dono da licença; actor em `AuditLog` | Indireto via `License.userId` |
| **Plan** | Limites (`max_devices`, `allow_demo`, slug) | Filtro de elegibilidade; `profile` do sinal pode mapear `Plan.slug` |
| **Subscription** | Status billing (`ACTIVE`, etc.) | Filtro de elegibilidade |
| **ExposureProfile** | Perfil comercial na licença | Alternativa/complemento ao campo `profile` do sinal |
| **License** | Entidade central: halts, MT5, devices | **FK** de `MasterSignalDispatch`; alvo do dispatch |
| **Mt5Account** | Login/server vinculados | Validação de conta no heartbeat/pull |
| **Device** | EA ativo (`device_id`, `token_hash`, `revoked_at`) | `max_devices`; device não revogado |
| **Instruction** | Fila operacional por licença | **Criada** pelo dispatch; `idempotencyKey` único global |
| **InstructionStatusLog** | Trilha `RECEIVED` → `SENT` → terminal | Inalterada; alimentada como hoje |
| **Execution** | Resultado EA (`FILLED`, etc.) | Inalterada; liga `instructionId` + `licenseId` |
| **EaHeartbeat** | Online, `trade_mode`, `pending_count` | Elegibilidade demo/real; contagem entregável |
| **AuditLog** | `entityType`, `action`, `metadata` Json | **Recomendado** para eventos do sinal mestre |
| **AdminAction** | Trilha admin dedicada | Opcional para ações manuais em master signals |

**Nota:** não existe model `EaDevice` — o equivalente é **`Device`** (`devices`).

### 2.2 Enums já reutilizáveis (sem duplicar)

| Enum existente | Uso no Master Signal |
|----------------|----------------------|
| `InstructionSide` | `BUY` / `SELL` no `MasterSignal` |
| `InstructionOrderType` | `MARKET`, etc. |
| `InstructionPurpose` | `ENTRY`, `EXIT`, `ADJUSTMENT` |
| `OrderLogStatus` | Status da **Instruction** (`RECEIVED`, `SENT`, `EXECUTED`, …) |
| `ExecutionStatus` | Status em **Execution** (EA reporta; servidor mapeia para `OrderLogStatus`) |
| `AuditActorType` | Estender com `MASTER_EA` **ou** usar `SYSTEM` + metadata (decisão pendente) |

### 2.3 Enum a estender na Fase 2.3

`InstructionSource` hoje: `TEST`, `HOMOLOGATION`.

**Proposta:** adicionar valor `MASTER_DISPATCH` (nome final pendente) para distinguir instruções originadas do EA Mãe das criadas pelo painel admin — sem expor isso ao cliente no payload EA.

### 2.4 Fluxo de código existente a reaproveitar

| Módulo | Função |
|--------|--------|
| `lib/admin/instruction-dispatch.ts` | `createAdminDispatchedInstruction`: transação `Instruction` + `InstructionStatusLog` + `recordAdminAction` |
| `lib/licensing/instruction-policy.ts` | `assertInstructionAllowed` (halts, assinatura) |
| `lib/ea/instructions.ts` | Pull, `deliverableInstructionWhere`, `reportExecution` idempotente |
| `lib/audit/log.ts` | `createAuditLog` genérico |

O service de dispatch mestre (Fase 2.6) deve **extrair** um núcleo compartilhado de “criar instruction + RECEIVED log” a partir do padrão admin, com `idempotencyKey` derivado do par `(masterSignalId, licenseId)`.

---

## 3. Modelo proposto: `MasterSignal`

> Bloco **conceitual** — não commitar em `schema.prisma` até gate aprovado.

```prisma
/// Sinal mestre recebido do EA Mãe (ou simulador/admin de teste).
model MasterSignal {
  id                 String              @id @default(cuid())
  /// Identificador externo enviado pelo EA Mãe (único por ambiente).
  masterSignalId     String              @unique @map("master_signal_id")
  source             MasterSignalSource
  symbol             String
  side               InstructionSide
  orderType          InstructionOrderType @map("order_type")
  purpose            InstructionPurpose
  /// Slug de plano ou perfil comercial alvo (ex.: "start"); ver seção 2.1.
  profile            String
  status             MasterSignalStatus  @default(RECEIVED)
  idempotencyKey     String              @unique @map("idempotency_key")
  expiresAt          DateTime            @map("expires_at")
  receivedAt         DateTime            @default(now()) @map("received_at")
  validatedAt        DateTime?           @map("validated_at")
  dispatchedAt       DateTime?           @map("dispatched_at")
  rejectedAt         DateTime?           @map("rejected_at")
  failedAt           DateTime?           @map("failed_at")
  /// Código interno (ex.: INVALID_SYMBOL); não expor estratégia.
  rejectedReason     String?             @map("rejected_reason") @db.VarChar(128)
  /// Payload recebido após allowlist/redação (sem segredos, sem vault).
  rawPayloadRedacted Json?               @map("raw_payload_redacted")
  createdAt          DateTime            @default(now()) @map("created_at")
  updatedAt          DateTime            @updatedAt @map("updated_at")

  dispatches MasterSignalDispatch[]

  @@index([status])
  @@index([source])
  @@index([receivedAt])
  @@index([dispatchedAt])
  @@map("master_signals")
}
```

### 3.1 Tipos e convenções

| Campo | Tipo Prisma | Notas |
|-------|-------------|--------|
| `id` | `String` @cuid | PK interna; usar em FKs |
| `masterSignalId` | `String` | ID de negócio do EA Mãe |
| `source` | enum | Ver seção 5 |
| `symbol` | `String` | Normalizado uppercase no service |
| `side`, `orderType`, `purpose` | enums existentes | Alinhamento com `Instruction` |
| `profile` | `String` | Não é FK na v1 — match por slug em query |
| `status` | enum novo | Máquina de estados do mestre |
| `idempotencyKey` | `String` | Unique global |
| `expiresAt` | `DateTime` | UTC; derivado de `expires_in_seconds` |
| Timestamps de fase | `DateTime?` | Preencher na transição correspondente |
| `rejectedReason` | `String?` | Curto; lista fechada no código |
| `rawPayloadRedacted` | `Json?` | Allowlist estrita na ingestão |

### 3.2 Campos **não** incluídos na v1 (evitar rigidez)

- `quantity` no mestre — volume calculado no dispatch por licença/perfil.
- `stopLoss` / `takeProfit` no mestre — preenchidos só na `Instruction` se política interna exigir (vault/server), não vindos do EA Mãe.
- FK direta para `Plan` — elegibilidade resolvida em runtime.

---

## 4. Modelo proposto: `MasterSignalDispatch`

> Trilha **sinal × licença** → opcionalmente **instruction**.

```prisma
/// Resultado do dispatch de um MasterSignal para uma License.
model MasterSignalDispatch {
  id              String                     @id @default(cuid())
  masterSignalId  String                     @map("master_signal_id")
  licenseId       String                     @map("license_id")
  instructionId   String?                    @map("instruction_id")
  status          MasterSignalDispatchStatus
  /// Código de skip/falha (ex.: HALT_NEW_ENTRIES, LICENSE_INACTIVE).
  reason          String?                    @db.VarChar(128)
  createdAt       DateTime                   @default(now()) @map("created_at")
  updatedAt       DateTime                   @updatedAt @map("updated_at")

  masterSignal MasterSignal   @relation(fields: [masterSignalId], references: [id], onDelete: Cascade)
  license      License        @relation(fields: [licenseId], references: [id], onDelete: Cascade)
  instruction  Instruction?   @relation(fields: [instructionId], references: [id], onDelete: SetNull)

  @@unique([masterSignalId, licenseId])
  @@index([licenseId])
  @@index([instructionId])
  @@index([status])
  @@index([createdAt])
  @@map("master_signal_dispatches")
}
```

### 4.1 Rastreabilidade

```text
MasterSignal (id)
  → MasterSignalDispatch (licenseId, status, reason)
    → Instruction (id) — se INSTRUCTION_CREATED
      → InstructionStatusLog / Execution
        → OrderLogStatus EXECUTED (via EA)
```

**Recomendação:** não adicionar `masterSignalId` em `Instruction` na v1 — a junção é `MasterSignalDispatch.instructionId`. Se consultas por instruction forem frequentes, avaliar índice reverso ou campo opcional `masterSignalId` na Fase 2.6+ (decisão pendente).

### 4.2 Relações inversas a adicionar (Fase 2.3)

```prisma
// Em License:
masterSignalDispatches MasterSignalDispatch[]

// Em Instruction (opcional):
masterSignalDispatch MasterSignalDispatch?
```

Relação 1:1 opcional `Instruction` ↔ `MasterSignalDispatch` só se `instructionId` for unique em `master_signal_dispatches` — **recomendado** `@unique` em `instructionId` quando não null.

---

## 5. Enums sugeridos

### 5.1 `MasterSignalStatus`

| Valor | Uso |
|-------|-----|
| `RECEIVED` | Persistido; validação pendente |
| `VALIDATED` | Passou validação; pronto para dispatch |
| `REJECTED` | Falha de validação (terminal) |
| `DISPATCHING` | Lock otimista / job em andamento |
| `DISPATCHED` | Dispatch concluído para todas as licenças do lote |
| `PARTIALLY_DISPATCHED` | Mix: criadas + skips + falhas parciais de infra |
| `FAILED` | Erro interno (terminal) |

**Recomendação:** usar **enum Prisma** — estados fechados e indexáveis; evita typos em SQL.

### 5.2 `MasterSignalDispatchStatus`

| Valor | Uso |
|-------|-----|
| `ELIGIBLE` | Licença passou pré-filtro (opcional; pode pular direto para skip/create) |
| `SKIPPED` | Não criou instruction (`reason` preenchido) |
| `INSTRUCTION_CREATED` | `instructionId` definido |
| `FAILED` | Erro ao criar instruction |

**Estados terminais da operação (EXECUTED, REJECTED, EXPIRED):** **não** duplicar no dispatch na v1 — derivar de `Instruction.currentStatus` e `Execution` via join no painel admin. Isso evita dessincronia e duplica o que `OrderLogStatus` já modela.

**Alternativa rejeitada na v1:** `EXECUTED` / `REJECTED` / `EXPIRED` em `MasterSignalDispatchStatus` — só reconsiderar se o painel exigir denormalização com job de sync.

### 5.3 `MasterSignalSource`

| Valor | Uso |
|-------|-----|
| `MASTER_EA` | Produção do robô mestre |
| `ADMIN_TEST` | Disparo manual admin em staging |
| `SIMULATOR` | Script/curl de homologação |

**Recomendação:** enum Prisma.

### 5.4 `AuditActorType` (extensão opcional)

Adicionar `MASTER_EA` para logs com `actorType` explícito — **ou** usar `SYSTEM` + `metadata.source = MASTER_EA`. Preferência: **`MASTER_EA`** na Fase 2.3 para clareza em relatórios.

### 5.5 String vs enum — decisão

| Área | Recomendação v1 |
|------|-----------------|
| Status mestre / dispatch / source | **Enum** |
| `rejectedReason`, `reason` | **String** com códigos estáveis no código |
| `profile` | **String** (slug) até existir FK formal |

---

## 6. Índices e constraints

| Constraint / índice | Modelo | Motivo |
|---------------------|--------|--------|
| `@unique(masterSignalId)` | MasterSignal | Um registro por ID externo do EA Mãe |
| `@unique(idempotencyKey)` | MasterSignal | Retry HTTP com mesma chave → mesmo row |
| `@@unique([masterSignalId, licenseId])` | MasterSignalDispatch | **Uma** tentativa de dispatch por licença por sinal |
| `@unique(instructionId)` (nullable) | MasterSignalDispatch | Uma instruction no máximo um dispatch mestre |
| `@@index([status])` | MasterSignal | Filtro painel / jobs de reprocesso |
| `@@index([source])` | MasterSignal | Métricas por origem |
| `@@index([receivedAt])` | MasterSignal | Listagem cronológica |
| `@@index([dispatchedAt])` | MasterSignal | SLA / latência dispatch |
| `@@index([licenseId])` | MasterSignalDispatch | Histórico por cliente |
| `@@index([instructionId])` | MasterSignalDispatch | Drill-down instruction → sinal |
| `@@index([status])` | MasterSignalDispatch | Agregações skip vs created |
| `@@index([createdAt])` | MasterSignalDispatch | Auditoria temporal |

**Instruction existente:** `idempotencyKey` @unique — dispatch deve gerar:

```text
idempotency_key = "msig:{masterSignal.id}:{licenseId}"
```

Garante unicidade global e alinhamento com retry idempotente do EA.

---

## 7. Idempotência

### 7.1 Regras de negócio (futuro service)

| Regra | Implementação sugerida |
|-------|------------------------|
| Mesmo `master_signal_id` | `findUnique` em `masterSignalId` → retornar 200 com payload existente |
| Mesmo `idempotency_key` | `findUnique` em `idempotencyKey` → 200 idempotente (mesmo body) |
| Conflito: mesma `idempotency_key` com `master_signal_id` diferente | **409** `IDEMPOTENCY_CONFLICT` |
| Mesmo sinal + mesma `licenseId` | `@@unique([masterSignalId, licenseId])` — upsert skip ou retorno existente |
| Retry dispatch | Transação: se dispatch `INSTRUCTION_CREATED`, não recriar `Instruction` |
| Retry EA Mãe | Resposta inclui `instructions_created`, `instructions_skipped` do registro existente |

### 7.2 Fluxo de criação (pseudo)

```text
POST /api/master/signals
  1. BEGIN (ou serializable)
  2. INSERT MasterSignal ON CONFLICT (idempotency_key) DO NOTHING / RETURNING
  3. Se já DISPATCHED → return cached summary
  4. VALIDATED → DISPATCHING (compare-and-set status)
  5. Para cada license elegível:
       INSERT MasterSignalDispatch ON CONFLICT (master_signal_id, license_id) DO NOTHING
       Se novo e elegível: create Instruction (idempotency_key determinístico)
       UPDATE dispatch INSTRUCTION_CREATED
  6. MasterSignal → DISPATCHED | PARTIALLY_DISPATCHED
  7. COMMIT
```

### 7.3 Alinhamento com EA cliente

- `reportExecution` já é idempotente por `Execution` terminal (`lib/ea/instructions.ts`).
- Pull não duplica `SENT` indevidamente — sem mudança de contrato.

---

## 8. Auditoria

### 8.1 Opções avaliadas

| Opção | Prós | Contras |
|-------|------|---------|
| **A. `MasterSignalAudit` dedicado** | Schema explícito por evento | Mais uma tabela/migration; duplica padrão |
| **B. Reaproveitar `AuditLog`** | Já usado em EA e admin; `entityType` + `action` flexíveis | `metadata` deve seguir allowlist |

### 8.2 Recomendação (v1): **Opção B — `AuditLog`**

Padrão existente (`audit_logs`):

```prisma
model AuditLog {
  actorType  AuditActorType  // MASTER_EA ou SYSTEM
  actorId    String?         // null ou service id
  action     String          // ex.: master_signal.received
  entityType String          // "master_signal"
  entityId   String?         // MasterSignal.id
  metadata   Json?           // contadores, reason codes — sem estratégia
  requestId  String?
  ...
}
```

### 8.3 Eventos mínimos (`action`)

| action | Quando |
|--------|--------|
| `master_signal.received` | Após INSERT |
| `master_signal.validated` | status → VALIDATED |
| `master_signal.rejected` | status → REJECTED |
| `master_signal.dispatch_started` | → DISPATCHING |
| `master_signal.dispatch_completed` | → DISPATCHED |
| `master_signal.dispatch_partial` | → PARTIALLY_DISPATCHED |
| `master_signal.failed` | → FAILED |

**`AdminAction`:** registrar apenas ações humanas (`ADMIN_TEST`), espelhando padrão `admin.instruction.dispatch`.

**Não** persistir `MASTER_EA_API_SECRET` nem payload bruto completo em `metadata`.

---

## 9. Compatibilidade com contrato atual do EA cliente

| Aspecto | Compromisso |
|---------|-------------|
| Rotas EA | `/api/v1/ea/*` inalteradas ([`docs/EA-API.md`](EA-API.md)) |
| Payload pull | `EaInstructionPayload` em `lib/ea/instructions.ts` — mesmos campos |
| Origem da instruction | Transparente para o EA; opcional `source=MASTER_DISPATCH` só no DB |
| DebugMode / homologação | Instruções mestre passam pelo mesmo pull/executions validado em staging |
| Cliente web | Sem campo `master_signal_id` no dashboard cliente |

O Master Signal **apenas** alimenta `Instruction` com os mesmos campos que o admin já usa (`symbol`, `side`, `order_type`, `purpose`, `quantity`, `expires_at`).

---

## 10. Migração proposta futura (Fase 2.3 — não executar agora)

Ordem sugerida em **uma** migration (ou duas se PostgreSQL exigir):

1. Criar enums: `MasterSignalStatus`, `MasterSignalDispatchStatus`, `MasterSignalSource`.
2. (Opcional) Alterar `AuditActorType` ADD VALUE `MASTER_EA`.
3. (Opcional) Alterar `InstructionSource` ADD VALUE `MASTER_DISPATCH`.
4. Criar tabela `master_signals` + índices.
5. Criar tabela `master_signal_dispatches` + FKs + `@@unique`.
6. Adicionar relações inversas em `License` (e opcionalmente `Instruction`).
7. `npx prisma migrate dev` local com `DATABASE_URL` de dev.
8. `npx prisma migrate deploy` em Neon **staging** (nunca produção nesta fase).
9. **Seed:** `db:seed` **não** deve inserir master signals (confirmar `prisma/seed.ts` inalterado).

**Rollback:**

- Migration `down` remove tabelas novas (sem dados em prod).
- Feature flag `MASTER_EA_DISPATCH_ENABLED=false` (env) antes de expor endpoint — dispatch desligado mesmo com tabelas vazias.
- Tabelas novas são **aditivas** — não alteram colunas de `instructions` na v1 → rollback de código antigo continua funcionando.

---

## 11. Riscos

| Risco | Mitigação na modelagem |
|-------|------------------------|
| Duplicidade de instructions | `@@unique([masterSignalId, licenseId])` + `Instruction.idempotencyKey` determinístico |
| Replay de sinal mestre | `idempotencyKey` + `expiresAt` + rejeição se `receivedAt` antigo |
| Schema rígido cedo | Sem FK Plan; `profile` string; sem quantity no mestre |
| `raw_payload` expõe estratégia | `rawPayloadRedacted` + allowlist na ingestão |
| Relação circular | Dispatch aponta para Instruction; não o contrário obrigatório |
| Impacto em produção | Deploy staging primeiro; tabelas vazias até Fase 2.5 |
| UTC vs local | Todos `DateTime` em UTC no DB; UI converte |
| Dispatch parcial | Status `PARTIALLY_DISPATCHED` + contadores em `AuditLog.metadata` |
| Rollback migration | Migration reversível; sem DROP de tabelas legadas |
| Dessincronia dispatch vs instruction | Não espelhar EXECUTED no dispatch; usar join |
| Crescimento de `master_signals` | Índices temporais; política de retenção (futuro ops) |

---

## 12. Recomendação final (primeira implementação Prisma)

| Decisão | Recomendação |
|---------|--------------|
| Models novos | **`MasterSignal`** + **`MasterSignalDispatch`** |
| Auditoria | **`AuditLog`** existente + actions `master_signal.*` |
| Enums novos | **`MasterSignalStatus`**, **`MasterSignalDispatchStatus`**, **`MasterSignalSource`** |
| Enums estendidos | **`InstructionSource.MASTER_DISPATCH`**, opcional **`AuditActorType.MASTER_EA`** |
| Payload mestre | **`rawPayloadRedacted` Json** allowlisted |
| Instruction | **Inalterada** estruturalmente na v1; FK opcional só via dispatch |
| EA cliente | **Inalterado** |
| Idempotência | Unique `masterSignalId`, `idempotencyKey`, `(masterSignalId, licenseId)` + instruction key derivada |
| Terminal states | **`OrderLogStatus` / `Execution`** — não duplicar no dispatch |

---

## 13. Critérios para aprovar a próxima fase (Fase 2.3)

Antes de editar `prisma/schema.prisma`:

| # | Item para aprovação |
|---|---------------------|
| 1 | Nomes finais: `MasterSignal`, `MasterSignalDispatch`, `@@map` das tabelas |
| 2 | Valores finais dos enums (incl. se `ELIGIBLE` entra no dispatch) |
| 3 | Campos obrigatórios vs opcionais em `MasterSignal` |
| 4 | Índices únicos listados na seção 6 |
| 5 | Relação `Instruction` ↔ dispatch (1:1 via `instructionId` unique) |
| 6 | Estratégia de idempotência (200 vs 409 em conflito de chave) |
| 7 | Auditoria via `AuditLog` vs tabela dedicada |
| 8 | Extensão `InstructionSource` + valor do enum |
| 9 | Mapeamento `profile` → `Plan.slug` vs `ExposureProfile.slug` |
| 10 | Plano de rollback + ordem da migration |
| 11 | Confirmação: seed não cria master signals |

**Aprovadores sugeridos:** engenharia + produto/compliance (caixa preta).

---

## Referências de código (estado atual)

| Arquivo | Relevância |
|---------|------------|
| `prisma/schema.prisma` | `Instruction`, `License`, `AuditLog`, enums |
| `lib/admin/instruction-dispatch.ts` | Padrão de criação de instruction |
| `lib/ea/instructions.ts` | Pull, estados, idempotência execution |
| `lib/audit/log.ts` | Inserção em `audit_logs` |
| `tests/admin/instruction-dispatch.test.ts` | Testes de dispatch admin |
| `tests/ea/instructions.test.ts` | Testes de fila entregável |

---

*Proposta Fase 2.2 — aguardando gate para Fase 2.3 (migration).*
