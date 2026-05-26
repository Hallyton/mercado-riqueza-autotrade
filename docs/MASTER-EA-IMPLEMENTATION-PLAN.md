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

## 10. Painel admin (Fases 2.7–2.8)

**Rota admin:** `/admin/master-signals` (trigger e acompanhamento consolidado homologados em staging — maio/2026)

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
| **2.6** | Concluída + homologação online staging | `eligibility.ts` + `dispatch.ts` — dispatch manual/script; `Instruction.source=MASTER_SIGNAL`; **sem** dispatch automático no POST |
| **2.7** | Concluída + homologação online staging | Admin trigger `/admin/master-signals` — intake + revisão + preview + disparo manual; **POST sem dispatch automático** |
| **2.8** | Concluída + homologação online staging | Painel de tracking consolidado; status consolidado na lista; **POST sem dispatch automático** |
| **2.9** | Concluída + homologação online staging | Simulador HTTP/CLI (`npm run master:signal`); intake apenas — **POST sem dispatch automático** |
| **2.10** | Concluída + homologação online staging | EA Mãe MQL5 `MR_AutoTrade_Master_Signal` — emissor manual; intake apenas; **POST sem dispatch automático** |
| **2.11** | Documentação concluída — gate operacional pendente | [`SIMULATED-PRODUCTION-GATE.md`](SIMULATED-PRODUCTION-GATE.md) — checklist, roteiro, reprovação, rollback; **sem** código; **sem** liberação de produção real |
| **2.12** | Concluída — `APPROVED_FOR_SIMULATED_PRODUCTION` | [`SIMULATED-PRODUCTION-GATE-RESULTS.md`](SIMULATED-PRODUCTION-GATE-RESULTS.md) — fluxo completo validado em staging; **produção real não liberada**; **POST sem dispatch automático** |
| **3.1** | Documentada | [`SIMULATED-PRODUCTION-OPERATING-PLAN.md`](SIMULATED-PRODUCTION-OPERATING-PLAN.md) — plano operacional da produção simulada controlada; **sem** código; produção real continua não liberada |
| **3.2** | Encerrada — `APPROVED_FOR_CONTROLLED_BETA` | [`SIMULATED-PRODUCTION-FINAL-REPORT.md`](SIMULATED-PRODUCTION-FINAL-REPORT.md) — 10/10 ciclos aprovados; produção real e ordem real continuam não liberadas |

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

### Fase 2.6 — dispatch interno (implementação — maio/2026)

| Item | Status |
|------|--------|
| Service `selectEligibleLicensesForMasterSignal` | OK — candidatos amplos + regras em `evaluateLicenseEligibility` |
| Service `dispatchValidatedMasterSignal` | OK — `VALIDATED` → dispatch → `DISPATCHED` / `PARTIALLY_DISPATCHED` / `FAILED` / `VALIDATED` (sem elegíveis) |
| `MasterSignalDispatch` + `Instruction` | OK — uma instrução por licença elegível; idempotência `master:{master_signal_id}:{license_id}` |
| `Instruction.source` | **`MASTER_SIGNAL`** (migration `20260524180000_add_instruction_source_master_signal`) |
| `POST /api/master/signals` | **Inalterado** — continua `dispatch: NOT_STARTED` (dispatch manual/script) |
| Contrato EA `/api/v1/ea/instructions` | **Inalterado** |
| EA cliente MQL5 | **Inalterado** |
| Painel `/admin/instrucoes` | Lista TEST, HOMOLOGATION e **MASTER_SIGNAL** |

**Correções aplicadas durante homologação staging:**

1. **`eligibleCount: 0` / `skipped: []`:** filtro SQL antecipado em `profileSlug` excluía licenças antes da avaliação. Corrigido para query ampla (`ACTIVE` + assinatura `ACTIVE` + MT5) e rejeições com `skipped` auditável (`PROFILE_MISMATCH`, `NO_ACTIVE_DEVICE`, etc.).
2. **`DISPATCHED` sem instructions:** status não marca sucesso silencioso quando `eligibleCount=0`; volta para `VALIDATED` + `NO_ELIGIBLE_LICENSES`.
3. **`source: null`:** instructions do dispatch passam a usar `InstructionSource.MASTER_SIGNAL`; aparecem no painel admin. Instructions antigas com `source` null (ex.: testes iniciais) podem ser ignoradas ou tratadas só como histórico.

