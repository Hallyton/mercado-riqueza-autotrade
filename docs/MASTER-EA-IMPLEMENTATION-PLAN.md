# Plano de implementação — EA Mãe / Robô Mestre

Plano técnico para transformar a arquitetura documentada em [`docs/MASTER-EA-SIGNAL-ARCHITECTURE.md`](MASTER-EA-SIGNAL-ARCHITECTURE.md) em implementação **segura**, em **fases pequenas e testáveis**.

**Branch de referência:** `staging-vps-homologacao`  
**Estado atual aprovado:** homologação local e staging; domínio [https://autotrade-staging.mercadodariqueza.com.br](https://autotrade-staging.mercadodariqueza.com.br); EA cliente (ativação, heartbeat, TEST → EXECUTED em DebugMode); halts; troca MT5 com revogação de device/token.

**Esta etapa:** somente documentação/plano — **mapa de obra** antes de Prisma, endpoint e dispatch real.

---

## 1. Objetivo do plano

O próximo desenvolvimento consiste em implementar, de forma incremental:

1. **Persistência** do sinal mestre e da trilha de dispatch por licença.
2. **API dedicada** para o EA Mãe (autenticação e validação separadas do EA cliente).
3. **Motor de dispatch** que materializa instruções individuais reutilizando, quando possível, a lógica já homologada (`Instruction`, fila entregável em `lib/ea/instructions.ts`, halts em `lib/licensing/*`).
4. **Observabilidade admin** (painel e testes) sem vazar estratégia ao cliente.

Cada fase deve ser **mergeável**, **reversível** e **validável em staging** com `InpDebugMode=true` antes de qualquer gate de produção real.

---

## 2. Escopo do EA Mãe

| O EA Mãe **é** | O EA Mãe **não é** |
|----------------|-------------------|
| Componente em ambiente **controlado** pelo Mercado da Riqueza | Canal direto para terminais de clientes |
| Emissor de **sinais oficiais normalizados** para a API | Consumidor de dados de conta/licença do cliente |
| Cliente HTTP da rota mestre (futura) com **auth própria** | Portador de `device_token` de cliente |
| Origem auditável (`source`, `master_signal_id`, `idempotency_key`) | Veículo de parâmetros de estratégia no payload |

**Sinal operacional normalizado (máximo):** `symbol`, `side`, `order_type`, `purpose`, referência de `profile`/plano, janela de expiração — **sem** indicadores, filtros, horários editáveis, stops/alvos táticos ou vault.

**Tecnologia prevista (Fase 2.9+):** EA MQL5 em VPS designada **ou** simulador HTTP (curl/script) em homologação — decisão na Fase 2.9; homologação inicial pode usar apenas simulador.

---

## 3. Modelo conceitual de dados

> **Proposta inicial** — nomes de tabelas/campos sujeitos a revisão antes da Fase 2.2. Não implementar nesta etapa.

### 3.1 `master_signal` (proposta)

Registro **um por sinal mestre** recebido (ou deduplicado por idempotência).

| Campo (proposta) | Tipo / notas |
|------------------|--------------|
| `id` | PK interno (cuid/uuid) |
| `master_signal_id` | Identificador externo enviado pelo EA Mãe; único por ambiente |
| `source` | Ex.: `MASTER_EA` |
| `symbol` | Ativo normalizado |
| `side` | `BUY` / `SELL` |
| `order_type` | Ex.: `MARKET` |
| `purpose` | `ENTRY` / `EXIT` / `ADJUSTMENT` / … |
| `profile` | Slug ou código de perfil/plano alvo (ex.: `START`) |
| `status` | Ver seção 4 |
| `idempotency_key` | Único; índice para deduplicação |
| `expires_at` | Derivado de `expires_in_seconds` no recebimento |
| `received_at` | Timestamp recebimento |
| `validated_at` | Timestamp pós-validação |
| `dispatched_at` | Timestamp fim do dispatch |
| `rejected_reason` | Código/mensagem interna (admin); não expor estratégia |
| `raw_payload` | JSON **redigido** (sem segredos; sem campos proibidos) |

**Índices sugeridos:** `idempotency_key` (unique), `master_signal_id` (unique), `status`, `received_at`.

### 3.2 `master_signal_dispatch` (proposta)

Uma linha **por tentativa de materialização** sinal × licença (ou por instrução criada).

| Campo (proposta) | Tipo / notas |
|------------------|--------------|
| `id` | PK |
| `master_signal_id` | FK → `master_signal` |
| `license_id` | FK → licença existente |
| `instruction_id` | FK → `instructions` (nullable se skip sem criar) |
| `status` | Ex.: `CREATED`, `SKIPPED`, `FAILED` |
| `reason` | Motivo de skip/rejeição (código interno) |
| `created_at` | Timestamp |

**Constraint sugerida:** unique (`master_signal_id`, `license_id`) para evitar duplicata no mesmo sinal.

### 3.3 `master_signal_audit` / reutilizar `audit_logs` (proposta)

Opção A — tabela dedicada `master_signal_audit` com eventos tipados.  
Opção B — estender padrão existente de auditoria do projeto (`audit_logs`) com `entity_type = master_signal`.

Eventos mínimos:

| Evento | Dados agregados |
|--------|-----------------|
| `received` | Payload hash, source, IP (se política permitir) |
| `validated` | Regras OK |
| `rejected` | Motivo, sem payload sensível |
| `dispatch_started` | Contagem elegíveis estimada |
| `dispatched` | `eligible_count`, `instructions_created`, `skipped_count` |

**Decisão pendente (gate Fase 2.2):** tabela dedicada vs. auditoria genérica — aprovar antes da migration.

### 3.4 Relação com modelo atual

O schema Prisma **já possui** `Instruction`, `instruction_status_logs`, execuções EA — ver `prisma/schema.prisma`. O dispatch mestre deve **criar** registros compatíveis com o contrato homologado em [`docs/EA-API.md`](EA-API.md), sem alterar o pull do EA cliente nesta fase de planejamento.

---

## 4. Estados do Master Signal

### 4.1 Estados sugeridos (`master_signal.status`)

| Estado | Significado | Transições típicas |
|--------|-------------|-------------------|
| `RECEIVED` | Persistido; validação pendente | → `VALIDATED`, `REJECTED`, `FAILED` |
| `VALIDATED` | Auth + schema + política global OK | → `DISPATCHING` |
| `REJECTED` | Falha de validação antes do dispatch | terminal |
| `DISPATCHING` | Job em andamento (evitar double-dispatch) | → `DISPATCHED`, `PARTIALLY_DISPATCHED`, `FAILED` |
| `DISPATCHED` | Todas elegíveis processadas com sucesso (criadas ou skip documentado) | terminal |
| `PARTIALLY_DISPATCHED` | Mix: algumas instruções criadas, falhas sistêmicas em parte do lote | terminal ou reprocessável (definir na Fase 2.2) |
| `FAILED` | Erro interno / timeout / inconsistência | terminal; alerta operacional |

```text
RECEIVED → VALIDATED → DISPATCHING → DISPATCHED
              ↓              ↓
          REJECTED    PARTIALLY_DISPATCHED / FAILED
```

### 4.2 Mapeamento com instruções individuais

| Master Signal | Instruction (existente / AGENTS.md) |
|---------------|--------------------------------------|
| Dispatch cria registro | `RECEIVED` (servidor) |
| Disponível no pull EA | `SENT` |
| EA reporta FILLED/PARTIAL (DebugMode incluso) | `EXECUTED` |
| Política/broker recusa | `REJECTED` |
| Não elegível / expirada sem pull | `IGNORED` |
| TTL esgotado | `EXPIRED` (ou mapear a `IGNORED` — alinhar na Fase 2.2) |
| Cancelamento server-side | `CANCELLED` |

O cliente **não** vê `master_signal_id` no dashboard; opcional no admin.

---

## 5. Endpoint planejado (conceitual)

> **Não implementar** nesta etapa.

```http
POST /api/master/signals
Content-Type: application/json
Idempotency-Key: <uuid>   # opcional se também no body
X-Master-EA-Secret: <redacted>   # ou Authorization: Bearer <service_token>
```

**Payload conceitual:**

```json
{
  "master_signal_id": "msig_20260524_001",
  "source": "MASTER_EA",
  "symbol": "WDOM26",
  "side": "BUY",
  "order_type": "MARKET",
  "purpose": "ENTRY",
  "profile": "START",
  "expires_in_seconds": 60,
  "idempotency_key": "idem_a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Resposta conceitual (201 / 200 idempotente):**

```json
{
  "master_signal_id": "msig_20260524_001",
  "status": "DISPATCHED",
  "instructions_created": 12,
  "instructions_skipped": 3,
  "idempotent_replay": false
}
```

**Versionamento:** avaliar prefixo `/api/v1/master/signals` na Fase 2.5 para alinhar ao restante da API.

**Campos proibidos no body (rejeitar na validação):** indicadores, `stop_loss`, `take_profit` táticos, horários operacionais, `strategy_*`, parâmetros de vault, lista de `license_id` de clientes.

---

## 6. Autenticação do EA Mãe

| Item | Plano |
|------|--------|
| Segredo | Variável de ambiente futura, ex.: `MASTER_EA_API_SECRET` (staging e produção **valores distintos**) |
| Separação | **Nunca** igual a `AUTH_SECRET`, `device_token` ou `BILLING_WEBHOOK_SECRET` |
| Transporte | Header dedicado (ex.: `X-Master-EA-Secret`) **ou** `Authorization: Bearer <token>` — escolher um padrão na revisão do plano |
| Comparação | `timingSafeEqual` / equivalente; rejeitar ausência com 401 |
| Rotação | Procedimento: gerar novo secret → deploy dual-read (opcional) → revogar antigo → registrar em runbook |
| Rate limit | Bucket por IP + por secret (ex.: N req/min em staging maior que prod para testes) |
| Logs | Registrar sucesso/falha de auth **sem** imprimir secret; mascarar headers em debug |

**Middleware:** rota mestre fora de sessão NextAuth de cliente/admin; role `master_ea_service` ou validação puramente por secret + allowlist IP (opcional, Fase 2.5).

---

## 7. Validações do sinal mestre

Ordem sugerida no service (Fase 2.4):

| # | Validação | Falha típica |
|---|-----------|--------------|
| 1 | Autenticação mestre | 401 |
| 2 | `idempotency_key` presente e formato válido | 400 |
| 3 | Replay: `idempotency_key` ou `master_signal_id` já existente | 200 idempotente ou 409 (definir na revisão) |
| 4 | `master_signal_id` único (se nova chave) | 409 |
| 5 | `symbol` em allowlist configurável (env/DB admin) | 422 |
| 6 | `side` ∈ enum permitido | 400 |
| 7 | `order_type` ∈ enum permitido | 400 |
| 8 | `purpose` ∈ enum permitido | 400 |
| 9 | `expires_in_seconds` dentro de `[min, max]` (ex.: 5–300) | 400 |
| 10 | `profile` compatível com planos existentes | 422 |
| 11 | Payload sem chaves proibidas (estratégia) | 400 |
| 12 | Ambiente: secret de staging só aceito em deploy staging (opcional: header `X-Environment`) | 403 |

Após validação → `status = VALIDATED`, `validated_at` preenchido, evento de auditoria.

---

## 8. Seleção de clientes elegíveis

Query conceitual sobre licenças/dispositivos (implementação Fase 2.6):

| Filtro | Regra |
|--------|--------|
| Assinatura | `ACTIVE` (não vencida / não `PAST_DUE` conforme política billing) |
| Licença | `ACTIVE`, não revogada, não expirada |
| Plano / profile | Slug do plano ou perfil de exposição compatível com `profile` do sinal |
| `allow_demo` | Se conta MT5 vinculada for demo, plano deve permitir |
| MT5 vinculado | Login + server preenchidos e consistentes |
| `max_mt5` | Não excedido |
| `max_devices` | Pelo menos um device ativo elegível (definir: todos devices ou um primário) |
| Device | Token não revogado; opcional: heartbeat recente |
| `halt_new_entries` | Se `purpose = ENTRY`, não criar instrução (skip com reason) |
| `halt_all_trading` | Não criar instrução material (skip; EXIT pode ter exceção — alinhar com `lib/licensing/flags.ts`) |
| Cliente | Usuário não bloqueado / suspenso |
| Demo vs real | `trade_mode` do último heartbeat vs política do plano |

**Saída:** lista de `license_id` (+ opcional `device_id` alvo) para dispatch.

---

## 9. Dispatch para instruções individuais

| Requisito | Plano |
|-----------|--------|
| Granularidade | Uma `Instruction` por licença elegível por sinal |
| Reuso | Extrair/encapsular lógica atual de criação admin (`/admin/instrucoes`) e política de fila em `lib/ea/instructions.ts` |
| Idempotência | Unique (`master_signal_id`, `license_id`); retry HTTP não duplica |
| Registro | Inserir `master_signal_dispatch` por licença |
| Status/log | Transições em `instruction_status_logs` como hoje |
| Expiração | `expires_at` no sinal propagado para instrução |
| Contrato EA | Payload de `/api/v1/ea/instructions` **inalterado** para o cliente; sem campo mestre |
| Volume | Calcular volume no servidor por perfil de exposição — não no EA Mãe |

**Fluxo interno:**

```text
VALIDATED → DISPATCHING
  → para cada license elegível:
       se skip → master_signal_dispatch (SKIPPED, reason)
       se create → Instruction RECEIVED → SENT + dispatch CREATED
  → master_signal.status = DISPATCHED | PARTIALLY_DISPATCHED
```

**Transação:** preferir transação DB por lote com limite de tamanho; sinais com muitas licenças podem exigir job assíncrono (avaliar na Fase 2.6).

---

## 10. Painel futuro (não implementar agora)

**Rota admin planejada:** `/admin/master-signals`

| Bloco | Conteúdo |
|-------|----------|
| Lista | `master_signal_id`, symbol, purpose, status, timestamps |
| Resumo | Licenças elegíveis, instruções criadas, EXECUTED, REJECTED, EXPIRED/IGNORED |
| Drill-down | Por licença: cliente (email mascarado se política), `instruction_id`, status, reason |
| Erros | Falhas de dispatch ou execução agregadas |
| Filtros | Data, status, symbol, profile |

**Restrições UI:** role admin autorizada; **sem** vault/estratégia; alinhado a identidade visual preto/dourado ([`AGENTS.md`](../AGENTS.md)).

---

## 11. Testes planejados

Testes automatizados (Fase 2.7) e checklist manual staging (Fase 2.10):

| # | Caso |
|---|------|
| 1 | Rejeita sem autenticação → 401 |
| 2 | Rejeita secret inválido → 401 |
| 3 | Aceita sinal válido → 201 + `DISPATCHED` |
| 4 | Mesmo `idempotency_key` não duplica instruções |
| 5 | Cria instruções para todas licenças elegíveis do profile |
| 6 | Não cria para licença `SUSPENDED` / revogada |
| 7 | Não cria para assinatura inativa |
| 8 | `halt_new_entries` bloqueia ENTRY |
| 9 | `halt_all_trading` bloqueia conforme política |
| 10 | `allow_demo=false` + conta demo → skip |
| 11 | `max_devices` excedido → skip |
| 12 | Audit logs / eventos registrados |
| 13 | GET `/api/v1/ea/instructions` retorna instrução gerada (shape igual homologação) |
| 14 | EA cliente em DebugMode → POST `/executions` → EXECUTED |
| 15 | Painel admin reflete consolidação (após Fase 2.8) |

**Ferramentas:** testes unitários do service de validação/dispatch; testes de integração com DB de teste; homologação manual com simulador HTTP + EA staging existente.

---

## 12. Plano de fases

| Fase | Entrega | Depende de |
|------|---------|------------|
| **2.1** | Plano técnico / documentação | Arquitetura aprovada — **este documento** |
| **2.2** | Modelagem Prisma (`master_signal`, `master_signal_dispatch`, auditoria) | Gate seção 15 |
| **2.3** | Migration versionada | 2.2 |
| **2.4** | Service interno: validação + transição de estados | 2.3 |
| **2.5** | Endpoint seguro `POST /api/master/signals` | 2.4, auth aprovada |
| **2.6** | Dispatch para licenças elegíveis | 2.5, reuso instruction |
| **2.7** | Testes automatizados | 2.6 |
| **2.8** | Painel admin `/admin/master-signals` (básico) | 2.6 |
| **2.9** | EA Mãe MQL5 **ou** simulador HTTP | 2.5 |
| **2.10** | Homologação staging (DebugMode, subdomínio staging) | 2.6–2.9 |
| **2.11** | Gate produção simulada | 2.10 |

**Paralelo permitido:** 2.8 pode iniciar após 2.6 com dados mock; 2.9 pode começar com simulador antes do MQL5.

**Referência homologação atual:** [`docs/STAGING-VPS-HOMOLOGATION-RESULTS.md`](STAGING-VPS-HOMOLOGATION-RESULTS.md).

### Status de implementação (atualizado)

| Fase | Status | Notas |
|------|--------|-------|
| **2.4** | Concluída | `lib/master-signals/` — validação Zod + `rawPayloadRedacted` (sem persistência) |
| **2.5** | Concluída + homologação online staging | `POST /api/master/signals` — auth `MASTER_EA_API_SECRET`, persistência `MasterSignal`, idempotência, conflito 409; **sem dispatch automático** |
| **2.6** | Concluída localmente | `lib/master-signals/eligibility.ts` + `dispatch.ts` — dispatch interno para licenças elegíveis; **sem** acoplamento automático ao POST; **sem** homologação online Neon |

**Fase 2.5 — detalhes operacionais:**

- Rota: `POST /api/master/signals`
- Staging oficial: `https://autotrade-staging.mercadodariqueza.com.br/api/master/signals`
- Auth: `Authorization: Bearer <MASTER_EA_API_SECRET>` ou header `X-Master-EA-Secret`
- Resposta: `dispatch: "NOT_STARTED"`; status persistido `VALIDATED` após validação
- **Não** cria `MasterSignalDispatch` nem `Instruction` nesta fase — recebe e valida sinal mestre, persiste `MasterSignal`, valida idempotência e conflitos; **dispatch permanece fora de escopo (Fase 2.6)**
- Variável obrigatória no ambiente: `MASTER_EA_API_SECRET` (configurada na Vercel staging Production)
- Build Vercel: `prisma generate && next build` (cliente Prisma alinhado ao schema antes do `next build`)
- Middleware: `/api/master/signals` em rota pública (auth própria; sem sessão NextAuth)
- Migration Neon staging: `20260524123425_add_master_signal_models` aplicada (validado em homologação)
- Rate limit dedicado: **TODO** (Fase 2.6+); não bloqueia intake atual

### Homologação online staging — Fase 2.5 aprovada (maio/2026)

**Ambiente:** `https://autotrade-staging.mercadodariqueza.com.br`  
**Endpoint:** `POST /api/master/signals`

| Item | Status |
|------|--------|
| Deploy Vercel staging (Production Ready) | OK — alias `https://autotrade-staging.mercadodariqueza.com.br` |
| `MASTER_EA_API_SECRET` (Vercel Production) | OK |
| Middleware `/api/master/signals` | OK — rota alcançável sem redirect para `/login` |
| `prisma migrate deploy` Neon staging | OK |
| POST novo (`test-master-002`) | OK — HTTP **201**, `status: VALIDATED`, `dispatch: NOT_STARTED` |
| POST idempotente (mesmo payload) | OK — HTTP **200**, `idempotent: true`, `dispatch: NOT_STARTED` |
| POST conflito real (mesma `idempotency_key`, payload diferente) | OK — HTTP **409**, `MASTER_SIGNAL_CONFLICT` |
| Banco Neon (`test-master-002`) | OK — `status: VALIDATED`, `dispatchCount: 0`, `instructionCount: 0` |
| `MasterSignalDispatch` | **Não criado** |
| `Instruction` | **Não criada** |
| EA cliente | **Sem impacto** nesta fase (nenhuma instrução despachada) |

**Conclusão:** Fase 2.5 online aprovada em staging. O endpoint recebe e valida sinal mestre, persiste `MasterSignal`, valida idempotência e conflitos, mas ainda **não faz dispatch** (Fase 2.6).

### Fase 2.6 — dispatch interno (local — maio/2026)

| Item | Status |
|------|--------|
| Service `selectEligibleLicensesForMasterSignal` | OK — assinatura/licença ativas, MT5, device ativo, `allow_demo`, `max_devices` / `max_mt5`, perfil (`profileSlug`), halts via `lib/licensing/flags` |
| Service `dispatchValidatedMasterSignal` | OK — só `VALIDATED` → `DISPATCHING` → `DISPATCHED` / `PARTIALLY_DISPATCHED` / `FAILED` |
| `MasterSignalDispatch` + `Instruction` | OK — uma instrução por licença elegível; idempotência `master:{master_signal_id}:{license_id}` |
| `POST /api/master/signals` | **Inalterado** — continua `dispatch: NOT_STARTED` (sem dispatch automático) |
| Contrato EA `/api/v1/ea/instructions` | **Inalterado** — payload via `mapInstructionToEaPayload` |
| EA cliente MQL5 | **Inalterado** |
| Deploy / Neon staging | **Não aplicado** nesta entrega |
| Homologação online 2.6 | **Pendente** (após gate explícito) |

**Notas v1:** `Instruction.source` permanece `null` (TODO: enum `MASTER_DISPATCH` no schema). Quantidade padrão `1` (`MASTER_SIGNAL_DISPATCH_QUANTITY` ou constante interna).

**Correção elegibilidade (pós-homolog staging):**

- Candidatos amplos no SQL (`ACTIVE` + assinatura `ACTIVE` + MT5); **sem** filtro antecipado de `profileSlug` (evita 0 candidatos / 0 skipped).
- Regras aplicadas em `evaluateLicenseEligibility` com `skipped` auditável (`PROFILE_MISMATCH`, `NO_ACTIVE_DEVICE`, `DEMO_NOT_ALLOWED`, etc.).
- `MasterSignalDispatch` `SKIPPED` gravado por licença rejeitada.
- Sem elegíveis: status volta para `VALIDATED` + `rejectedReason=NO_ELIGIBLE_LICENSES` (não `DISPATCHED` silencioso).
- `DISPATCHED` vazio (homologação anterior) pode ser reprocessado (reset para `VALIDATED` se não houver dispatches).

---

## 13. Riscos e cuidados

| Risco | Mitigação |
|-------|-----------|
| Ordem real em homologação | Manter `InpDebugMode=true` e `allow_demo` apenas em staging até gate explícito |
| Vazamento de estratégia | Payload allowlist; revisão de respostas admin; sem campos mestre no EA cliente |
| Cliente parametriza | Sem inputs novos no EA cliente; sem API pública mestre |
| Duplicidade | `idempotency_key` + unique (`master_signal_id`, `license_id`) |
| Replay | TTL curto + registro de `received_at`; rejeitar sinais expirados no dispatch |
| Fuso horário | Persistir **UTC** no banco; converter só na UI |
| Auditoria | Todo RECEIVED/VALIDATED/DISPATCHED com contadores |
| Rollback | Migration reversível; feature flag `MASTER_EA_DISPATCH_ENABLED=false` (proposta) |
| Staging vs prod | Secrets, banco Neon e domínio separados; não reutilizar `DATABASE_URL` |
| DARF | Zero alteração em projeto/rotas DARF |
| Domínios | Staging: `autotrade-staging.mercadodariqueza.com.br`; não usar `www`; produção futura: `autotrade.mercadodariqueza.com.br` |
| Conta real | **Fora** das fases 2.1–2.10 |

---

## 14. Fora de escopo (esta etapa 2.1)

- Código aplicativo, schema Prisma, migrations.
- Endpoint HTTP, middleware, EA Mãe MQL5.
- Dashboard, EA cliente, DARF, landing, billing.
- Deploy, alteração de envs em Vercel, produção real.

---

## 15. Critérios para autorizar código (Fase 2.2+)

Antes de **qualquer** alteração em `prisma/schema.prisma` ou migrations:

| # | Critério | Responsável |
|---|----------|-------------|
| 1 | Este plano e [`MASTER-EA-SIGNAL-ARCHITECTURE.md`](MASTER-EA-SIGNAL-ARCHITECTURE.md) revisados | Produto / engenharia |
| 2 | Nomes finais de tabelas e enums de `status` aprovados | Engenharia |
| 3 | Contrato do endpoint (path, payload, códigos HTTP, idempotência) aprovado | Engenharia + API |
| 4 | Política de autenticação (header vs Bearer, rotação) aprovada | Segurança / ops |
| 5 | Comportamento idempotente documentado (200 vs 409) | Engenharia |
| 6 | Rollback e feature flag definidos | Ops |
| 7 | Allowlist de `symbol` e limites `expires_in_seconds` definidos | Estratégia ops (sem expor vault ao cliente) |
| 8 | Confirmação de não impacto em contrato EA cliente | QA / homologação |

**Checklist rápido:** “Um log ou screenshot disso revela entrada, saída, filtro ou parâmetro interno?” → Se sim, redigir ou restringir ao admin/vault.

---

## Referências

| Documento | Uso |
|-----------|-----|
| [`docs/MASTER-EA-SIGNAL-ARCHITECTURE.md`](MASTER-EA-SIGNAL-ARCHITECTURE.md) | Arquitetura alvo |
| [`docs/EA-API.md`](EA-API.md) | Contrato EA cliente homologado |
| [`docs/STAGING-VPS-HOMOLOGATION-RESULTS.md`](STAGING-VPS-HOMOLOGATION-RESULTS.md) | Baseline staging |
| [`AGENTS.md`](../AGENTS.md) | Caixa preta, auditoria, halts |

---

*Mapa de obra — Fase 2.1. Próximo passo após gate da seção 15: modelagem Prisma (Fase 2.2).*
