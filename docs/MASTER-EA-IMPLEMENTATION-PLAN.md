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
| **4.1** | Documentada | [`CONTROLLED-BETA-GATE.md`](CONTROLLED-BETA-GATE.md) — gate de beta controlado; produção real, ordem real e dispatch automático continuam bloqueados |
| **4.2** | Documentada | [`CONTROLLED-BETA-PARTICIPANT-001.md`](CONTROLLED-BETA-PARTICIPANT-001.md) — participante beta demo nº 1; Cliente Staging; `52609973 @ XPMT5-DEMO`; produção real e ordem real continuam bloqueadas |
| **4.3** | Executada e aprovada | [`CONTROLLED-BETA-SESSION-001.md`](CONTROLLED-BETA-SESSION-001.md) — sessão beta demo nº 1 aprovada com `beta-demo-001-buy-002`; `DebugMode=true`; produção real e ordem real continuam bloqueadas |
| **4.4** | Concluída — `APPROVED_FOR_DEBUGMODE_FALSE_GATE` | [`CONTROLLED-BETA-RECURRING-SESSIONS-PLAN.md`](CONTROLLED-BETA-RECURRING-SESSIONS-PLAN.md) — Sessões 02 BUY, 03 SELL e 04 retry/idempotência aprovadas; produção real e ordem real continuam bloqueadas |
| **4.5** | Documentada | [`DEMO-DEBUGMODE-FALSE-GATE.md`](DEMO-DEBUGMODE-FALSE-GATE.md) — gate para demo com `DebugMode=false`; produção real, conta real e dispatch automático continuam bloqueados |
| **4.6** | Registrada — `PENDING_REVIEW` | [`DEMO-DEBUGMODE-FALSE-GATE-RESULTS.md`](DEMO-DEBUGMODE-FALSE-GATE-RESULTS.md) — resultado preliminar do gate |
| **4.7** | Aprovada — `APPROVED_FOR_DEMO_DEBUGMODE_FALSE_TEST` | [`DEMO-DEBUGMODE-FALSE-GATE-RESULTS.md`](DEMO-DEBUGMODE-FALSE-GATE-RESULTS.md) — aprovação manual do gate para uma única sessão futura em conta demo; produção real, conta real e dispatch automático continuam bloqueados |
| **4.8** | Executada e aprovada — `APPROVED` | [`DEMO-DEBUGMODE-FALSE-SESSION-001.md`](DEMO-DEBUGMODE-FALSE-SESSION-001.md) — Sessão Demo Controlada nº 1 com `DebugMode=false` aprovada em conta demo; produção real, conta real e dispatch automático continuam bloqueados |
| **4.9** | Documentada — `APPROVED_FOR_NEXT_RISK_GATE_DISCUSSION` | [`DEMO-DEBUGMODE-FALSE-FINAL-REPORT.md`](DEMO-DEBUGMODE-FALSE-FINAL-REPORT.md) — relatório final da etapa demo com `DebugMode=false`; produção real, conta real e dispatch automático continuam bloqueados |
| **5.1** | Documentada — `PLANNED` | [`REAL-ACCOUNT-ULTRA-CONTROLLED-GATE.md`](REAL-ACCOUNT-ULTRA-CONTROLLED-GATE.md) — gate de conta real ultra-controlada; conta real, produção real e dispatch automático continuam bloqueados |
| **5.2** | Documentada — `DRAFT_OPERATIONAL` | [`REAL-ACCOUNT-ACCEPTANCE-AND-LIMITS.md`](REAL-ACCOUNT-ACCEPTANCE-AND-LIMITS.md) — minuta operacional de aceite e limites; conta real, produção real e dispatch automático continuam bloqueados |
| **5.3** | Documentada — `DRAFT_CHECKLIST` | [`REAL-ACCOUNT-INDIVIDUAL-APPROVAL-CHECKLIST.md`](REAL-ACCOUNT-INDIVIDUAL-APPROVAL-CHECKLIST.md) — checklist individual para revisão de conta real ultra-controlada; conta real, produção real e dispatch automático continuam bloqueados |
| **5.4** | Documentada — `REAL_ACCOUNT_NOT_APPROVED` | [`REAL-ACCOUNT-RISK-GATE-SUMMARY.md`](REAL-ACCOUNT-RISK-GATE-SUMMARY.md) — relatório de consolidação do gate de conta real; conta real, produção real e dispatch automático continuam bloqueados |
| **5.5** | Documentada — `PENDING_REVIEWS` | [`REAL-ACCOUNT-LEGAL-OPERATIONAL-REVIEW-PLAN.md`](REAL-ACCOUNT-LEGAL-OPERATIONAL-REVIEW-PLAN.md) — plano de revisão jurídica, operacional e técnica; conta real, produção real e dispatch automático continuam bloqueados |
| **5.6** | Documentada — `REAL_ACCOUNT_NOT_APPROVED` | [`REAL-ACCOUNT-GOVERNANCE-PACK-INDEX.md`](REAL-ACCOUNT-GOVERNANCE-PACK-INDEX.md) — índice do pacote de governança para conta real; conta real, produção real e dispatch automático continuam bloqueados |
| **5.7** | Documentada — `EXECUTIVE_STATUS_DOCUMENTED` | [`PROJECT-EXECUTIVE-STATUS-REPORT.md`](PROJECT-EXECUTIVE-STATUS-REPORT.md) — relatório executivo do estado atual do projeto; conta real, produção real e dispatch automático continuam bloqueados |
| **5.8** | Documentada | [`AUTOTRADE-PARTNER-PRESENTATION-PACK.md`](AUTOTRADE-PARTNER-PRESENTATION-PACK.md) — pacote de apresentação para corretora, jurídico, parceiro técnico ou investidor; conta real, produção real e dispatch automático continuam bloqueados |
| **5.9** | Documentada — `MEETING_BRIEFING_READY` | [`AUTOTRADE-PARTNER-MEETING-BRIEFING.md`](AUTOTRADE-PARTNER-MEETING-BRIEFING.md) — roteiro de reunião com corretora, jurídico ou parceiro; conta real, produção real e dispatch automático continuam bloqueados |
| **5.10** | Documentada | [`AUTOTRADE-PARTNER-MEETING-INVITE.md`](AUTOTRADE-PARTNER-MEETING-INVITE.md) — convite executivo para reunião com corretora, jurídico ou parceiro; conta real, produção real e dispatch automático continuam bloqueados |
| **5.11** | Documentada — `OUTREACH_MESSAGES_READY` | [`AUTOTRADE-PARTNER-OUTREACH-MESSAGE.md`](AUTOTRADE-PARTNER-OUTREACH-MESSAGE.md) — mensagens de abordagem para corretora, jurídico, parceiro técnico ou investidor; conta real, produção real e dispatch automático continuam bloqueados |
| **6.1** | Implementada localmente | [`REAL-TRADING-GUARD.md`](REAL-TRADING-GUARD.md) — Real Trading Guard / Kill Switch de Conta Real; conta real, produção real e dispatch automático continuam bloqueados |
| **6.2** | Homologada com restrições — `APPROVED_WITH_RESTRICTIONS` | [`REAL-TRADING-GUARD.md`](REAL-TRADING-GUARD.md#9-homologação-staging--fase-62) — deploy staging do guard validado; smoke DEMO e simulação REAL pendentes por segurança; conta real, produção real e dispatch automático continuam bloqueados |
| **6.3** | Implementada localmente | [`REAL-TRADING-GUARD.md`](REAL-TRADING-GUARD.md#10-fase-63--harness-seguro-de-diagnóstico) — harness seguro de diagnóstico do Real Trading Guard; valida cenários DEMO/REAL sem conta real, sem banco e sem env real; conta real, produção real e dispatch automático continuam bloqueados |
| **6.4** | Implementada localmente | [`REAL-TRADING-GUARD.md`](REAL-TRADING-GUARD.md#11-fase-64--painel-admin-read-only) — painel admin read-only do Real Trading Guard; visibilidade operacional sem controle de liberação; conta real, produção real e dispatch automático continuam bloqueados |
| **6.5** | Homologada com restrições — `APPROVED_WITH_RESTRICTIONS` | [`REAL-TRADING-GUARD.md`](REAL-TRADING-GUARD.md#12-homologação-staging--fase-65) — deploy staging do painel admin validado e rota protegida; validação visual autenticada pendente por ausência de sessão admin segura; conta real, produção real e dispatch automático continuam bloqueados |
| **6.6** | Homologada — `APPROVED` | [`REAL-TRADING-GUARD.md`](REAL-TRADING-GUARD.md#13-homologação-staging--fase-66--validação-visual-autenticada) — validação visual autenticada do painel Real Trading Guard; tela read-only confirmada, sem env bruto, sem toggle e com conta real bloqueada |

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

### Fase 4.1 — Gate de Beta Controlado

**Status:** documentada  
**Documento:** [`docs/CONTROLLED-BETA-GATE.md`](CONTROLLED-BETA-GATE.md)  
**Objetivo:** preparar critérios para um beta restrito, ainda controlado, antes de qualquer produção real.

| Item | Status |
|------|--------|
| Gate de beta controlado | Criado |
| Produção real | **Bloqueada** |
| Ordem real | **Bloqueada** |
| Dispatch automático | **Bloqueado** |
| Critérios de risco/rollback/autorização manual | Documentados |
| Billing/DARF/dashboard cliente | **Inalterados** |

**Escopo da Fase 4.1:** documentar critérios mínimos para iniciar beta controlado com poucos participantes, aceite explícito, suporte próximo, monitoramento diário, evidências por participante e rollback operacional. O gate separa beta demo de beta real: demo pode ser avaliado após aprovação do gate; conta real exige gate futuro específico.

**Próxima etapa:** executar o gate de beta controlado ou criar o registro do primeiro participante beta demo. Qualquer avanço para conta real permanece fora de escopo até novo gate aprovado.

### Fase 4.2 — Registro do Participante Beta Demo nº 1

**Status:** documentada  
**Documento:** [`docs/CONTROLLED-BETA-PARTICIPANT-001.md`](CONTROLLED-BETA-PARTICIPANT-001.md)  
**Participante:** Cliente Staging  
**Conta:** `52609973 @ XPMT5-DEMO`

| Item | Status |
|------|--------|
| Participante beta demo nº 1 | Registrado |
| LicenseId | `cmpj3wby70005sx18ot5e939p` |
| Perfil | `conservador` |
| Ativo permitido | `WDOM26` |
| Status inicial | `CANDIDATO_BETA_DEMO` |
| Produção real | **Bloqueada** |
| Ordem real | **Bloqueada** |
| Dispatch automático | **Bloqueado** |
| Billing/DARF/dashboard cliente | **Inalterados** |

**Escopo da Fase 4.2:** registrar o primeiro participante autorizado para beta controlado em conta demo, com regras operacionais, requisitos técnicos, limites iniciais, critérios de pausa, template de evidências e próxima ação.

**Próxima etapa:** executar a sessão beta demo controlada nº 1 com este participante, ainda com `DebugMode=true`, e registrar evidências. Qualquer uso de conta real exige gate futuro específico.

### Fase 4.3 — Sessão Beta Demo Controlada nº 1

**Status:** executada e aprovada  
**Documento:** [`docs/CONTROLLED-BETA-SESSION-001.md`](CONTROLLED-BETA-SESSION-001.md)  
**Participante:** Cliente Staging  
**Modo:** `DebugMode=true`  
**MasterSignalId oficial:** `beta-demo-001-buy-002`

| Item | Status |
|------|--------|
| Sessão beta demo controlada nº 1 | Aprovada |
| LicenseId | `cmpj3wby70005sx18ot5e939p` |
| Conta | `52609973 @ XPMT5-DEMO` |
| Perfil | `conservador` |
| Ativo permitido | `WDOM26` |
| Status final da sessão | `APPROVED` |
| Tracking | `EXECUTED` |
| Produção real | **Bloqueada** |
| Ordem real | **Bloqueada** |
| Dispatch automático | **Bloqueado** |
| Billing/DARF/dashboard cliente | **Inalterados** |

**Resultado da Fase 4.3:** sessão beta demo nº 1 aprovada com o MasterSignal `beta-demo-001-buy-002`. O EA cliente estava anexado no gráfico, apontando para staging, com `DebugMode=true`, heartbeat `ONLINE` e WebRequest liberado. O painel mostrou `VALIDATED` / `NOT_DISPATCHED` antes do disparo, o admin revisou elegibilidade e disparou manualmente, a `Instruction` `MASTER_SIGNAL` foi criada, o EA recebeu a instruction, o `DEBUG_MODE` impediu ordem real, o execution report foi enviado e o tracking ficou `EXECUTED`.

**Restrições mantidas:** produção real bloqueada; ordem real bloqueada; dispatch automático desativado; beta real exige gate futuro específico.

**Próxima etapa recomendada:** Fase 4.4 — Plano de Sessões Beta Demo recorrentes ou Gate para Demo sem `DebugMode`, ainda sem conta real.

### Fase 4.4 — Plano de Sessões Beta Demo Recorrentes

**Status:** concluída  
**Documento:** [`docs/CONTROLLED-BETA-RECURRING-SESSIONS-PLAN.md`](CONTROLLED-BETA-RECURRING-SESSIONS-PLAN.md)  
**Objetivo:** executar sessões repetidas com `DebugMode=true` antes de qualquer gate para `DebugMode=false`.

| Item | Status |
|------|--------|
| Plano de sessões beta demo recorrentes | Concluído |
| Participante | Cliente Staging |
| Conta | `52609973 @ XPMT5-DEMO` |
| Perfil | `conservador` |
| Ativo permitido | `WDOM26` |
| Modo | `DebugMode=true` |
| Sessão 02 — BUY | Aprovada com `beta-demo-002-buy-001`; tracking `EXECUTED` |
| Sessão 03 — SELL | Aprovada com `beta-demo-003-sell-001`; tracking `EXECUTED` |
| Sessão 04 — retry/idempotência | Aprovada reutilizando `beta-demo-003-sell-001`; sem duplicidade |
| Status final do plano | `APPROVED_FOR_DEBUGMODE_FALSE_GATE` |
| Produção real | **Bloqueada** |
| Ordem real | **Bloqueada** |
| Dispatch automático | **Bloqueado** |
| Billing/DARF/dashboard cliente | **Inalterados** |

**Escopo da Fase 4.4:** definir rotina segura para sessões beta demo recorrentes com 1 participante, 1 conta demo, 1 ativo, perfil conservador, dispatch manual admin, `DebugMode=true` e registro de evidências por sessão. O plano exige pelo menos 3 sessões recorrentes, em pelo menos 2 dias diferentes, cobrindo BUY, SELL e retry/idempotência ou expiração.

**Registro de execução:** as sessões recorrentes planejadas foram aprovadas. O MasterSignal `beta-demo-002-buy-001` validou BUY e o MasterSignal `beta-demo-003-sell-001` validou SELL. A Sessão 04 reutilizou `beta-demo-003-sell-001` com `beta-demo-003-sell-001-key` para validar idempotência: a API tratou como retry, não criou nova instruction, não criou novo dispatch indevido, não criou execution duplicada e preservou contagens 1/1/1. Todas as sessões mantiveram `DebugMode=true`, sem ordem real, tracking consistente e dispatch automático desativado.

**Critério para próximo gate:** somente discutir Gate para Demo com `DebugMode=false` se todas as sessões recorrentes forem aprovadas com 0 ordens reais, 0 dispatch automático, 0 duplicidades indevidas, 0 secrets expostos, tracking consistente e rollback conhecido.

**Próxima etapa recomendada:** Fase 4.5 — Gate para Demo com `DebugMode=false`. Produção real, ordem real em conta real e dispatch automático permanecem bloqueados; qualquer uso de conta real exige gate futuro específico.

### Fase 4.5 — Gate para Demo com DebugMode=false

**Status:** documentada  
**Documento:** [`docs/DEMO-DEBUGMODE-FALSE-GATE.md`](DEMO-DEBUGMODE-FALSE-GATE.md)  
**Objetivo:** criar critérios antes de permitir ordem em conta demo com o EA cliente em `DebugMode=false`.

| Item | Status |
|------|--------|
| Gate para demo com `DebugMode=false` | Criado |
| Participante | Cliente Staging |
| Conta | `52609973 @ XPMT5-DEMO` |
| Perfil | `conservador` |
| Ativo permitido | `WDOM26` |
| Produção real | **Bloqueada** |
| Conta real | **Bloqueada** |
| Dispatch automático | **Bloqueado** |
| Billing/DARF/dashboard cliente | **Inalterados** |

**Escopo da Fase 4.5:** documentar critérios técnicos e operacionais antes de permitir que o EA cliente envie ordem para o MetaTrader demo. `DebugMode=false` em demo ainda não envolve dinheiro real, mas exige sessão acompanhada, limite de uma instruction, ausência de posições/ordens antes do teste, rollback claro e evidência completa.

**Próxima etapa:** executar o gate e, se aprovado, planejar uma sessão demo com `DebugMode=false`. Produção real, conta real e dispatch automático permanecem fora de escopo.

### Fase 4.6 — Execução do Gate para Demo com DebugMode=false

**Status:** `PENDING_REVIEW`  
**Documento:** [`docs/DEMO-DEBUGMODE-FALSE-GATE-RESULTS.md`](DEMO-DEBUGMODE-FALSE-GATE-RESULTS.md)  
**Objetivo:** registrar a revisão operacional do gate antes de permitir ordem em conta demo com o EA cliente em `DebugMode=false`.

| Item | Status |
|------|--------|
| Resultado do gate | `PENDING_REVIEW` |
| Participante | Cliente Staging |
| Conta | `52609973 @ XPMT5-DEMO` |
| Perfil | `conservador` |
| Ativo permitido | `WDOM26` |
| Produção real | **Bloqueada** |
| Conta real | **Bloqueada** |
| Dispatch automático | **Bloqueado** |
| `DebugMode=false` | **Ainda não autorizado** |
| Billing/DARF/dashboard cliente | **Inalterados** |

**Resultado da Fase 4.6:** o gate foi registrado em `PENDING_REVIEW` porque a aprovação final exige confirmação operacional manual de itens como EA instalado/apontado para staging, WebRequest liberado, heartbeat `ONLINE`, ausência de posições/ordens pendentes, logs MT5 visíveis, responsável e horário definidos.

**Próxima etapa:** validar os itens pendentes do checklist. Se todos forem confirmados como OK, atualizar o resultado para `APPROVED_FOR_DEMO_DEBUGMODE_FALSE_TEST` e só então planejar uma sessão demo controlada com `DebugMode=false`. Produção real, conta real e dispatch automático permanecem bloqueados.

### Fase 4.7 — Aprovação do Gate Demo com DebugMode=false

**Status:** `APPROVED_FOR_DEMO_DEBUGMODE_FALSE_TEST`  
**Documento:** [`docs/DEMO-DEBUGMODE-FALSE-GATE-RESULTS.md`](DEMO-DEBUGMODE-FALSE-GATE-RESULTS.md)  
**Objetivo:** registrar a aprovação manual do gate para permitir somente o planejamento de uma sessão futura em conta demo com `DebugMode=false`.

| Item | Status |
|------|--------|
| Gate Demo com `DebugMode=false` | `APPROVED_FOR_DEMO_DEBUGMODE_FALSE_TEST` |
| Escopo autorizado | Uma sessão futura em conta DEMO |
| Participante | Cliente Staging |
| Conta | `52609973 @ XPMT5-DEMO` |
| Perfil | `conservador` |
| Ativo permitido | `WDOM26` |
| Máximo de sinais | 1 |
| Dispatch | Manual admin |
| Retry manual após execução | **Bloqueado** |
| Produção real | **Bloqueada** |
| Conta real | **Bloqueada** |
| Dispatch automático | **Bloqueado** |
| Sessão demo | **Ainda não executada** |
| Billing/DARF/dashboard cliente | **Inalterados** |

**Resultado da Fase 4.7:** o operador validou manualmente os pré-requisitos do MT5 e do ambiente: conta demo confirmada, ausência de posições/ordens pendentes, EA cliente instalado e apontado para staging, WebRequest liberado, heartbeat `ONLINE`, logs MT5 visíveis, AutoTrading sob controle, rollback conhecido, admin acompanhando em tempo real, limite de 1 sinal, dispatch manual obrigatório e sem retry após execução.

**Próxima etapa:** Fase 4.8 — Sessão Demo Controlada nº 1 com `DebugMode=false`. A sessão futura deve continuar limitada a conta DEMO, 1 sinal, dispatch manual, monitoramento em tempo real e rollback imediato disponível. Produção real, conta real e dispatch automático permanecem bloqueados.

### Fase 4.8 — Sessão Demo Controlada nº 1 com DebugMode=false

**Status:** `APPROVED`  
**Documento:** [`docs/DEMO-DEBUGMODE-FALSE-SESSION-001.md`](DEMO-DEBUGMODE-FALSE-SESSION-001.md)  
**Objetivo:** registrar a primeira sessão controlada em conta demo com o EA cliente em `DebugMode=false`.

| Item | Status |
|------|--------|
| Sessão | Demo Controlada nº 1 com `DebugMode=false` |
| Status da sessão | `APPROVED` |
| Participante | Cliente Staging |
| Conta | `52609973 @ XPMT5-DEMO` |
| Tipo de conta | DEMO |
| Ativo permitido | `WDOM26` |
| Perfil | `conservador` |
| Falha segura inicial | `demo-dmf-001-buy-001` — `OrderSend` falhou `retcode=10027 AutoTrading disabled by client`, sem ordem enviada |
| MasterSignalId aprovado | `demo-dmf-001-buy-002` |
| Máximo de sinais aprovados | 1 |
| Dispatch | Manual admin |
| Retry manual após execução | **Bloqueado** |
| Tracking | `EXECUTED` |
| Instruction | `EXECUTED` |
| Execution | `EXECUTED` |
| Pendentes | 0 |
| Falhas | 0 |
| Produção real | **Bloqueada** |
| Conta real | **Bloqueada** |
| Dispatch automático | **Bloqueado** |
| Billing/DARF/dashboard cliente | **Inalterados** |

**Resultado da Fase 4.8:** a demo com `DebugMode=false` foi validada em uma sessão única em conta DEMO. O primeiro teste falhou de forma segura com AutoTrading desativado no MT5 (`retcode=10027`), sem envio de ordem demo ou real. Após correção operacional, o sinal aprovado `demo-dmf-001-buy-002` foi executado com dispatch manual, execution report recebido pela API e tracking consolidado como `EXECUTED`.

**Pós-sessão:** o EA cliente deve voltar para `DebugMode=true` ou ser removido do gráfico. Produção real, conta real e dispatch automático permanecem bloqueados.

**Próxima etapa recomendada:** relatório de encerramento da Fase 4 ou gate futuro específico para conta real. Nenhuma dessas etapas libera produção real automaticamente.

### Fase 4.9 — Relatório Final da Demo com DebugMode=false

**Status:** `APPROVED_FOR_NEXT_RISK_GATE_DISCUSSION`  
**Documento:** [`docs/DEMO-DEBUGMODE-FALSE-FINAL-REPORT.md`](DEMO-DEBUGMODE-FALSE-FINAL-REPORT.md)  
**Objetivo:** registrar o encerramento da etapa de conta demo com `DebugMode=false`.

| Item | Status |
|------|--------|
| Relatório final | Documentado |
| Conta validada | `52609973 @ XPMT5-DEMO` |
| Tipo de conta | DEMO |
| MasterSignalId aprovado | `demo-dmf-001-buy-002` |
| Falha segura inicial | `demo-dmf-001-buy-001` — AutoTrading disabled, sem ordem enviada |
| Tracking | `EXECUTED` |
| Produção real | **Bloqueada** |
| Conta real | **Bloqueada** |
| Dispatch automático | **Bloqueado** |
| Billing/DARF/dashboard cliente | **Inalterados** |

**Resultado da Fase 4.9:** a etapa Demo com `DebugMode=false` foi encerrada como documentada após validação de uma sessão única em conta DEMO, com dispatch manual, execution report confirmado e tracking `EXECUTED`.

**Próxima etapa possível:** gate futuro para conta real ultra-controlada, ainda sem aprovação automática. A discussão desse gate não libera produção real, conta real, dinheiro real ou dispatch automático.

### Fase 5.1 — Gate de Conta Real Ultra-Controlada

**Status:** `PLANNED`  
**Documento:** [`docs/REAL-ACCOUNT-ULTRA-CONTROLLED-GATE.md`](REAL-ACCOUNT-ULTRA-CONTROLLED-GATE.md)  
**Objetivo:** definir critérios mínimos antes de qualquer uso de dinheiro real.

| Item | Status |
|------|--------|
| Gate de conta real ultra-controlada | Documentado |
| Status inicial | `PLANNED` |
| Base de evidência | Demo `DebugMode=false` aprovada |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Bloqueado** |
| Billing/DARF/dashboard cliente | **Inalterados** |

**Escopo da Fase 5.1:** documentar critérios técnicos, operacionais, jurídicos e de risco antes de sequer considerar uma sessão real ultra-controlada. O gate exige aceite formal, limites definidos, monitoramento em tempo real, rollback, decisão manual documentada e continua proibindo escala, múltiplos clientes e dispatch automático.

**Próxima etapa:** revisar juridicamente/operacionalmente o gate, definir limites formais e preparar termo de aceite. A existência deste gate não libera conta real, produção real, dinheiro real ou dispatch automático.

### Fase 5.2 — Termo Operacional de Aceite e Limites

**Status:** `DRAFT_OPERATIONAL`  
**Documento:** [`docs/REAL-ACCOUNT-ACCEPTANCE-AND-LIMITS.md`](REAL-ACCOUNT-ACCEPTANCE-AND-LIMITS.md)  
**Objetivo:** criar base de aceite, ciência de risco, responsabilidades e limites antes de qualquer conta real.

| Item | Status |
|------|--------|
| Termo operacional de aceite e limites | Documentado |
| Status inicial | `DRAFT_OPERATIONAL` |
| Revisão jurídica | **Pendente** |
| Limites numéricos | **A definir antes de qualquer conta real** |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Bloqueado** |
| Billing/DARF/dashboard cliente | **Inalterados** |

**Escopo da Fase 5.2:** documentar uma minuta operacional para aceite, ciência de risco, estratégia caixa preta, limites, responsabilidades, critérios de pausa e autorização específica. O documento não é contrato jurídico final, não substitui revisão jurídica e não libera operação real.

**Próxima etapa:** revisão jurídica/operacional, definição de limites formais e criação de checklist de aprovação individual antes de qualquer conta real.

### Fase 5.3 — Checklist Individual de Aprovação para Conta Real Ultra-Controlada

**Status:** `DRAFT_CHECKLIST`  
**Documento:** [`docs/REAL-ACCOUNT-INDIVIDUAL-APPROVAL-CHECKLIST.md`](REAL-ACCOUNT-INDIVIDUAL-APPROVAL-CHECKLIST.md)  
**Objetivo:** criar checklist individual para avaliar informações, limites, aceite, pré-check técnico e bloqueadores antes de qualquer revisão final de risco.

| Item | Status |
|------|--------|
| Checklist individual | Documentado |
| Status inicial | `DRAFT_CHECKLIST` |
| Limites financeiros | **A definir — bloqueiam conta real** |
| Revisão jurídica | **Pendente quando exigida** |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Bloqueado** |
| Billing/DARF/dashboard cliente | **Inalterados** |

**Escopo da Fase 5.3:** documentar identificação do participante, identificação da conta, escopo operacional pretendido, limites financeiros obrigatórios, aceite e ciência de risco, pré-check técnico, bloqueadores imediatos, decisão individual e próxima ação recomendada.

**Observação crítica:** mesmo `APPROVED_FOR_RISK_COMMITTEE_REVIEW` não libera operação real. Apenas permite revisão final de risco.

### Fase 5.4 — Relatório de Consolidação do Gate de Conta Real

**Status:** `REAL_ACCOUNT_NOT_APPROVED`  
**Documento:** [`docs/REAL-ACCOUNT-RISK-GATE-SUMMARY.md`](REAL-ACCOUNT-RISK-GATE-SUMMARY.md)  
**Objetivo:** consolidar documentos, status e bloqueios atuais da trilha de risco para conta real.

| Item | Status |
|------|--------|
| Relatório de consolidação | Documentado |
| Gate | `PLANNED` |
| Termo | `DRAFT_OPERATIONAL` |
| Checklist | `DRAFT_CHECKLIST` |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Bloqueado** |
| Limites financeiros | **Indefinidos** |
| Revisão jurídica | **Pendente** |
| Participante real | **Não aprovado** |

**Resultado da Fase 5.4:** a documentação de risco para conta real foi consolidada, mas o status permanece `REAL_ACCOUNT_NOT_APPROVED`. Nenhuma ordem real, conta real ou produção real está permitida.

**Próxima etapa:** revisão jurídica/operacional e definição de limites, se houver decisão futura de avançar para nova avaliação de risco.

### Fase 5.5 — Plano de Revisão Jurídica e Operacional

**Status:** `PENDING_REVIEWS`  
**Documento:** [`docs/REAL-ACCOUNT-LEGAL-OPERATIONAL-REVIEW-PLAN.md`](REAL-ACCOUNT-LEGAL-OPERATIONAL-REVIEW-PLAN.md)  
**Objetivo:** organizar revisões jurídica, operacional e técnica antes de qualquer decisão real.

| Item | Status |
|------|--------|
| Plano de revisão | Documentado |
| Revisão jurídica | `PENDING_LEGAL_REVIEW` |
| Revisão operacional | `PENDING_OPERATIONAL_REVIEW` |
| Revisão técnica | `PENDING_TECHNICAL_REVIEW` |
| Limites numéricos | **A definir — bloqueiam conta real** |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Bloqueado** |
| Billing/DARF/dashboard cliente | **Inalterados** |

**Escopo da Fase 5.5:** organizar as revisões necessárias antes de qualquer decisão real, incluindo validação jurídica, operacional, técnica, limites, aceite, rollback, responsável ao vivo e decisão manual registrada.

**Próxima etapa:** revisão jurídica/operacional/técnica e definição de limites, se houver decisão futura de avançar. `READY_FOR_RISK_COMMITTEE_REVIEW` ainda não libera conta real.

### Fase 5.6 — Índice do Pacote de Governança para Conta Real

**Status:** `REAL_ACCOUNT_NOT_APPROVED`  
**Documento:** [`docs/REAL-ACCOUNT-GOVERNANCE-PACK-INDEX.md`](REAL-ACCOUNT-GOVERNANCE-PACK-INDEX.md)  
**Objetivo:** organizar documentos para revisão futura de conta real.

| Item | Status |
|------|--------|
| Índice do pacote de governança | Documentado |
| Status atual | `REAL_ACCOUNT_NOT_APPROVED` |
| Revisão jurídica | **Pendente** |
| Revisão operacional | **Pendente** |
| Revisão técnica | **Pendente** |
| Limites financeiros | **Indefinidos** |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Bloqueado** |

**Escopo da Fase 5.6:** consolidar o índice dos documentos de governança necessários para revisão futura, a ordem recomendada de leitura e as pendências bloqueantes.

**Próxima etapa:** encaminhar o pacote para revisão jurídica/operacional/técnica somente se houver decisão estratégica de avançar. Este índice não libera conta real, produção real ou dispatch automático.

### Fase 5.7 — Relatório Executivo do Estado Atual do Projeto

**Status:** `EXECUTIVE_STATUS_DOCUMENTED`  
**Documento:** [`docs/PROJECT-EXECUTIVE-STATUS-REPORT.md`](PROJECT-EXECUTIVE-STATUS-REPORT.md)  
**Objetivo:** consolidar estado técnico, operacional e de risco do projeto.

| Item | Status |
|------|--------|
| Relatório executivo | Documentado |
| Status técnico | VALIDADO EM STAGING / DEMO |
| Status de conta real | `REAL_ACCOUNT_NOT_APPROVED` |
| Produção simulada | 10/10 ciclos aprovados |
| Demo `DebugMode=false` | Aprovada em conta DEMO |
| Governança de conta real | Documentada |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Bloqueado** |

**Resultado da Fase 5.7:** o estado atual do projeto foi consolidado em relatório executivo, incluindo validações técnicas, linha do tempo, evidências, resultado de segurança, bloqueios para conta real, próximo risco e recomendação executiva.

**Próxima etapa recomendada:** revisão jurídica/operacional ou pausa controlada para avaliação estratégica. Não avançar para conta real sem revisão jurídica, limites definidos, checklist individual aprovado e decisão final manual.

### Fase 5.8 — Pacote de Apresentação para Corretora / Jurídico / Parceiro

**Status:** documentado  
**Documento:** [`docs/AUTOTRADE-PARTNER-PRESENTATION-PACK.md`](AUTOTRADE-PARTNER-PRESENTATION-PACK.md)  
**Objetivo:** preparar material externo sem liberar conta real.

| Item | Status |
|------|--------|
| Pacote de apresentação | Documentado |
| Público-alvo | Corretora / jurídico / parceiro técnico / investidor |
| Status técnico | VALIDADO EM STAGING / DEMO |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Bloqueado** |

**Escopo da Fase 5.8:** consolidar uma narrativa para parceiros sobre o projeto, fluxo validado, evidências, travas, status atual, lacunas para conta real e próximos passos possíveis.

**Observação:** este pacote não libera conta real, produção real ou dispatch automático. Serve apenas como material de apresentação e alinhamento.

### Fase 5.9 — Roteiro de Reunião com Corretora / Jurídico / Parceiro

**Status:** `MEETING_BRIEFING_READY`  
**Documento:** [`docs/AUTOTRADE-PARTNER-MEETING-BRIEFING.md`](AUTOTRADE-PARTNER-MEETING-BRIEFING.md)  
**Objetivo:** preparar pauta de reunião sem liberar conta real.

| Item | Status |
|------|--------|
| Briefing de reunião | Documentado |
| Público-alvo | Corretora / jurídico / parceiro técnico / investidor |
| Status técnico | VALIDADO EM STAGING / DEMO |
| Decisão atual | `REAL_ACCOUNT_NOT_APPROVED` |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Bloqueado** |

**Escopo da Fase 5.9:** preparar pauta de reunião com objetivo, resumo do projeto, status atual, validações, perguntas por público, riscos, documentos de apoio, decisões esperadas e próximos passos possíveis.

**Próxima etapa:** usar o briefing em reunião ou preparar versão em apresentação/slides. Este roteiro não libera conta real, produção real ou dispatch automático.

### Fase 5.10 — Convite Executivo para Reunião com Corretora / Jurídico / Parceiro

**Status:** documentado  
**Documento:** [`docs/AUTOTRADE-PARTNER-MEETING-INVITE.md`](AUTOTRADE-PARTNER-MEETING-INVITE.md)  
**Objetivo:** preparar comunicação formal sem liberar conta real.

| Item | Status |
|------|--------|
| Convite executivo | Documentado |
| Modelos incluídos | E-mail formal e mensagem curta |
| Público-alvo | Corretora / jurídico / parceiro técnico / investidor |
| Status técnico | VALIDADO EM STAGING / DEMO |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Bloqueado** |

**Escopo da Fase 5.10:** preparar um texto de convite profissional, pauta sugerida, documentos de apoio e mensagem de cautela obrigatória para o primeiro contato formal.

**Observação:** o convite não libera conta real, produção real, dinheiro real ou dispatch automático. Serve apenas para iniciar alinhamento com corretora, jurídico ou parceiro técnico.

### Fase 5.11 — Mensagens de Abordagem para Corretora / Jurídico / Parceiro

**Status:** `OUTREACH_MESSAGES_READY`  
**Documento:** [`docs/AUTOTRADE-PARTNER-OUTREACH-MESSAGE.md`](AUTOTRADE-PARTNER-OUTREACH-MESSAGE.md)  
**Objetivo:** preparar comunicação externa sem liberar conta real.

| Item | Status |
|------|--------|
| Mensagens de abordagem | Documentadas |
| Canais | WhatsApp, LinkedIn, e-mail formal, follow-up |
| Público-alvo | Corretora / jurídico / parceiro técnico / investidor |
| Status técnico | VALIDADO EM STAGING / DEMO |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Bloqueado** |

**Escopo da Fase 5.11:** criar mensagens prontas de abordagem, incluindo versões curtas, e-mails segmentados, follow-up pós-reunião, anexos sugeridos e frases obrigatórias de cautela.

**Próxima etapa:** enviar mensagem a parceiro/corretora ou preparar apresentação/slides. Estas mensagens não liberam conta real, produção real, dinheiro real ou dispatch automático.

### Fase 6.1 — Real Trading Guard / Kill Switch de Conta Real

**Status:** implementado localmente  
**Documento:** [`docs/REAL-TRADING-GUARD.md`](REAL-TRADING-GUARD.md)  
**Objetivo:** bloquear tecnicamente qualquer entrega de instruction para EA em `tradeMode=REAL` enquanto conta real não estiver aprovada.

| Item | Status |
|------|--------|
| Guard central | Implementado em `lib/risk/real-trading-guard.ts` |
| Dispatch MasterSignal | Bloqueia licença com último heartbeat `REAL` |
| Pull do EA | Retorna HTTP 200 com `instructions: []` quando bloqueado |
| Feature flag futura | Default deny e exige allowlist por licença |
| Admin/tracking | Exibe motivo legível para `REAL_TRADING_DISABLED` |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |

**Escopo da Fase 6.1:** implementar código defensivo e testes para impedir entrega de instruction a conta em modo real, sem alterar EA cliente, EA Mãe, Prisma/schema, migrations, envs reais ou deploy.

**Próxima etapa:** manter validação local e discutir eventual etapa futura somente após revisão jurídica, operacional, técnica e aprovação específica. Esta fase não libera conta real, produção real, dinheiro real ou dispatch automático.

### Fase 6.2 — Homologação staging do Real Trading Guard

**Status:** `APPROVED_WITH_RESTRICTIONS`  
**Documento:** [`docs/REAL-TRADING-GUARD.md`](REAL-TRADING-GUARD.md#9-homologação-staging--fase-62)  
**Objetivo:** homologar o Real Trading Guard em staging sem usar conta real e sem liberar produção real.

| Item | Resultado |
|------|-----------|
| Deploy staging | Realizado com `vercel --prod --force` |
| Ready state | `READY` |
| Alias oficial | `https://autotrade-staging.mercadodariqueza.com.br` |
| Endpoint público | Home HTTP 200 |
| MasterSignal sem auth | HTTP 401 `MASTER_AUTH_REQUIRED` |
| EA instructions sem token | HTTP 401 `MISSING_TOKEN` |
| Smoke DEMO | Pendente por ausência segura de `MASTER_EA_API_SECRET` local/sessão admin |
| REAL simulado | Pendente por ausência de fixture isolada/autorização para mutar heartbeat |
| `ENABLE_REAL_TRADING` | Não configurado por nome no Vercel |
| `REAL_TRADING_ALLOWED_LICENSE_IDS` | Não configurado por nome no Vercel |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |

**Escopo da Fase 6.2:** confirmar deploy e postura segura do ambiente. Não foi executado teste que exigiria secret em claro, sessão admin indisponível ou alteração de heartbeat da licença operacional principal sem aprovação explícita.

**Próxima etapa:** preparar uma fixture isolada de staging ou obter autorização operacional explícita para uma simulação `tradeMode=REAL` com rollback imediato. Esta fase não libera conta real, produção real, dinheiro real ou dispatch automático.

### Fase 6.3 — Harness Seguro de Diagnóstico do Real Trading Guard

**Status:** implementado localmente  
**Documento:** [`docs/REAL-TRADING-GUARD.md`](REAL-TRADING-GUARD.md#10-fase-63--harness-seguro-de-diagnóstico)  
**Objetivo:** permitir validação segura de cenários DEMO/REAL sem usar conta real.

| Item | Resultado |
|------|-----------|
| Script | `scripts/risk/diagnose-real-trading-guard.ts` |
| Comando | `npm run risk:diagnose-real-guard` |
| Banco | Não utilizado |
| Secrets | Não utilizados |
| Env real | Não alterado |
| Vercel | Não alterado |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |

**Escopo da Fase 6.3:** criar diagnóstico local com envs injetados em memória para validar default deny, allowlist futura e comportamento atual para `tradeMode` ausente/desconhecido.

**Próxima etapa:** usar o harness como pré-validação antes de qualquer nova rodada de homologação controlada. Esta fase não libera conta real, produção real, dinheiro real ou dispatch automático.

### Fase 6.4 — Painel Admin Read-Only do Real Trading Guard

**Status:** implementado localmente  
**Documento:** [`docs/REAL-TRADING-GUARD.md`](REAL-TRADING-GUARD.md#11-fase-64--painel-admin-read-only)  
**Objetivo:** dar visibilidade operacional sem criar controle de liberação.

| Item | Resultado |
|------|-----------|
| Página admin | `/admin/risk/real-trading-guard` |
| Helper de status | `lib/risk/real-trading-guard-status.ts` |
| Navegação admin | `Risco / Real Guard` |
| Modo | Somente leitura |
| Toggle de real trading | Não criado |
| Valores brutos de env | Não expostos |
| Allowlist | Exibe apenas contagem e IDs mascarados |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |

**Escopo da Fase 6.4:** criar uma tela admin para auditoria operacional do Real Trading Guard, sem alterar envs, banco, schema, EA cliente, EA Mãe ou fluxo de dispatch.

**Próxima etapa:** usar a tela apenas para inspeção operacional. Esta fase não libera conta real, produção real, dinheiro real ou dispatch automático.

### Fase 6.5 — Homologação Staging do Painel Real Trading Guard

**Status:** `APPROVED_WITH_RESTRICTIONS`  
**Documento:** [`docs/REAL-TRADING-GUARD.md`](REAL-TRADING-GUARD.md#12-homologação-staging--fase-65)  
**Objetivo:** homologar em staging o painel admin read-only do Real Trading Guard.

| Item | Resultado |
|------|-----------|
| Deploy staging | Realizado com `vercel --prod --force` |
| Deploy ID | `dpl_EhrsMyozCUnb7qfr2BQMoqgXLxWa` |
| Ready state | `READY` |
| Alias oficial | `https://autotrade-staging.mercadodariqueza.com.br` |
| Rota admin | `/admin/risk/real-trading-guard` |
| Sem sessão | Redirect HTTP 307 para login |
| Validação autenticada | Pendente por ausência de sessão admin segura |
| Env bruto exposto | NÃO |
| Toggle de real trading | NÃO |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |

**Escopo da Fase 6.5:** validar deploy, rota protegida e documentação do painel read-only. Não foram usadas credenciais admin, secrets ou qualquer mecanismo para contornar autenticação.

**Próxima etapa:** validar visualmente o conteúdo autenticado quando houver sessão admin segura disponível. Esta fase não libera conta real, produção real, dinheiro real ou dispatch automático.

### Fase 6.6 — Validação Visual Autenticada do Painel Real Trading Guard

**Status:** `APPROVED`  
**Documento:** [`docs/REAL-TRADING-GUARD.md`](REAL-TRADING-GUARD.md#13-homologação-staging--fase-66--validação-visual-autenticada)  
**Objetivo:** confirmar visualmente no admin autenticado que a tela é read-only, não expõe env bruto, não possui toggle e mantém conta real bloqueada.

| Item | Resultado |
|------|-----------|
| URL validada | `https://autotrade-staging.mercadodariqueza.com.br/admin/risk/real-trading-guard` |
| Sessão admin autenticada | Validada manualmente |
| Menu admin | Exibe `Risco / Real Guard` |
| Status principal | `REAL_TRADING_BLOCKED` |
| Política | `BLOCK_REAL_BY_DEFAULT` |
| `ENABLE_REAL_TRADING` | Configurado: Não |
| Allowlist | Configurada: Não |
| Licenças permitidas | 0 |
| Env bruto exposto | NÃO |
| Secret exposto | NÃO |
| Toggle de real trading | NÃO |
| Botão de ativação | NÃO |
| Tela | Somente leitura |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |

**Resultado da Fase 6.6:** painel validado visualmente com usuário admin autenticado em staging. A tela confirmou a política de bloqueio, não exibiu env bruto/secrets, não mostrou toggle ou botão de liberação e manteve mensagens de cautela.

**Próxima etapa:** manter o painel apenas como ferramenta de auditoria operacional. Esta fase não libera conta real, produção real, dinheiro real ou dispatch automático.

### Fase 6.7 — Smoke Test DEMO pós Real Trading Guard

**Status:** `APPROVED`  
**Documento:** [`docs/REAL-TRADING-GUARD.md`](REAL-TRADING-GUARD.md#14-fase-67--smoke-test-demo-pós-real-trading-guard)  
**Objetivo:** confirmar que o Real Trading Guard não quebra o fluxo `DEMO` enquanto mantém `REAL` bloqueado por padrão.

| Item | Resultado |
|------|-----------|
| Ambiente | `https://autotrade-staging.mercadodariqueza.com.br` |
| MasterSignalId | `real-guard-demo-smoke-002` |
| Conta | `52609973 @ XPMT5-DEMO` |
| Tipo / `tradeMode` | `DEMO` |
| DebugMode EA cliente | `true` |
| Ativo | `WDOM26` |
| Side / OrderType / Purpose | `BUY` / `MARKET` / `ENTRY` |
| Profile | `conservador` |
| Status DB | `DISPATCHED` |
| Status consolidado | `EXECUTED` |
| Dispatches / instruções / executadas | `1 / 1 / 1` |
| Instruction `MASTER_SIGNAL` | Criada |
| Tracking final | `EXECUTED` |
| Real Trading Guard bloqueou DEMO | NÃO |
| Ordem real enviada | NÃO |
| Conta real usada | NÃO |
| Produção real liberada | NÃO |
| Dispatch automático | **Desativado** |
| `ENABLE_REAL_TRADING` | Não configurado |
| Allowlist | Não configurada |

**Resultado da Fase 6.7:** o smoke DEMO `real-guard-demo-smoke-002` foi executado com tracking final `EXECUTED`. O fluxo `DEMO` permaneceu elegível, a instruction `MASTER_SIGNAL` foi criada e executada em ambiente controlado com `DebugMode=true`, e o Real Trading Guard não bloqueou `DEMO`.

**Restrições mantidas:** conta real continua bloqueada, produção real continua bloqueada, dinheiro real continua bloqueado e dispatch automático continua desativado. A política padrão permanece bloquear `REAL`.

### Fase 6.8 — Relatório Final do Real Trading Guard

**Status:** `REAL_TRADING_GUARD_VALIDATED_FOR_STAGING_DEMO`  
**Documento:** [`docs/REAL-TRADING-GUARD-FINAL-REPORT.md`](REAL-TRADING-GUARD-FINAL-REPORT.md)  
**Objetivo:** consolidar implementação, testes, homologações, painel admin, smoke DEMO e restrições mantidas da trava de conta real.

| Item | Resultado |
|------|-----------|
| Implementação do guard | Consolidada |
| Política padrão | `BLOCK_REAL_BY_DEFAULT` |
| Status admin | `REAL_TRADING_BLOCKED` |
| Harness local | `8/8` cenários `PASS` |
| Painel admin | Somente leitura, sem toggle e sem botão de ativação |
| Smoke DEMO | `real-guard-demo-smoke-002` com tracking `EXECUTED` |
| `ENABLE_REAL_TRADING` | Não configurado |
| Allowlist | Não configurada |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |

**Resultado da Fase 6.8:** relatório final criado para consolidar a validação do Real Trading Guard em staging/demo. A decisão final é que a trava está validada para proteger o ambiente staging/demo e manter conta `REAL` bloqueada por padrão.

**Próxima etapa:** definir a próxima frente técnica ou auditoria. Qualquer avanço futuro com conta real exige gate jurídico, operacional e técnico específico.

### Fase 7.1 — Plano de Auditoria Técnica Pré-Conta Real

**Status:** `PLANNED`  
**Documento:** [`docs/PRE-REAL-TECHNICAL-AUDIT-PLAN.md`](PRE-REAL-TECHNICAL-AUDIT-PLAN.md)  
**Objetivo:** estruturar revisão técnica antes de qualquer avaliação futura de conta real.

| Item | Resultado |
|------|-----------|
| Escopo | Auditoria técnica de autenticação, APIs EA, MasterSignal, dispatch, Real Trading Guard, idempotência, tracking, banco/Prisma, EAs, rollback e observabilidade |
| Status inicial | `PLANNED` |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |
| Alteração de envs | NÃO |
| Alteração de schema/migration | NÃO |
| Alteração de EA | NÃO |
| Deploy | NÃO |

**Resultado da Fase 7.1:** plano de auditoria técnica pré-conta real criado para orientar a revisão por blocos, sem liberar operação real ou modificar sistemas.

**Próxima etapa:** executar auditoria técnica por blocos, começando por autenticação/rotas, APIs EA, MasterSignal/dispatch e Real Trading Guard.

### Fase 7.2 — Auditoria de Autenticação, Rotas Admin e APIs Sensíveis

**Status:** `APPROVED`  
**Documento:** [`docs/PRE-REAL-AUDIT-AUTH-ROUTES-RESULTS.md`](PRE-REAL-AUDIT-AUTH-ROUTES-RESULTS.md)  
**Objetivo:** validar login/sessão admin, proteção de páginas `/admin`, proteção de APIs `app/api/admin/**`, dispatch sem sessão, comportamento autenticado e segurança de `callbackUrl`.

| Item | Resultado |
|------|-----------|
| Páginas admin avaliadas | `/admin`, `/admin/clientes`, `/admin/instrucoes`, `/admin/master-signals`, `/admin/master-signals/[masterSignalId]`, `/admin/risk/real-trading-guard` |
| APIs admin avaliadas | `POST /api/admin/instructions`, `POST /api/admin/master-signals/[masterSignalId]/dispatch`, `POST /api/admin/emergency/cancel-orders`, `POST /api/admin/licenses/[licenseId]/pause-entries`, `POST /api/admin/users/[userId]/block` |
| Testes adicionados | `tests/admin/auth-routes.test.ts` |
| Teste focado | 9/9 passing |
| Achados críticos | Nenhum |
| Correção aplicada | Extração de helper testável para `callbackUrl`, sem alterar comportamento funcional |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |

**Resultado da Fase 7.2:** auditoria aprovada para o bloco de autenticação, rotas admin e APIs sensíveis. Não foi identificada rota admin crítica sem auth, e o dispatch manual sem sessão foi validado como bloqueado.

**Próxima etapa:** seguir a auditoria técnica por blocos, com foco em APIs EA e contratos de device/licença/token.

### Fase 7.3 — Auditoria das APIs do EA

**Status:** `APPROVED`  
**Documento:** [`docs/PRE-REAL-AUDIT-EA-APIS-RESULTS.md`](PRE-REAL-AUDIT-EA-APIS-RESULTS.md)  
**Objetivo:** validar autenticação/identificação do EA, licença/device/token, heartbeat, config, pull de instructions, execution report, payload inválido, idempotência e integração com Real Trading Guard.

| Item | Resultado |
|------|-----------|
| APIs avaliadas | `POST /api/v1/ea/activate`, `GET /api/v1/ea/config`, `POST /api/v1/ea/heartbeat`, `GET /api/v1/ea/instructions`, `POST /api/v1/ea/executions`, `POST /api/v1/ea/instructions/ignore`, `POST /api/v1/ea/errors` |
| Testes adicionados/ajustados | `tests/ea/api-protections.test.ts`, `tests/ea/auth.test.ts` |
| Teste focado | 25/25 passing |
| Achados críticos | Nenhum |
| Correção funcional | Nenhuma |
| Real Trading Guard em pull REAL | `instructions: []` + `real_trading_blocked=true` |
| Device revogado | Bloqueado por busca com `revokedAt: null` |
| Secrets em respostas testadas | NÃO |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |

**Resultado da Fase 7.3:** auditoria aprovada para as APIs do EA no contexto staging/demo. Não foram encontrados achados críticos, e a integração com Real Trading Guard permaneceu bloqueando `REAL` por padrão sem quebrar `DEMO`.

**Próxima etapa:** seguir para auditoria de MasterSignal/dispatch e idempotência ponta a ponta.

### Fase 7.4 — Auditoria de MasterSignal, Dispatch e Idempotência

**Status:** `APPROVED`  
**Documento:** [`docs/PRE-REAL-AUDIT-MASTER-SIGNAL-DISPATCH-RESULTS.md`](PRE-REAL-AUDIT-MASTER-SIGNAL-DISPATCH-RESULTS.md)  
**Objetivo:** validar intake MasterSignal, autenticação do EA Mãe, idempotência, expiração, elegibilidade, dispatch manual, criação de `Instruction MASTER_SIGNAL`, bloqueio de duplicidade e tracking consolidado.

| Item | Resultado |
|------|-----------|
| Rota avaliada | `POST /api/master/signals` |
| Serviços avaliados | `intakeMasterSignal`, `dispatchValidatedMasterSignal`, `dispatchMasterSignalFromAdmin`, eligibility e tracking admin |
| Testes ajustados | `tests/master-signals/route.test.ts`, `tests/master-signals/dispatch.test.ts`, `tests/master-signals/admin.test.ts` |
| Teste focado | 79/79 passing |
| Achados críticos | Nenhum |
| Correção funcional | Nenhuma |
| Dispatch automático no intake | NÃO |
| Retry idempotente | Sem duplicar dispatch/instruction |
| Real Trading Guard no dispatch | Respeitado |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |

**Resultado da Fase 7.4:** auditoria aprovada para MasterSignal, dispatch manual e idempotência no contexto staging/demo. O intake permanece sem dispatch automático, o dispatch repetido não duplica instruction e o tracking consolidado mantém estados legíveis e auditáveis.

**Próxima etapa:** seguir a auditoria por blocos, com foco em observabilidade/logs, rollback e cenários integrados de retry/offline/online.

### Fase 7.5 — Auditoria de Tracking, Logs, Observabilidade e Redaction

**Status:** `APPROVED`  
**Documento:** [`docs/PRE-REAL-AUDIT-TRACKING-OBSERVABILITY-RESULTS.md`](PRE-REAL-AUDIT-TRACKING-OBSERVABILITY-RESULTS.md)  
**Objetivo:** validar tracking admin, status consolidado, contadores, skipped reasons, hints, `rawPayloadRedacted`, responses seguras, metadata de `AdminAction` / `AuditLog` e ausência de secrets em payloads/respostas testadas.

| Item | Resultado |
|------|-----------|
| Áreas avaliadas | Tracking MasterSignal, redaction de payload, problem details, APIs EA, `AdminAction` / `AuditLog` |
| Testes ajustados | `tests/master-signals/route.test.ts`, `tests/master-signals/admin.test.ts`, `tests/admin/record-action.test.ts`, `tests/ea/api-protections.test.ts` |
| Teste focado | 57/57 passing |
| Achados críticos | Nenhum |
| Correções aplicadas | Redaction ampliada, mensagens de auth sem nome de env sensível e metadata admin redigida |
| Secrets em responses testadas | NÃO |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |

**Resultado da Fase 7.5:** auditoria aprovada para tracking, logs, observabilidade e redaction no contexto staging/demo. As respostas testadas não expõem secrets, o tracking mantém contadores/status consistentes e a trilha admin/audit redige metadata sensível.

**Próxima etapa:** seguir a auditoria por blocos, com foco em rollback, incident response e cenários integrados de retry/offline/online.

### Fase 7.6 — Auditoria de Rollback, Retry, Offline/Online e Recuperação

**Status:** `APPROVED`  
**Documento:** [`docs/PRE-REAL-AUDIT-ROLLBACK-RECOVERY-RESULTS.md`](PRE-REAL-AUDIT-ROLLBACK-RECOVERY-RESULTS.md)  
**Objetivo:** validar comportamento de recuperação operacional em EA offline/online, instruction pendente, retries de pull/execution report, execution duplicada, expiração, falha de `OrderSend`, pausa/cancelamento admin e consistência do tracking após falhas.

| Item | Resultado |
|------|-----------|
| Cenários avaliados | EA offline, reconexão, retry de pull, retry de execution, rejected/failed, expiração, pausa e cancelamento emergencial |
| Testes ajustados | `tests/master-signals/dispatch.test.ts`, `tests/master-signals/admin.test.ts`, `tests/ea/instructions.test.ts`, `tests/ea/executions.test.ts`, `tests/admin/auth-routes.test.ts`, `tests/admin/commands.test.ts` |
| Teste focado | 97/97 passing |
| Achados críticos | Nenhum |
| Correções aplicadas | Redaction de mensagens operacionais de execution/`OrderSend` antes de persistir |
| Retry de pull | Não duplica instruction; `SENT` sem execution permanece entregável |
| Retry de execution report | Idempotente para execution terminal existente |
| Rollback admin | Pausa/cancelamento protegidos por admin e com trilha preservada |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |

**Resultado da Fase 7.6:** auditoria aprovada para rollback, retry, offline/online e recuperação no contexto staging/demo. O fluxo preserva histórico, evita duplicidades testadas e mantém recuperação operacional sem envio real.

**Próxima etapa:** seguir a auditoria por blocos, com foco em incident response/runbook e validações manuais controladas em staging com EA em `DebugMode=true`.

### Fase 7.7 — Auditoria de Banco, Prisma, Integridade e Histórico

**Status:** `APPROVED`  
**Documento:** [`docs/PRE-REAL-AUDIT-DATABASE-PRISMA-RESULTS.md`](PRE-REAL-AUDIT-DATABASE-PRISMA-RESULTS.md)  
**Objetivo:** validar schema Prisma, modelos críticos, relações, constraints, índices, payloads redigidos, retenção de histórico, ausência de secrets persistidos e compatibilidade de rollback sem apagar trilhas operacionais.

| Item | Resultado |
|------|-----------|
| Modelos avaliados | `User`, `License`, `Device`, `ActivationCode`, `Instruction`, `Execution`, `MasterSignal`, `MasterSignalDispatch`, `AdminAction`, `AuditLog` |
| Relações avaliadas | `User -> License`, `License -> Device`, `License -> Instruction`, `Instruction -> Execution`, `MasterSignal -> Dispatch -> Instruction -> Execution` |
| Testes ajustados | `tests/database/prisma-integrity.test.ts`, `tests/ea/activate-validation.test.ts`, `tests/ea/executions.test.ts`, `tests/master-signals/admin.test.ts` |
| Teste focado | 49/49 passing |
| Achados críticos | Nenhum |
| Correção de schema/migration | Nenhuma |
| Correções aplicadas | Testes de integridade de schema, token hash, status terminal e reconstrução histórica |
| Histórico de rollback | Preservado por `InstructionStatusLog`, `AdminAction` e `AuditLog` |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |

**Resultado da Fase 7.7:** auditoria aprovada para banco, Prisma, integridade e histórico no contexto staging/demo. Não houve migration/schema, e as pendências restantes são recomendações de política formal de retenção/arquivamento para fase futura.

**Próxima etapa:** seguir a auditoria por blocos, com foco em incident response/runbook e validações manuais controladas em staging.

### Fase 7.8 — Auditoria de EA Cliente e EA Mãe

**Status:** `APPROVED_WITH_RESTRICTIONS`  
**Documento:** [`docs/PRE-REAL-AUDIT-EA-CLIENT-MASTER-RESULTS.md`](PRE-REAL-AUDIT-EA-CLIENT-MASTER-RESULTS.md)  
**Objetivo:** auditar contratos operacionais, documentação, parâmetros, segurança, payloads e fluxos de integração do EA cliente `MR_AutoTrade_Executor` e do EA Mãe `MR_AutoTrade_Master_Signal`.

| Item | Resultado |
|------|-----------|
| Documentos avaliados | `docs/EA-API.md`, `docs/MASTER-EA-MQL5-V1.md`, `docs/MASTER-EA-SIGNAL-SIMULATOR.md`, relatórios Real Trading Guard / DebugMode / auditorias anteriores |
| Arquivos MQL5 avaliados | `ea/mql5/MR_AutoTrade_Executor.mq5`, `ea/mql5/MR_AutoTrade_Master_Signal.mq5`, includes `MR_AT_*` e `MR_MS_*` |
| Testes adicionados | `tests/ea/mql-contracts.test.ts` |
| Teste focado | 55/55 passing |
| Achados críticos | Nenhum |
| Alteração MQL5 | Nenhuma |
| Status | `APPROVED_WITH_RESTRICTIONS` por depender de recompilação/smoke manual no MetaTrader |
| Restrição principal | `device_token` é armazenado localmente pelo EA cliente; exige hardening da VPS/MT5 |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |

**Resultado da Fase 7.8:** auditoria aprovada com restrições para contratos do EA cliente e EA Mãe. Os papéis permanecem separados, o EA Mãe não envia ordens, o EA cliente segue executor licenciado e `REAL` continua bloqueado pelo backend.

**Próxima etapa:** seguir a auditoria por blocos, com foco em runbook operacional, incident response e validações manuais controladas em staging.

### Fase 7.9 — Auditoria de Ambiente, VPS, MT5 e Hardening Operacional

**Status:** `APPROVED_WITH_RESTRICTIONS`  
**Documento:** [`docs/PRE-REAL-AUDIT-ENVIRONMENT-MT5-HARDENING.md`](PRE-REAL-AUDIT-ENVIRONMENT-MT5-HARDENING.md)  
**Objetivo:** definir requisitos mínimos de hardening operacional para Windows/VPS, MetaTrader 5, `MQL5/Files`, WebRequest, AutoTrading, logs, acesso remoto, tokens locais e rollback antes de qualquer conta real.

| Item | Resultado |
|------|-----------|
| Escopo | VPS/Windows, MT5, `MQL5/Files`, logs, WebRequest, AutoTrading, credenciais MT5, acesso remoto, firewall, backup e operadores |
| Status | `APPROVED_WITH_RESTRICTIONS` por depender de validação manual do ambiente real/VPS/MT5 |
| Código alterado | Nenhum |
| EA alterado | Nenhum |
| Schema/migration | Nenhum |
| Testes/build | Não executados — alteração documental |
| Restrição principal | Operadores autorizados e política de acesso ainda `A DEFINIR — BLOQUEIA CONTA REAL` |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |

**Resultado da Fase 7.9:** checklist de hardening operacional aprovado com restrições. A fase não valida uma VPS real específica; define os critérios que precisam ser cumpridos antes de qualquer ambiente com risco maior.

**Próxima etapa:** validar ambiente/VPS/MT5 real ou criar checklist de operação diária com responsáveis definidos.

### Fase 7.10 — Runbook Operacional Diário e Checklist de Sessão

**Status:** `DRAFT_OPERATIONAL_RUNBOOK`  
**Documento:** [`docs/PRE-REAL-DAILY-OPERATIONS-RUNBOOK.md`](PRE-REAL-DAILY-OPERATIONS-RUNBOOK.md)  
**Objetivo:** padronizar preparação, execução, monitoramento, encerramento, evidências e rollback de sessões controladas antes de qualquer conta real.

| Item | Resultado |
|------|-----------|
| Escopo | Staging/demo, conta demo, `DebugMode=true` por padrão, dispatch manual, monitoramento admin, evidências e rollback |
| Não autorizado | Conta real, dinheiro real, produção real, dispatch automático, múltiplos clientes/ativos ou operação sem responsável/evidência |
| Papéis operacionais | `A DEFINIR` — bloqueia qualquer sessão real futura |
| Checklists criados | Pré-sessão, criação do sinal, dispatch admin, EA cliente, tracking, pós-sessão e evidência |
| Código alterado | Nenhum |
| EA alterado | Nenhum |
| Schema/migration | Nenhum |
| Testes/build | Não executados — alteração documental |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |

**Resultado da Fase 7.10:** runbook criado em status `DRAFT_OPERATIONAL_RUNBOOK`. O documento serve como base para sessões demo/staging e precisa ser validado em operação controlada antes de avançar para qualquer revisão de maior risco.

**Próxima etapa:** validar o runbook em uma sessão demo/staging e preencher responsáveis/evidências.

### Fase 7.11 — Validação do Runbook em Sessão Demo/Staging

**Status:** `APPROVED`  
**Documento:** [`docs/PRE-REAL-RUNBOOK-VALIDATION-RESULTS.md`](PRE-REAL-RUNBOOK-VALIDATION-RESULTS.md)  
**Objetivo:** confirmar que o runbook operacional diário é aplicável na operação de staging/demo, com checklists, evidências e rollback documentados.

| Item | Resultado |
|------|-----------|
| Validação documental e operacional do runbook | OK |
| Evidência visual no admin | OK — `/admin/master-signals/runbook-demo-session-001` |
| MasterSignalId | `runbook-demo-session-001` |
| Ambiente | `https://autotrade-staging.mercadodariqueza.com.br` |
| Conta | `52609973 @ XPMT5-DEMO` |
| `tradeMode` / DebugMode | `DEMO` / `true` |
| Tracking final | `EXECUTED` |
| Dispatches / instruções / executadas | `1 / 1 / 1` |
| Dispatch | Manual |
| Real Trading Guard bloqueou DEMO | Não |
| Ordem real enviada | Não |
| Rollback | Não utilizado |
| Runbook (status) | `READY_FOR_DEMO_OPERATIONS` |
| Papéis operacionais | `A DEFINIR` — bloqueia conta real |
| Código / EA / schema / env / deploy | Nenhuma alteração |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |

**Resultado da Fase 7.11:** runbook validado em sessão demo/staging real com `runbook-demo-session-001`, checklists operacionais aplicados, tracking `EXECUTED` confirmado no painel, `DebugMode=true` e sem ordem real. Pendência de evidência operacional resolvida.

**Próxima etapa:** preencher responsáveis operacionais no runbook e repetir o checklist em novas sessões demo/staging antes de qualquer gate de conta real.

### Fase 7.12 — Relatório Final da Auditoria Técnica Pré-Conta Real

**Status:** `PRE_REAL_TECHNICAL_AUDIT_APPROVED_WITH_RESTRICTIONS`  
**Documento:** [`docs/PRE-REAL-TECHNICAL-AUDIT-FINAL-REPORT.md`](PRE-REAL-TECHNICAL-AUDIT-FINAL-REPORT.md)  
**Objetivo:** consolidar a auditoria técnica das Fases 7.1 a 7.11, Real Trading Guard (Fase 6) e evidência operacional do runbook.

| Item | Resultado |
|------|-----------|
| Escopo consolidado | Auth/admin, APIs EA, MasterSignal, tracking, rollback, banco, EAs, ambiente MT5/VPS, runbook |
| Status final | `PRE_REAL_TECHNICAL_AUDIT_APPROVED_WITH_RESTRICTIONS` |
| Decisão atual | `REAL_ACCOUNT_NOT_APPROVED` |
| Fases 7.2–7.7 | `APPROVED` |
| Fases 7.8–7.9 | `APPROVED_WITH_RESTRICTIONS` |
| Fase 7.11 | `APPROVED` — `runbook-demo-session-001`, tracking `EXECUTED` |
| Código / EA / schema / env / deploy | Nenhuma alteração nesta fase |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |

**Resultado da Fase 7.12:** auditoria técnica pré-conta real encerrada documentalmente. A plataforma permanece validada para staging/demo; restrições jurídicas, operacionais e de governança impedem conta real até novo gate explícito.

**Próxima etapa:** criar tag do marco técnico e decidir entre revisão jurídica/operacional, hardening definitivo da VPS/MT5 ou definição de um gate futuro — sem liberar conta real, produção real ou dispatch automático.

---

## Fase 8 — Ambiente operacional e hardening VPS/MT5

### Fase 8.1 — Validação Operacional do Hardening VPS/MT5

**Status:** `PENDING_OPERATIONAL_VALIDATION`  
**Documento:** [`docs/VPS-MT5-HARDENING-VALIDATION.md`](VPS-MT5-HARDENING-VALIDATION.md)  
**Objetivo:** validar o ambiente operacional Windows/VPS/MetaTrader 5 onde o EA cliente e o EA Mãe rodam, com foco em tokens locais, WebRequest, AutoTrading, logs, acesso remoto e rollback.

| Item | Resultado |
|------|-----------|
| Escopo | VPS/Windows, MT5, `MQL5/Files`, WebRequest, AutoTrading, logs, operadores, rollback |
| Checklists | VPS/Windows, MT5, tokens locais, WebRequest, AutoTrading, logs — todos `PENDENTE` |
| Operadores | `A DEFINIR` — bloqueia conta real |
| Referência técnica | [`PRE-REAL-AUDIT-ENVIRONMENT-MT5-HARDENING.md`](PRE-REAL-AUDIT-ENVIRONMENT-MT5-HARDENING.md) (requisitos — Fase 7.9) |
| Código / EA / schema / env / deploy | Nenhuma alteração |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |

**Resultado da Fase 8.1:** formulário de validação operacional criado. A conferência manual na VPS/MT5 e o preenchimento de evidências permanecem pendentes.

**Próxima etapa:** executar checklist manualmente na VPS/MT5, preencher evidências, definir operadores e registrar status final (`APPROVED` ou `APPROVED_WITH_RESTRICTIONS`).

### Fase 8.2 — Preenchimento Manual do Checklist VPS/MT5

**Status:** `APPROVED_WITH_RESTRICTIONS`  
**Documento:** [`docs/VPS-MT5-HARDENING-CHECKLIST-RESULTS.md`](VPS-MT5-HARDENING-CHECKLIST-RESULTS.md)  
**Objetivo:** registrar evidências operacionais do ambiente VPS/MT5 com preenchimento manual do checklist da Fase 8.1.

| Item | Resultado |
|------|-----------|
| Ambiente | Staging — `52609973 @ XPMT5-DEMO`, API `autotrade-staging.mercadodariqueza.com.br` |
| Evidências | Homologação staging/VPS, runbook `runbook-demo-session-001`, auditoria MQL5 (7.8) |
| VPS/Windows | Maioria `PENDENTE` — sem prints de infraestrutura |
| MT5 / WebRequest / EA cliente | Predominantemente `APROVADO` |
| Operadores | `A DEFINIR` — bloqueia conta real |
| Itens reprovados | Nenhum |
| Status final | `APPROVED_WITH_RESTRICTIONS` |
| Código / EA / schema / env / deploy | Nenhuma alteração |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dispatch automático | **Desativado** |

**Resultado da Fase 8.2:** checklist preenchido com restrições. MT5 e integração staging estão evidenciados; hardening Windows/VPS completo e operadores nomeados permanecem pendentes.

**Próxima etapa:** definir operadores, coletar prints redigidos (WebRequest, `MQL5/Files`, RDP/firewall), formalizar AutoTrading e promover para `APPROVED` apenas se todos os critérios da Fase 8.1 forem atendidos.

### Fase 8.3 — Definição de Operadores, Responsabilidades e Política de AutoTrading

**Status:** `DRAFT_OPERATIONAL_POLICY`  
**Documento:** [`docs/VPS-MT5-OPERATORS-AUTOTRADING-POLICY.md`](VPS-MT5-OPERATORS-AUTOTRADING-POLICY.md)  
**Objetivo:** formalizar quem acessa VPS/MT5, quem opera EA, quem faz dispatch, quem aciona rollback e qual é a política de AutoTrading em staging/demo.

| Item | Resultado |
|------|-----------|
| Papéis operacionais | 7 papéis definidos — nomes `A DEFINIR` (bloqueia conta real) |
| Matriz de permissões | 12 ações — responsáveis `A DEFINIR` |
| Política de AutoTrading | Formalizada (ligar/desligar, DebugMode, demo vs. real) |
| Procedimentos | Antes/depois de AutoTrading + critérios de bloqueio |
| Operadores nomeados | Pendente |
| Código / EA / schema / env / deploy | Nenhuma alteração |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |

**Resultado da Fase 8.3:** política operacional criada em rascunho. AutoTrading e responsabilidades estão documentados; preenchimento de nomes e evidências de sessão permanece pendente.

**Próxima etapa:** preencher nomes na política, validar matriz de permissões, executar sessão demo com AutoTrading conforme política e anexar evidências WebRequest/MT5.

### Fase 8.4 — Pacote de Evidências Operacionais VPS/MT5

**Status:** `PENDING_EVIDENCE`  
**Documento:** [`docs/VPS-MT5-OPERATIONAL-EVIDENCE-PACK.md`](VPS-MT5-OPERATIONAL-EVIDENCE-PACK.md)  
**Objetivo:** organizar a coleta de evidências redigidas do ambiente VPS/Windows/MT5 antes de qualquer avanço de gate.

| Item | Resultado |
|------|-----------|
| Categorias | VPS/Windows, MT5, WebRequest, `MQL5/Files`, logs, operadores, sessão AutoTrading |
| Regras de redaction | Documentadas (sem tokens, secrets, senhas MT5, envs) |
| Evidências | Todas `PENDENTE` até coleta manual |
| Armazenamento | Fora do Git (cofre/pasta interna) |
| Código / EA / schema / env / deploy | Nenhuma alteração |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |

**Resultado da Fase 8.4:** pacote de evidências criado com status `PENDING_EVIDENCE`. Checklist 8.2 e política 8.3 permanecem com restrições até prints e operadores serem registrados.

**Próxima etapa:** coletar prints redigidos, preencher operadores, executar sessão demo com AutoTrading controlado e atualizar status do pacote.

### Fase 8.5 — Registro das Evidências Operacionais VPS/MT5

**Status:** `APPROVED_WITH_RESTRICTIONS`  
**Documento:** [`docs/VPS-MT5-OPERATIONAL-EVIDENCE-RESULTS.md`](VPS-MT5-OPERATIONAL-EVIDENCE-RESULTS.md)  
**Objetivo:** registrar evidências operacionais redigidas do ambiente VPS/MT5, sem commitar prints ou dados sensíveis.

| Item | Resultado |
|------|-----------|
| Redaction | Aplicada — sem tokens/secrets/senhas/envs no repo |
| Prints no Git | Nenhum |
| Evidências aprovadas (descritivas) | MT5 DEMO, EA, WebRequest staging, device procedures, logs estáticos |
| Evidências pendentes | VPS/Windows prints, operadores, Files, lista WebRequest, log arquivado, AutoTrading visual |
| Pacote 8.4 | Atualizado para `APPROVED_WITH_RESTRICTIONS` (coleta parcial) |
| Código / EA / schema / env / deploy | Nenhuma alteração |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |

**Resultado da Fase 8.5:** registro documental das evidências coletadas até o momento, com restrições explícitas. Conta real permanece bloqueada enquanto operadores e evidências críticas de infra estiverem pendentes.

**Próxima etapa:** preencher operadores, anexar prints redigidos no cofre interno, executar sessão AutoTrading controlada e reavaliar promoção do hardening.

### Fase 8.6 — Definição Nominal de Operadores e Matriz de Permissões

**Status:** `APPROVED_WITH_RESTRICTIONS`  
**Documentos:** [`docs/VPS-MT5-OPERATORS-AUTOTRADING-POLICY.md`](VPS-MT5-OPERATORS-AUTOTRADING-POLICY.md), [`docs/VPS-MT5-OPERATORS-RESPONSIBILITY-RESULTS.md`](VPS-MT5-OPERATORS-RESPONSIBILITY-RESULTS.md)  
**Objetivo:** remover bloqueio operacional de responsáveis `A DEFINIR` no ambiente VPS/MT5.

| Item | Resultado |
|------|-----------|
| Operadores | **HALLYTON** — todos os papéis |
| Matriz de permissões | 12 ações atribuídas a HALLYTON |
| Bloqueio `A DEFINIR` | Removido |
| Conta real | **Bloqueada** (gate, jurídico, limites, hardening, checklist) |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |
| Suplente operacional | Pendente |

**Resultado da Fase 8.6:** operadores e permissões definidos nominalmente. Reduz restrição operacional da Fase 8.5; **não** libera conta real.

**Próxima etapa:** suplente operacional, evidências visuais pendentes e sessão AutoTrading controlada.

### Fase 8.7 — Registro das Evidências Visuais Redigidas VPS/MT5

**Status:** `APPROVED_WITH_RESTRICTIONS`  
**Documento:** [`docs/VPS-MT5-VISUAL-EVIDENCE-REGISTER.md`](VPS-MT5-VISUAL-EVIDENCE-REGISTER.md)  
**Objetivo:** registrar evidências visuais do ambiente VPS/MT5 sem commitar prints, imagens, logs brutos ou dados sensíveis.

| Item | Resultado |
|------|-----------|
| Motivo do encerramento | Evidências visuais **dispensadas por sigilo**; validação por **declaração operacional** (HALLYTON) |
| Prints/binários no Git | Nenhum — não coletados nesta etapa |
| Logs brutos no Git | Nenhum |
| Tokens/secrets/senhas expostos | Não |
| Restrição conta real futura | Ausência de prints exige novo gate ou revisão presencial/controlada |
| Suplente operacional | A DEFINIR |
| Código / EA / schema / env / deploy | Nenhuma alteração |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |

**Resultado da Fase 8.7:** fase encerrada com `APPROVED_WITH_RESTRICTIONS`. Prints da VPS/MT5, WebRequest, `MQL5/Files`, logs e parâmetros do EA não foram coletados nem commitados por risco de informações sigilosas.

**Próxima etapa:** para conta real futura, definir gate com evidência adequada; manter staging/demo conforme runbook e política 8.3.

### Fase 8.8 — Sessão Demo com AutoTrading Controlado pela Política Operacional

**Status:** `APPROVED`  
**Documento:** [`docs/VPS-MT5-AUTOTRADING-POLICY-SESSION-RESULTS.md`](VPS-MT5-AUTOTRADING-POLICY-SESSION-RESULTS.md)  
**Objetivo:** validar na prática a política de AutoTrading (ligar/desligar conforme sessão, checklist pré/pós, dispatch manual, `DebugMode=true`).

| Item | Resultado |
|------|-----------|
| Operador | HALLYTON |
| MasterSignalId | `autotrading-policy-demo-001` |
| Conta | `52609973 @ XPMT5-DEMO` |
| Tracking | `EXECUTED` |
| AutoTrading | Controlado conforme política 8.3 |
| Evidência | Textual — sem prints no Git |
| Código / EA / schema / env / deploy | Nenhuma alteração |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |

**Resultado da Fase 8.8:** política de AutoTrading validada em sessão demo/staging com fluxo ponta a ponta documentado. Não libera conta real nem produção real.

**Próxima etapa:** definir suplente operacional; manter runbook em sessões recorrentes; gate explícito antes de qualquer conta real.

### Fase 8.9 — Relatório Final de Hardening Operacional VPS/MT5

**Status:** `VPS_MT5_HARDENING_APPROVED_WITH_RESTRICTIONS`  
**Documento:** [`docs/VPS-MT5-HARDENING-FINAL-REPORT.md`](VPS-MT5-HARDENING-FINAL-REPORT.md)  
**Objetivo:** consolidar validações operacionais VPS/MT5 (fases 8.1–8.8), sessão demo com AutoTrading controlado e restrições remanescentes.

| Item | Resultado |
|------|-----------|
| Decisão hardening | `VPS_MT5_HARDENING_APPROVED_WITH_RESTRICTIONS` |
| Decisão conta real | `REAL_ACCOUNT_NOT_APPROVED` |
| Evidência mais recente | Fase 8.8 — `autotrading-policy-demo-001`, tracking `EXECUTED` |
| Operador | HALLYTON |
| Suplente | A DEFINIR |
| Evidências visuais no Git | Nenhuma (sigilo — Fase 8.7) |
| Código / EA / schema / env / deploy | Nenhuma alteração nesta fase |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |

**Resultado da Fase 8.9:** trilha documental de hardening VPS/MT5 encerrada com aprovação **com restrições**. Autoriza continuidade demo/staging conforme runbook e política; **não** autoriza conta real nem produção real.

**Próxima etapa:** criar tag do marco de hardening; decidir entre revisão jurídica, definição de limites financeiros ou planejamento de novo gate futuro para conta real ultra-controlada.

### Fase 9.1 — Release Candidate Version Freeze

**Status:** `RC_VERSION_LOCKED_FOR_DEMO_STAGING`  
**Documento:** [`docs/RELEASE-CANDIDATE-VERSION-FREEZE.md`](RELEASE-CANDIDATE-VERSION-FREEZE.md)  
**Objetivo:** congelar a arquitetura operacional/técnica homologada em DEMO/STAGING antes de qualquer expansão futura (fases 9.2–9.5).

| Item | Resultado |
|------|-----------|
| Baseline | Fases 6.x (Real Trading Guard), 7.x (auditoria pré-real), 8.x (hardening VPS/MT5) |
| Commit de referência | `6548c75` |
| Sessões de referência | `runbook-demo-session-001`, `autotrading-policy-demo-001` — `EXECUTED` |
| Código / EA / schema / env / deploy | Nenhuma alteração nesta fase |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |
| Decisão | `REAL_ACCOUNT_NOT_APPROVED` |

**Resultado da Fase 9.1:** RC documental congelada para DEMO/STAGING. Alterações pós-freeze limitadas a correções críticas, segurança, documentação e operação demo.

**Próxima etapa:** Fase 9.2 (Branding & Institutional Readiness) ou tag formal do marco RC; manter bloqueios de conta real e dispatch automático.

### Fase 9.2 — Branding & Institutional Readiness

**Status:** `BRANDING_INSTITUTIONAL_READY_FOR_DEMO_RC`  
**Documento:** [`docs/BRANDING-INSTITUTIONAL-READINESS.md`](BRANDING-INSTITUTIONAL-READINESS.md)  
**Objetivo:** consolidar linguagem institucional, disclaimers, nomenclaturas e readiness de apresentação do RC DEMO/STAGING.

| Item | Resultado |
|------|-----------|
| Nomenclaturas e mensagens | Padronizadas |
| Disclaimers e mensagens proibidas | Definidos |
| Badges institucionais | Definidos |
| Linguagem parceiro / beta demo | Definida |
| Contratos técnicos RC | Inalterados |
| Código / EA / schema / env / deploy | Nenhuma alteração |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |
| Decisão | `REAL_ACCOUNT_NOT_APPROVED` |

**Resultado da Fase 9.2:** material-base institucional pronto para demonstrações em DEMO/STAGING. Não libera conta real nem produção real.

**Próxima etapa:** Fase 9.3 — Demo Environment Certification.

### Fase 9.3 — Demo Environment Certification

**Status:** `DEMO_ENVIRONMENT_CERTIFIED`  
**Documento:** [`docs/DEMO-ENVIRONMENT-CERTIFICATION.md`](DEMO-ENVIRONMENT-CERTIFICATION.md)  
**Objetivo:** certificar formalmente o ambiente DEMO/STAGING para demonstrações e onboarding controlado.

| Item | Resultado |
|------|-----------|
| Evidências | `real-guard-demo-smoke-002`, `runbook-demo-session-001`, `autotrading-policy-demo-001` |
| Relatórios | Real Trading Guard, auditoria pré-real, hardening VPS/MT5, RC freeze, executivo |
| Conta certificada | `52609973 @ XPMT5-DEMO` — `tradeMode=DEMO`, `DebugMode=true` |
| Contratos RC | Inalterados |
| Código / EA / schema / env / deploy | Nenhuma alteração |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |
| Decisão | `REAL_ACCOUNT_NOT_APPROVED` |

**Resultado da Fase 9.3:** ambiente DEMO/STAGING certificado documentalmente para uso institucional e beta. Não certifica conta real, produção real nem dispatch automático.

**Próxima etapa:** Fase 9.4 — Demo Client Flow.

### Fase 9.4 — Demo Client Flow

**Status:** `DEMO_CLIENT_FLOW_DEFINED_FOR_RC`  
**Documento:** [`docs/DEMO-CLIENT-FLOW.md`](DEMO-CLIENT-FLOW.md)  
**Objetivo:** definir a jornada completa do cliente beta DEMO no RC DEMO/STAGING, desde onboarding até tracking e encerramento, sem liberar conta real.

| Item | Resultado |
|------|-----------|
| Jornada | 18 etapas documentadas (orientação → encerramento) |
| Persona | Cliente Beta DEMO — `52609973 @ XPMT5-DEMO`, perfil conservador |
| Evidências | `real-guard-demo-smoke-002`, `runbook-demo-session-001`, `autotrading-policy-demo-001` |
| Contratos RC | Inalterados |
| Código / EA / schema / env / deploy | Nenhuma alteração |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |
| Decisão | `REAL_ACCOUNT_NOT_APPROVED` |

**Resultado da Fase 9.4:** fluxo institucional e operacional do cliente beta DEMO definido para uso com ambiente certificado (9.3) e branding (9.2).

**Próxima etapa:** Fase 9.5 — RC Final Report.

### Fase 9.5 — RC Final Report

**Status:** `RELEASE_CANDIDATE_DEMO_STAGING_READY`  
**Documento:** [`docs/RELEASE-CANDIDATE-FINAL-REPORT.md`](RELEASE-CANDIDATE-FINAL-REPORT.md)  
**Objetivo:** consolidar a Release Candidate DEMO/STAGING, reunindo freeze (9.1), branding (9.2), certificação demo (9.3) e fluxo do cliente beta DEMO (9.4).

| Item | Resultado |
|------|-----------|
| Status RC | `RELEASE_CANDIDATE_DEMO_STAGING_READY` |
| Trilhas base | 6.x Real Trading Guard, 7.x auditoria pré-real, 8.x hardening VPS/MT5 |
| Evidências | `real-guard-demo-smoke-002`, `runbook-demo-session-001`, `autotrading-policy-demo-001` |
| Contratos RC | Inalterados |
| Código / EA / schema / env / deploy | Nenhuma alteração |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |
| Decisão | `REAL_ACCOUNT_NOT_APPROVED` |

**Resultado da Fase 9.5:** trilha RC DEMO/STAGING (9.1–9.5) encerrada documentalmente. Ambiente pronto para demonstrações e onboarding DEMO; **não** libera conta real nem produção real.

**Próxima etapa sugerida:** Fase 10 — Preparação Institucional / Jurídica / Comercial, **sem** liberar conta real.

### Fase 10.1 — Institutional Readiness Pack

**Status:** `INSTITUTIONAL_READINESS_PACK_READY`  
**Documento:** [`docs/INSTITUTIONAL-READINESS-PACK.md`](INSTITUTIONAL-READINESS-PACK.md)  
**Objetivo:** consolidar o pacote institucional do RC DEMO/STAGING para reuniões com corretoras, parceiros, jurídico, investidores e stakeholders comerciais.

| Item | Resultado |
|------|-----------|
| Índice de documentos | RC, branding, certificação demo, fluxo cliente, executivo, parceiros, governança futura real |
| Mensagem central | RC DEMO/STAGING; bloqueios real/produção/dispatch automático |
| Materiais reunião | Ordem sugerida (8 itens) + perguntas corretora/jurídico |
| Contratos RC | Inalterados |
| Código / EA / schema / env / deploy | Nenhuma alteração |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |
| Decisão | `REAL_ACCOUNT_NOT_APPROVED` |

**Resultado da Fase 10.1:** pacote institucional indexado e pronto para uso em reuniões DEMO/STAGING. Não libera conta real nem produção real.

**Próxima etapa sugerida:** Fase 10.2 — Legal & Commercial Review Preparation.

### Fase 10.2 — Legal & Commercial Review Preparation

**Status:** `LEGAL_COMMERCIAL_REVIEW_PREPARED`  
**Documento:** [`docs/LEGAL-COMMERCIAL-REVIEW-PREPARATION.md`](LEGAL-COMMERCIAL-REVIEW-PREPARATION.md)  
**Objetivo:** preparar checklist, perguntas, documentos e disclaimers para revisão jurídica/comercial antes de qualquer discussão de conta real.

| Item | Resultado |
|------|-----------|
| Checklists | Jurídico (15), comercial (10), operacional (11) |
| Perguntas | Corretora/parceiro (11), jurídico (11) |
| Disclaimers mínimos | 9 itens recomendados |
| Riscos identificados | 9 categorias documentadas |
| Contrato final | **Não** — apenas preparação/minutas |
| Código / EA / schema / env / deploy | Nenhuma alteração |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |
| Decisão | `REAL_ACCOUNT_NOT_APPROVED` |

**Resultado da Fase 10.2:** base preparada para revisão externa (jurídico, comercial, corretora). Não libera conta real nem transforma minuta em contrato final.

**Próxima etapa sugerida:** Fase 10.3 — Beta DEMO Terms & Disclaimer Draft.

### Fase 10.3 — Beta DEMO Terms & Disclaimer Draft

**Status:** `DRAFT_FOR_LEGAL_REVIEW`  
**Documento:** [`docs/BETA-DEMO-TERMS-DISCLAIMER-DRAFT.md`](BETA-DEMO-TERMS-DISCLAIMER-DRAFT.md)  
**Objetivo:** criar minuta preliminar de termos, ciência de risco e disclaimers para participante beta DEMO, pendente de revisão jurídica.

| Item | Resultado |
|------|-----------|
| Natureza | Minuta — **não** contrato final |
| Escopo | Beta DEMO/STAGING apenas |
| Aceite participante | Template com campos A PREENCHER |
| Código / EA / schema / env / deploy | Nenhuma alteração |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |
| Decisão | `REAL_ACCOUNT_NOT_APPROVED` |

**Resultado da Fase 10.3:** minuta enviável ao jurídico. Não libera conta real nem autoriza uso com dinheiro real até aprovação formal.

**Próxima etapa sugerida:** Fase 10.4 — Institutional Presentation Deck Preparation.

### Fase 10.4 — Institutional Presentation Deck Preparation

**Status:** `INSTITUTIONAL_DECK_OUTLINE_READY`  
**Documento:** [`docs/INSTITUTIONAL-PRESENTATION-DECK-PREPARATION.md`](INSTITUTIONAL-PRESENTATION-DECK-PREPARATION.md)  
**Objetivo:** preparar o roteiro textual da apresentação institucional para corretoras, parceiros, jurídico, investidores e stakeholders comerciais, mantendo escopo DEMO/STAGING.

| Item | Resultado |
|------|-----------|
| Slides | 17 slides (roteiro textual) |
| PPTX | **Não** criado nesta fase |
| Disclaimers / mensagens proibidas | Documentados no roteiro |
| Código / EA / schema / env / deploy | Nenhuma alteração |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |
| Decisão | `REAL_ACCOUNT_NOT_APPROVED` |

**Resultado da Fase 10.4:** outline institucional pronto para conversão visual ou reunião com suporte dos docs listados no roteiro.

**Próxima etapa sugerida:** Fase 10.5 — Institutional Deck Visual Draft ou Partner Meeting Package Finalization.

### Fase 10.5 — Partner Meeting Package Finalization

**Status:** `PARTNER_MEETING_PACKAGE_READY`  
**Documento:** [`docs/PARTNER-MEETING-PACKAGE-FINALIZATION.md`](PARTNER-MEETING-PACKAGE-FINALIZATION.md)  
**Objetivo:** consolidar o pacote final de reunião institucional com corretora, parceiro, jurídico, investidor ou stakeholders comerciais, mantendo escopo DEMO/STAGING.

| Item | Resultado |
|------|-----------|
| Pacote | 10 documentos ordenados + materiais outreach/briefing |
| Pauta | 10 tópicos + agenda 45 min |
| Perguntas | Corretora (10), jurídico (11) |
| Demo permitida/proibida | Documentadas |
| PPTX | **Não** criado |
| Código / EA / schema / env / deploy | Nenhuma alteração |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |
| Decisão | `REAL_ACCOUNT_NOT_APPROVED` |

**Resultado da Fase 10.5:** pacote de reunião pronto para uso institucional. Não aprova conta real nem transforma minuta em contrato.

**Próxima etapa sugerida:** Fase 10.6 — Meeting Follow-up Template & Decision Log ou Institutional Deck Visual Draft.

### Fase 10.6 — Meeting Follow-up Template & Decision Log

**Status:** `MEETING_FOLLOW_UP_DECISION_LOG_READY`  
**Documento:** [`docs/MEETING-FOLLOW-UP-DECISION-LOG.md`](MEETING-FOLLOW-UP-DECISION-LOG.md)  
**Objetivo:** criar modelo padronizado para registrar reuniões, decisões, requisitos, riscos e próximos passos com corretoras, parceiros, jurídico, investidores ou stakeholders comerciais.

| Item | Resultado |
|------|-----------|
| Template | Identificação, resumo, pontos, tabelas, follow-up |
| Regra decisão | Não liberar real/produção/dispatch sem gate formal |
| Status do log | DRAFT … BLOCKED (8 estados) |
| Código / EA / schema / env / deploy | Nenhuma alteração |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |
| Decisão | `REAL_ACCOUNT_NOT_APPROVED` |

**Resultado da Fase 10.6:** template pronto para uso após reuniões do pacote 10.5. Não é contrato final.

**Próxima etapa sugerida:** Fase 10.7 — Institutional Deck Visual Draft ou First Partner Meeting Record.

### Fase 10.7 — Institutional Deck Visual Draft

**Status:** `INSTITUTIONAL_DECK_VISUAL_DRAFT_READY`  
**Documento:** [`docs/INSTITUTIONAL-DECK-VISUAL-DRAFT.md`](INSTITUTIONAL-DECK-VISUAL-DRAFT.md)  
**Objetivo:** definir especificação visual e narrativa slide a slide para futura apresentação institucional do Mercado da Riqueza AutoTrade.

| Item | Resultado |
|------|-----------|
| Slides especificados | 17 (visual + texto por slide) |
| Paleta / tipografia / badges | Documentados |
| PPTX | **Não** gerado nesta fase |
| Código / EA / schema / env / deploy | Nenhuma alteração |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dinheiro real | **Bloqueado** |
| Dispatch automático | **Desativado** |
| Decisão | `REAL_ACCOUNT_NOT_APPROVED` |

**Resultado da Fase 10.7:** spec visual pronta para produção de PPTX após revisão jurídica (Fase 10.8 sugerida).

**Próxima etapa sugerida:** Fase 10.8 — Institutional Deck PPTX Generation ou First Partner Meeting Record.

---

## Fase 11 — Plataforma Comercial, Assinaturas e Multi-Robô

Macrofase para comercialização no site: planos, assinatura/aluguel, liberação admin, portal do cliente, múltiplos robôs por cliente e controle por **número mágico** — inicialmente em **DEMO/STAGING**, sem conta real.

**Decisão transversal:** `REAL_ACCOUNT_NOT_APPROVED` — pagamento de plano **não** libera Real Trading Guard nem dispatch automático.

### Fase 11.1 — Commercial Plans, Subscriptions & Multi-Robot Control Architecture

**Status:** `COMMERCIAL_SUBSCRIPTION_MULTI_ROBOT_ARCHITECTURE_DEFINED`  
**Documento:** [`docs/COMMERCIAL-SUBSCRIPTION-MULTI-ROBOT-ARCHITECTURE.md`](COMMERCIAL-SUBSCRIPTION-MULTI-ROBOT-ARCHITECTURE.md)  
**Objetivo:** definir arquitetura comercial inicial para planos, assinatura, liberação de cliente, múltiplos robôs e magic number, mantendo conta real bloqueada.

| Item | Resultado |
|------|-----------|
| Fluxo comercial | Site → plano → cadastro → assinatura → admin → licença → RobotInstance → magicNumber → EA |
| Entidades | User, Plan/CommercialPlan, Subscription, License, RobotProduct, RobotInstance, MagicNumber |
| Magic number | Gerado/validado pelo backend; único por instância; colisão bloqueada |
| Planos placeholder | DEMO, Starter, Professional, Institutional |
| Schema / migration / EA / backend | **Não** alterados nesta fase |
| Conta real | **Bloqueada** |
| Produção real | **Bloqueada** |
| Dispatch automático | **Desativado** |
| Decisão | `REAL_ACCOUNT_NOT_APPROVED` |

**Resultado da Fase 11.1:** arquitetura documentada. Modelos `Plan`/`Subscription`/`License` existentes referenciados; `RobotProduct`/`RobotInstance` propostos para fases 11.3–11.4.

**Próxima etapa sugerida:** Fase 11.2 — Commercial Plan Catalog.

### Fase 11.2 — Commercial Plan Catalog & Paid Robot Subscription Rules

**Status:** `COMMERCIAL_PLAN_CATALOG_DEFINED_WITH_PRICE_AND_REAL_CONTROLS`  
**Documento:** [`docs/COMMERCIAL-PLAN-CATALOG.md`](COMMERCIAL-PLAN-CATALOG.md)  
**Objetivo:** definir catálogo comercial com R$ 300,00/robô, 1 robô inicial, até 4 futuros, caixa preta, magicNumber e controles pré-real.

| Item | Resultado |
|------|-----------|
| Preço | R$ 300,00 por robô ativo |
| Robôs iniciais | 1 por cliente |
| Robôs futuros (estrutura) | Até 4 |
| Planos | Single Robot, Multi-Robot Ready, Institutional/Custom |
| Sigilo estratégia | Caixa preta documentada |
| Controles real futuros | Margem, snapshots pré/pós pregão, ExecutorHealth |
| Schema / migration / gateway | **Não** nesta fase |
| Conta real | **Não** automática pelo pagamento |
| Dispatch automático | **Desativado** |
| Decisão | `REAL_ACCOUNT_NOT_APPROVED_AUTOMATICALLY` |

**Resultado da Fase 11.2:** catálogo e regras de preço/limite definidos. Próximo: modelagem Subscription/License (11.3).

**Próxima etapa sugerida:** Fase 11.3 — Subscription & License Data Model.

### Fase 11.3 — Subscription & License Data Model

**Status:** `SUBSCRIPTION_LICENSE_DATA_MODEL_DEFINED`  
**Documento:** [`docs/SUBSCRIPTION-LICENSE-DATA-MODEL.md`](SUBSCRIPTION-LICENSE-DATA-MODEL.md)  
**Objetivo:** definir modelo conceitual de assinatura, licença, aceite de termos, eventos comerciais e vínculo plano/cliente/licença — sem schema ou migration.

| Item | Resultado |
|------|-----------|
| Entidades | CommercialPlan, Subscription, License, TermsAcceptance, SubscriptionEvent, PaymentEvent |
| Relação | User → Subscription → Plan; Subscription → License → Device |
| Status assinatura | 7 estados comerciais (+ mapeamento Prisma existente) |
| Status licença comercial | 6 estados conceituais sobre License |
| Bloqueios | Termos, pagamento, admin, vencimento, real, auto-dispatch |
| Schema / migration | **Não** nesta fase |
| Conta real | **Não** automática |
| Dispatch automático | **Desativado** |
| Decisão | `REAL_ACCOUNT_NOT_APPROVED_AUTOMATICALLY` |

**Resultado da Fase 11.3:** modelo documentado; referencia `Plan`/`Subscription`/`License`/`Invoice`/`Payment` existentes no Prisma.

**Próxima etapa sugerida:** Fase 11.4 — RobotInstance & MagicNumber Data Model.

### Fase 11.4 — RobotInstance & MagicNumber Data Model

**Status:** `ROBOT_INSTANCE_MAGIC_NUMBER_MODEL_DEFINED`  
**Documento:** [`docs/ROBOT-INSTANCE-MAGIC-NUMBER-DATA-MODEL.md`](ROBOT-INSTANCE-MAGIC-NUMBER-DATA-MODEL.md)  
**Objetivo:** definir modelo conceitual de `RobotProduct`, `RobotInstance` e `magicNumber` para múltiplos robôs por cliente, caixa preta e rastreabilidade futura por robô — sem schema ou migration.

| Item | Resultado |
|------|-----------|
| Entidades | RobotProduct, RobotInstance, MagicNumberRegistry (opcional) |
| magicNumber | Obrigatório; faixa 910001–910999; unicidade por conta/servidor/ambiente/símbolo |
| Limite | 1 ativo inicial; até 4 futuro; `Subscription.robotQuantity` |
| Status instância | 12 estados (incl. COLLISION, EXECUTOR_OFFLINE, REAL_NOT_ALLOWED) |
| Instruction/Execution | Campos futuros `robotInstanceId` + `magicNumber` |
| EA | **Não** alterado nesta fase |
| Schema / migration | **Não** |
| Conta real / dispatch auto | **Bloqueados** |
| Decisão | `REAL_ACCOUNT_NOT_APPROVED_AUTOMATICALLY` |

**Resultado da Fase 11.4:** modelo documentado; alinhado a catálogo (11.2) e assinatura/licença (11.3).

**Próxima etapa sugerida:** Fase 11.5 — Account Snapshot & Margin Control Architecture.

### Fase 12.1 — Real Account Controlled Pilot Implementation

**Status:** `REAL_TRADING_CONTROLLED_PILOT_IMPLEMENTED_STAGING`  
**Documento:** [`docs/REAL-TRADING-CONTROLLED-PILOT-IMPLEMENTATION.md`](REAL-TRADING-CONTROLLED-PILOT-IMPLEMENTATION.md)

| Item | Resultado |
|------|-----------|
| Modelos | RealTradingApproval, AccountSnapshot, RealTradePreflight, ExecutionProtectionReport |
| Preflight | Margem, snapshot PRE_MARKET, EA online, approval, proteção anterior |
| API EA | account-snapshots, execution-protection |
| Admin UI | Aprovações, snapshots, preflights, proteção SL/TP |
| Conta real | Gate admin + env; **não** automática por pagamento |
| Dispatch automático | **Desativado** |
| Estratégia | Caixa preta preservada |

**Próxima etapa sugerida:** validação operacional do piloto em staging + evolução EA Executor.

### Fase 12.2 — Conditional Real Trading Gate Validation

**Status:** `REAL_TRADING_CONDITIONAL_GATE_VALIDATED_STAGING`  
**Restrição:** `APPROVED_WITH_RESTRICTIONS` (EA MQL5 snapshot/protection pendente — Fase 12.3)  
**Documento:** [`docs/REAL-TRADING-CONTROLLED-PILOT-STAGING-VALIDATION.md`](REAL-TRADING-CONTROLLED-PILOT-STAGING-VALIDATION.md)

| Item | Resultado |
|------|-----------|
| Gate condicional | Todos os critérios comerciais + técnicos + operacionais no preflight |
| Sucesso | `REAL_TRADING_ALLOWED_BY_CONTROLLED_GATE` |
| TermsAcceptance | Modelo + checagem obrigatória |
| Pagamento | Subscription ACTIVE + sem invoice vencida |
| REAL global | **Não** |
| Dispatch automático | **Desativado** |
| Caixa preta | Preservada |

**Próxima etapa sugerida:** Fase 12.3 — EA Executor MQL5 Snapshot & Protection Contract.

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
| [`docs/CONTROLLED-BETA-GATE.md`](CONTROLLED-BETA-GATE.md) | Gate de beta controlado (Fase 4.1) |
| [`docs/CONTROLLED-BETA-PARTICIPANT-001.md`](CONTROLLED-BETA-PARTICIPANT-001.md) | Registro do participante beta demo nº 1 (Fase 4.2) |
| [`docs/CONTROLLED-BETA-SESSION-001.md`](CONTROLLED-BETA-SESSION-001.md) | Roteiro e registro da sessão beta demo controlada nº 1 (Fase 4.3) |
| [`docs/CONTROLLED-BETA-RECURRING-SESSIONS-PLAN.md`](CONTROLLED-BETA-RECURRING-SESSIONS-PLAN.md) | Plano de sessões beta demo recorrentes (Fase 4.4) |
| [`docs/DEMO-DEBUGMODE-FALSE-GATE.md`](DEMO-DEBUGMODE-FALSE-GATE.md) | Gate para conta demo com DebugMode=false (Fase 4.5) |
| [`docs/DEMO-DEBUGMODE-FALSE-GATE-RESULTS.md`](DEMO-DEBUGMODE-FALSE-GATE-RESULTS.md) | Resultado e aprovação do gate para conta demo com DebugMode=false (Fases 4.6 e 4.7) |
| [`docs/DEMO-DEBUGMODE-FALSE-SESSION-001.md`](DEMO-DEBUGMODE-FALSE-SESSION-001.md) | Registro da Sessão Demo Controlada nº 1 com DebugMode=false (Fase 4.8) |
| [`docs/DEMO-DEBUGMODE-FALSE-FINAL-REPORT.md`](DEMO-DEBUGMODE-FALSE-FINAL-REPORT.md) | Relatório final da etapa Demo com DebugMode=false (Fase 4.9) |
| [`docs/REAL-ACCOUNT-ULTRA-CONTROLLED-GATE.md`](REAL-ACCOUNT-ULTRA-CONTROLLED-GATE.md) | Gate de Conta Real Ultra-Controlada (Fase 5.1) |
| [`docs/REAL-ACCOUNT-ACCEPTANCE-AND-LIMITS.md`](REAL-ACCOUNT-ACCEPTANCE-AND-LIMITS.md) | Termo operacional de aceite e limites para conta real ultra-controlada (Fase 5.2) |
| [`docs/REAL-ACCOUNT-INDIVIDUAL-APPROVAL-CHECKLIST.md`](REAL-ACCOUNT-INDIVIDUAL-APPROVAL-CHECKLIST.md) | Checklist individual de aprovação para conta real ultra-controlada (Fase 5.3) |
| [`docs/REAL-ACCOUNT-RISK-GATE-SUMMARY.md`](REAL-ACCOUNT-RISK-GATE-SUMMARY.md) | Relatório de consolidação do gate de conta real (Fase 5.4) |
| [`docs/REAL-ACCOUNT-LEGAL-OPERATIONAL-REVIEW-PLAN.md`](REAL-ACCOUNT-LEGAL-OPERATIONAL-REVIEW-PLAN.md) | Plano de revisão jurídica e operacional para conta real (Fase 5.5) |
| [`docs/REAL-ACCOUNT-GOVERNANCE-PACK-INDEX.md`](REAL-ACCOUNT-GOVERNANCE-PACK-INDEX.md) | Índice do pacote de governança para conta real (Fase 5.6) |
| [`docs/PROJECT-EXECUTIVE-STATUS-REPORT.md`](PROJECT-EXECUTIVE-STATUS-REPORT.md) | Relatório executivo do estado atual do projeto (Fase 5.7) |
| [`docs/AUTOTRADE-PARTNER-PRESENTATION-PACK.md`](AUTOTRADE-PARTNER-PRESENTATION-PACK.md) | Pacote de apresentação para parceiros (Fase 5.8) |
| [`docs/AUTOTRADE-PARTNER-MEETING-BRIEFING.md`](AUTOTRADE-PARTNER-MEETING-BRIEFING.md) | Roteiro de reunião com corretora, jurídico ou parceiro (Fase 5.9) |
| [`docs/AUTOTRADE-PARTNER-MEETING-INVITE.md`](AUTOTRADE-PARTNER-MEETING-INVITE.md) | Convite executivo para reunião com corretora, jurídico ou parceiro (Fase 5.10) |
| [`docs/AUTOTRADE-PARTNER-OUTREACH-MESSAGE.md`](AUTOTRADE-PARTNER-OUTREACH-MESSAGE.md) | Mensagens de abordagem para corretora, jurídico ou parceiro (Fase 5.11) |
| [`docs/REAL-TRADING-GUARD.md`](REAL-TRADING-GUARD.md) | Real Trading Guard / Kill Switch de Conta Real (Fase 6.1) |
| [`AGENTS.md`](../AGENTS.md) | Caixa preta, auditoria, halts |

---

*Mapa de obra — Fase 2.1. Próximo passo após gate da seção 15: modelagem Prisma (Fase 2.2).*