### Homologação online staging — Fase 2.6 aprovada (maio/2026)

**Ambiente:** `https://autotrade-staging.mercadodariqueza.com.br`  
**Fluxo:** `POST /api/master/signals` (intake) + **`dispatchValidatedMasterSignal` via script** (não automático no POST)

| Item | Status |
|------|--------|
| Migration `MASTER_SIGNAL` no Neon staging | OK |
| Deploy Vercel staging | OK |
| MasterSignal novo (perfil **conservador**) | OK — `VALIDATED` após POST |
| Licença elegível | OK — `cmpj3wby70005sx18ot5e939p` |
| `MasterSignalDispatch` | OK — 1 registro `INSTRUCTION_CREATED` |
| `Instruction` | OK — 1 criada; `source: MASTER_SIGNAL` |
| Painel admin `/admin/instrucoes` | OK — instruction visível com origem **MASTER_SIGNAL** |
| EA cliente (`InpDebugMode=true`) | OK — recebeu instruction; **nenhuma ordem real** |
| `POST /api/v1/ea/executions` | OK — execução reportada |
| Painel — status/execução | OK |
| Retry dispatch idempotente | OK — instruction count inalterado (sem duplicata) |

**Conclusão:** Fase 2.6 homologada em staging via dispatch manual. O `MasterSignal` foi transformado em `Instruction` individual para licença elegível, com `source: MASTER_SIGNAL`, rastreável no painel e recebida pelo EA cliente. `DebugMode` impediu ordem real. Retry idempotente não duplicou `Instruction`.

### Fase 2.7 — Admin trigger (implementação — maio/2026)

| Item | Status |
|------|--------|
| `lib/master-signals/admin.ts` | OK — listagem, detalhes, pré-visualização de elegibilidade (sem persistir) |
| `lib/master-signals/admin-dispatch.ts` | OK — `dispatchMasterSignalFromAdmin` + `admin_actions` / audit |
| Painel `/admin/master-signals` | OK — lista + detalhe + botão **Disparar para clientes** (só `VALIDATED`) |
| API `POST /api/admin/master-signals/[id]/dispatch` | OK — sessão admin (SUPERADMIN/OPS); **não** usa `MASTER_EA_API_SECRET` |
| Confirmação UI | OK — checkbox + `confirm()` com aviso DebugMode em homologação |
| `POST /api/master/signals` | **Inalterado** — continua sem dispatch automático (`dispatch: NOT_STARTED`) |
| Contrato EA `/api/v1/ea/instructions` | **Inalterado** |
| EA cliente MQL5 | **Inalterado** |
| Testes `tests/master-signals/admin.test.ts` | OK — service, permissões, preview, idempotência (mock) |

**Fluxo aprovado (produto):** o EA Mãe envia o sinal via `POST /api/master/signals` → admin revisa em `/admin/master-signals` → visualiza elegibilidade (preview) → dispara manualmente para clientes elegíveis. O intake **não** dispara automaticamente.

### Homologação online staging — Fase 2.7 aprovada (maio/2026)

**Ambiente:** `https://autotrade-staging.mercadodariqueza.com.br`  
**Fluxo:** `POST /api/master/signals` (intake) → painel admin (lista, detalhe, preview) → **Disparar para clientes** → EA cliente

| Item | Status |
|------|--------|
| Deploy Vercel staging (`vercel --prod --force`) | OK — alias `https://autotrade-staging.mercadodariqueza.com.br` |
| `POST /api/master/signals` | OK — `VALIDATED`, `dispatch: NOT_STARTED` (sem dispatch automático no POST) |
| Painel `/admin/master-signals` | OK — lista com contagens; menu **Sinais mestre** |
| Detalhe + preview elegibilidade | OK — licença `cmpj3wby70005sx18ot5e939p` (perfil conservador) |
| Disparo admin **Disparar para clientes** | OK — `dispatchValidatedMasterSignal` via API admin com sessão |
| `MasterSignalDispatch` | OK — 1 registro |
| `Instruction` | OK — 1 criada; `source: MASTER_SIGNAL` |
| Painel `/admin/instrucoes` | OK — instruction visível |
| EA cliente (`InpDebugMode=true`) | OK — recebeu instruction; **nenhuma ordem real** |
| Trava de expiração (`expires_in_seconds`) | OK — primeiro teste expirou após ~5 min sem disparo; novo sinal disparado dentro do prazo com sucesso |

**Observação operacional:** sinais com `expires_in_seconds=300` exigem disparo admin dentro do TTL; após expiração o dispatch é rejeitado (`MASTER_SIGNAL_EXPIRED`) — comportamento validado em homologação.

**Conclusão:** Fase 2.7 homologada online em staging. O fluxo admin-trigger está aprovado: intake sem dispatch automático, revisão e preview no painel, disparo manual idempotente para licenças elegíveis, rastreio com `MASTER_SIGNAL` no EA em DebugMode.

### Fase 2.8 — Painel de acompanhamento (implementação — maio/2026)

| Item | Status |
|------|--------|
| `getMasterSignalTrackingForAdmin` | OK — resumo + linhas por licença + executions |
| `lib/master-signals/admin-tracking.ts` | OK — contagens e status consolidado (sem migration) |
| Detalhe `/admin/master-signals/[id]` | OK — seção **Acompanhamento do sinal** (cards + tabela por cliente) |
| Lista `/admin/master-signals` | OK — colunas Consolidado, Exec., Disp., Instr. + status consolidado |
| Status consolidado (exibição) | `NOT_DISPATCHED`, `REJECTED_NO_ELIGIBLE_LICENSES`, `DISPATCHED_PENDING`, `PARTIALLY_EXECUTED`, `EXECUTED`, `FAILED`, `EXPIRED` |
| `POST /api/master/signals` | **Inalterado** — sem dispatch automático |
| EA cliente / contrato `/api/v1/ea/instructions` | **Inalterados** |
| Botão **Disparar para clientes** | **Inalterado** — só `VALIDATED` |

**Fluxo de dados:** `MasterSignal` → `MasterSignalDispatch` (por licença) → `Instruction` (`source: MASTER_SIGNAL`) → `Execution` (status do EA). Preview de elegibilidade permanece somente leitura antes do disparo.

### Homologação online staging — Fase 2.8 aprovada (maio/2026)

**Ambiente:** `https://autotrade-staging.mercadodariqueza.com.br`

| Item | Status |
|------|--------|
| Deploy Vercel staging (`vercel --prod --force`) | OK — alias staging ativo |
| Lista `/admin/master-signals` | OK — colunas **Consolidado**, **Exec.**, **Disp.**, **Instr.** |
| Sinal já disparado/executado | OK — acompanhamento consolidado visível (ex.: sinal homologado na Fase 2.7) |
| Detalhe — **Acompanhamento do sinal** | OK — cards; `instructionCount >= 1`; `executedCount >= 1`; `source: MASTER_SIGNAL`; execução reportada pelo EA |
| Intake `test-tracking-not-dispatched-001` | OK — POST `VALIDATED`, `dispatch: NOT_STARTED` |
| Painel — sinal não disparado | OK — Consolidado **NOT_DISPATCHED**; Disp. 0; Instr. 0; Exec. 0; mensagem *ainda não foi disparado* |
| `POST /api/master/signals` | **Sem dispatch automático** — nenhuma `Instruction` até disparo admin |
| EA cliente | **Inalterado** |
| DARF / billing / dashboard cliente | **Inalterados** |

**Conclusão:** Fase 2.8 homologada online em staging. O painel admin permite acompanhar sinais mestre com status consolidado, contagens de dispatches, instructions e executions, e diferencia sinais executados de sinais ainda não disparados. O intake continua seguro e sem dispatch automático.

### Fase 2.9 — Simulador HTTP/CLI do EA Mãe (implementação — maio/2026)

| Item | Status |
|------|--------|
| `scripts/master-signals/send-master-signal.ts` | OK — CLI `tsx` |
| `lib/master-signals/simulator.ts` | OK — parse, validação Zod, dry-run, HTTP |
| `npm run master:signal` | OK — atalho no `package.json` |
| Env local | `MASTER_SIGNAL_API_URL` + `MASTER_EA_API_SECRET` — **nunca commitar** |
| `POST /api/master/signals` | **Inalterado** — sem dispatch automático |
| EA Mãe MQL5 | **Não criado** nesta fase |
| EA cliente | **Inalterado** — não acionado automaticamente pelo simulador |
| Documentação | [`docs/MASTER-EA-SIGNAL-SIMULATOR.md`](MASTER-EA-SIGNAL-SIMULATOR.md) |

**Uso:** o simulador envia `MasterSignal` para intake; o admin dispara manualmente; serve para validar payload, idempotência, 409 e fluxo admin-trigger sem MT5.

### Homologação online staging — Fase 2.9 aprovada (maio/2026)

**Ambiente:** `https://autotrade-staging.mercadodariqueza.com.br`  
**Ferramenta:** `npm run master:signal` (commit `7813b1c`)

| Item | Status |
|------|--------|
| Env local | `MASTER_SIGNAL_API_URL` + `MASTER_EA_API_SECRET` (sem commitar / sem expor) |
| POST `/api/master/signals` | OK — intake do sinal mestre |
| Sinal `sim-master-001` | OK — visível em `/admin/master-signals` |
| Painel — status DB | `VALIDATED` |
| Painel — consolidado | **Não disparado** (`NOT_DISPATCHED`) |
| Dispatches / Instructions / Executions | **0** / **0** / **0** |
| `POST /api/master/signals` | **Sem dispatch automático** — nenhuma `Instruction` criada |
| EA cliente | **Não acionado** automaticamente |
| Fluxo admin-trigger | **Necessário** para disparar para clientes |

**Conclusão:** Fase 2.9 homologada em staging. O simulador HTTP/CLI envia corretamente sinais mestres ao backend; o sinal aparece no painel como VALIDATED / não disparado, confirmando que a ferramenta faz **apenas intake**, respeitando o desenho seguro do projeto (dispatch manual via admin).

### Fase 2.10 — EA Mãe MQL5 v1 emissor manual (implementação — maio/2026)

| Item | Status |
|------|--------|
| `MR_AutoTrade_Master_Signal.mq5` | OK — POST `/api/master/signals` via WebRequest |
| Botão **Enviar sinal mestre** | OK — envio manual (`InpSendOnInit=false` por padrão) |
| Inputs | API URL, secret, símbolo, lado, perfil, TTL — **sem** parâmetros estratégicos |
| Ordens MT5 / broker | **Não** — sem `OrderSend` |
| Estratégia real | **Não** — equivalente ao simulador HTTP |
| `POST /api/master/signals` | **Inalterado** — sem dispatch automático |
| EA cliente executor | **Inalterado** |
| Documentação | [`docs/MASTER-EA-MQL5-V1.md`](MASTER-EA-MQL5-V1.md) |
| Commit implementação | `9e649a6` — `feat: add master signal MQL5 emitter` |

**Fluxo:** EA Mãe envia intake → admin revisa/dispara → fluxo cliente já homologado (Fases 2.6–2.9).

### Homologação online staging — Fase 2.10 aprovada (maio/2026)

**Ambiente:** `https://autotrade-staging.mercadodariqueza.com.br`  
**Ferramenta:** EA Mãe `MR_AutoTrade_Master_Signal` no MetaTrader 5 (commit `9e649a6`)

| Item | Status |
|------|--------|
| Compilação MetaEditor | OK |
| WebRequest liberado para URL staging | OK |
| Inputs (`InpApiBaseUrl`, `InpMasterSecret` local, `WDOM26`, `BUY`, `MARKET`, `ENTRY`, `conservador`, TTL 300) | OK — secret **não** exposto em logs/docs |
| `InpSendOnInit=false` / botão **Enviar sinal mestre** | OK — envio manual |
| `InpSendOnce=true` | OK — bloqueia reenvio na mesma sessão (novo `MasterSignalId` ou reanexar EA) |
| POST `/api/master/signals` | OK — intake do sinal mestre |
| Painel `/admin/master-signals` | OK — sinal visível |
| Status DB | `VALIDATED` |
| Consolidado no painel | **Não disparado** (`NOT_DISPATCHED`) |
| Dispatches / Instructions / Executions | **0** / **0** / **0** |
| EA Mãe — estratégia / ordem broker | **Não** — apenas intake HTTP |
| `POST /api/master/signals` | **Sem dispatch automático** |
| EA cliente | **Inalterado** no envio do EA Mãe |
| Fluxo admin-trigger (revisão → disparo → instruction → EA cliente) | OK — continua funcionando após intake |

**Conclusão:** Fase 2.10 homologada em staging. O EA Mãe MQL5 v1 foi validado como emissor manual de `MasterSignal`: envia o sinal para o backend, o sinal aparece no painel admin como **VALIDATED** / **Não disparado**, e o dispatch continua **manual** pelo admin. Nenhuma ordem real é enviada pelo EA Mãe.

### Fase 2.11 — Gate de produção simulada (documentação — maio/2026)

| Item | Status |
|------|--------|
| Documento [`SIMULATED-PRODUCTION-GATE.md`](SIMULATED-PRODUCTION-GATE.md) | OK — checklist formal (32 critérios), roteiro ponta a ponta, reprovação, rollback, template de evidências, decisão do gate |
| Alteração de código | **Não** — somente documentação operacional |
| EA cliente / EA Mãe / backend / Prisma | **Inalterados** nesta fase |
| Deploy / envs | **Não** alterados por esta fase |
| Produção real | **Não liberada** |
| Dispatch automático no POST | **Continua desativado** |
| Homologação operacional do gate | **Pendente** — executar roteiro em staging e registrar evidências com status `APPROVED_*` ou `REJECTED` |

**Conteúdo do gate:**

- Escopo: staging (Vercel + Neon + domínio oficial), EA Mãe, simulador HTTP, admin OPS/SUPERADMIN, dispatch manual, EA cliente DebugMode, tracking consolidado, auditoria.
- Fora de escopo: produção real, ordem real, dispatch automático, estratégia EA Mãe, DARF, billing, onboarding público.
- Critérios de aprovação: todos os itens obrigatórios OK, nenhuma reprovação, evidências arquivadas, sem ordem real.
- Rollback operacional e de banco documentados (sem apagar auditoria).

**Próximo passo (produto):** executar o gate operacional em staging conforme [`SIMULATED-PRODUCTION-GATE.md`](SIMULATED-PRODUCTION-GATE.md); após aprovação, registrar evidências (commit doc opcional `docs: record simulated production gate approval`).

**Produção real:** permanece **bloqueada** até fases futuras explícitas — este documento cobre apenas **produção simulada em staging**.

### Fase 2.12 — Execução do Gate de Produção Simulada (maio/2026)

**Status final:** `APPROVED_FOR_SIMULATED_PRODUCTION`  
**Resultado oficial:** [`docs/SIMULATED-PRODUCTION-GATE-RESULTS.md`](SIMULATED-PRODUCTION-GATE-RESULTS.md)

| Item | Status |
|------|--------|
| Ambiente staging | OK — `https://autotrade-staging.mercadodariqueza.com.br` |
| EA Mãe MQL5 | OK — enviou `MasterSignal` `master-mt5-002` |
| Intake `POST /api/master/signals` | OK — `VALIDATED`; **sem dispatch automático** |
| Admin dispatch | OK — `MASTER_SIGNAL_DISPATCH` auditado por `ADMIN` |
| Instruction | OK — `cmpkhy8xs003uib04p3xyj5cn`, `source: MASTER_SIGNAL`, `EXECUTED` |
| EA cliente | OK — `52609973 @ XPMT5-DEMO`, `DebugMode=true`, nenhuma ordem real |
| Tracking | OK — consolidado `EXECUTED` |
| Retry / idempotência | OK — sem duplicar instruction |
| Produção real | **Não liberada** |

**Fluxo validado:** EA Mãe → intake → admin dispatch manual → instruction `MASTER_SIGNAL` → EA cliente em `DebugMode=true` → execution report → tracking `EXECUTED`.

**Investigação crítica durante o gate:** o sinal `master-mt5-002` apareceu como `DISPATCHED` / `EXECUTED`, gerando suspeita inicial de dispatch automático. A consulta ao Neon staging confirmou diferença temporal de aproximadamente 3 minutos e 41 segundos entre `received_at` (`2026-05-25T00:53:42.460Z`) e criação do dispatch (`2026-05-25T00:57:23.869Z`), além de `AuditLog` com `action: MASTER_SIGNAL_DISPATCH`, `actor_type: ADMIN` e `adminActionId: cmpkhy9us0040ib04i5sbzuzf`.

**Conclusão:** a suspeita de dispatch automático foi descartada. O dispatch foi realizado por ação administrativa autenticada, e `POST /api/master/signals` permanece intake-only (`VALIDATED` / `NOT_STARTED` até ação admin).

**Restrições mantidas:** produção real não liberada; EA cliente deve permanecer em `DebugMode=true` em homologação; dispatch continua manual pelo admin; secrets (`MASTER_EA_API_SECRET`, `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_PASSWORD`) permanecem protegidos.

### Fase 3.1 — Plano Operacional da Produção Simulada Controlada (maio/2026)

**Status:** documentada  
**Documento:** [`docs/SIMULATED-PRODUCTION-OPERATING-PLAN.md`](SIMULATED-PRODUCTION-OPERATING-PLAN.md)

| Item | Status |
|------|--------|
| Plano operacional | OK — rotina diária/por sessão para operar staging com EA cliente em `DebugMode=true` |
| Alteração de código | **Não** |
| EA cliente / EA Mãe / backend / Prisma | **Inalterados** |
| Env / deploy | **Não alterados** |
| Produção real | **Não liberada** |
| Ordem real | **Não liberada** |
| Dispatch automático | **Continua proibido** |

**Escopo da Fase 3.1:** transformar o gate aprovado em operação simulada repetível, com rotina de pré-check, envio de sinal mestre, validação `NOT_DISPATCHED`, revisão admin, dispatch manual, recebimento pelo EA cliente em `DebugMode=true`, execution report e tracking.

**Critérios operacionais propostos para Fase 3:** mínimo de 10 ciclos simulados aprovados, em pelo menos 3 dias diferentes, com cenários de expiração, retry/idempotência e rollback operacional. Nenhuma ordem real, nenhum dispatch automático, nenhuma duplicidade indevida e nenhum secret exposto.

**Próximo passo (produto):** executar os ciclos da produção simulada controlada conforme o plano operacional e registrar evidências por ciclo antes de qualquer discussão sobre presets internos, estratégia real do EA Mãe ou beta fechado.

### Fase 3.2 — Registro dos Ciclos Simulados (maio/2026)

**Status:** encerrada  
**Resultado final:** `APPROVED_FOR_CONTROLLED_BETA`  
**Documentos:** [`docs/SIMULATED-PRODUCTION-CYCLES.md`](SIMULATED-PRODUCTION-CYCLES.md) e [`docs/SIMULATED-PRODUCTION-FINAL-REPORT.md`](SIMULATED-PRODUCTION-FINAL-REPORT.md)

| Item | Status |
|------|--------|
| Registro dos ciclos | OK — 10/10 ciclos simulados aprovados |
| Critérios por ciclo | OK — aprovação, reprovação imediata e evidências mínimas |
| Correção funcional durante a fase | OK — `603170e fix: block master dispatch when no licenses are eligible` |
| Rollback operacional | OK — Ciclo 10 aprovado |
| Alteração de código | Sim, apenas correção de backend/admin tracking no Ciclo 09; sem schema/migration/env/deploy |
| EA cliente / EA Mãe / Prisma/schema | **Inalterados** |
| Env / deploy | **Não alterados** |
| Produção real | **Não liberada** |
| Ordem real | **Não liberada** |
| Dispatch automático | **Continua proibido** |

**Objetivo:** controlar a execução dos 10 ciclos mínimos da produção simulada controlada, incluindo BUY/SELL válidos, simulador HTTP, retry/idempotência, disparo admin repetido, sinal expirado, EA offline/online, sem licença elegível e rollback operacional.

**Encerramento da Fase 3:** 10/10 ciclos aprovados, 0 reprovados, 0 com restrição, nenhuma ordem real, nenhum dispatch automático, nenhum secret exposto e rollback operacional testado. Status final: `APPROVED_FOR_CONTROLLED_BETA`.

**Nota operacional — Ciclo 09:** o teste inicial confirmou a segurança principal do cenário sem licença elegível: a licença staging foi ignorada por `PROFILE_MISMATCH`, nenhum `Instruction` foi criado, o EA cliente não recebeu instruction e nenhuma ordem real foi enviada. O commit `603170e` ajustou status/UI para marcar `REJECTED` com `rejectedReason=NO_ELIGIBLE_LICENSES`, mostrar `Elegíveis=0` / `Ignorados=1` / `Pendentes=0` e bloquear o botão de dispatch. A re-homologação com `cycle-09-profile-mismatch-002` foi aprovada.

**Nota operacional — Ciclo 10:** rollback operacional validado com `cycle-10-rollback-001`: instruction criada e mantida pendente após parada/remoção do EA cliente, sem execution e sem ordem real, com histórico preservado no painel.

**Restrições mantidas:** produção real não liberada; ordem real não liberada; beta controlado exige nova fase, novo gate e aprovação explícita.

### Fase 4 — Preparação do Beta Controlado / Gate de Beta Controlado

**Status:** recomendada como próxima fase  
**Objetivo:** preparar critérios para um beta restrito, ainda controlado, antes de qualquer produção real.

| Item | Status |
|------|--------|
| Produção real | **Bloqueada** |
| Ordem real | **Bloqueada** |
| Gate de beta controlado | Pendente |
| Critérios de risco/rollback/autorização manual | Pendentes |

**Próximo passo (produto):** elaborar o Gate de Beta Controlado com critérios de entrada/saída, limites operacionais e de risco, evidências obrigatórias, responsabilidades, rollback e aprovação explícita. Qualquer avanço para conta real permanece fora de escopo até novo gate aprovado.

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
| Conta real | **Fora** das fases 2.1–2.12 (gate simulado não libera produção) |

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
| [`docs/SIMULATED-PRODUCTION-GATE.md`](SIMULATED-PRODUCTION-GATE.md) | Gate produção simulada (Fase 2.11) |
| [`docs/SIMULATED-PRODUCTION-GATE-RESULTS.md`](SIMULATED-PRODUCTION-GATE-RESULTS.md) | Resultado aprovado do gate produção simulada (Fase 2.12) |
| [`docs/SIMULATED-PRODUCTION-OPERATING-PLAN.md`](SIMULATED-PRODUCTION-OPERATING-PLAN.md) | Plano operacional da produção simulada controlada (Fase 3.1) |
| [`docs/SIMULATED-PRODUCTION-CYCLES.md`](SIMULATED-PRODUCTION-CYCLES.md) | Registro dos ciclos simulados da produção simulada controlada (Fase 3.2) |
| [`docs/SIMULATED-PRODUCTION-FINAL-REPORT.md`](SIMULATED-PRODUCTION-FINAL-REPORT.md) | Relatório final da produção simulada controlada (Fase 3) |
| [`AGENTS.md`](../AGENTS.md) | Caixa preta, auditoria, halts |

---

*Mapa de obra — Fase 2.1. Próximo passo após gate da seção 15: modelagem Prisma (Fase 2.2).*
