# API REST — Integração EA (MetaTrader 5)

Base: `/api/v1/ea`  
Autenticação (exceto ativação): `Authorization: Bearer <device_token>`

Headers recomendados:

| Header | Descrição |
|--------|-----------|
| `X-Request-Id` | Correlação / auditoria |
| `X-Device-Id` | ID do dispositivo (deve coincidir com o token) |
| `X-EA-Version` | Versão do EA |

Respostas de sucesso: `Content-Type: application/json`  
Erros: `application/problem+json` (RFC 7807)

---

## POST `/activate`

Ativação inicial (sem Bearer). Body:

```json
{
  "activation_code": "XXXX-XXXX",
  "device_id": "vps-001",
  "fingerprint": "opcional",
  "ea_version": "1.0.0"
}
```

Resposta: `device_token`, `license_id`, `config`.

---

## GET `/config`

Configuração operacional mínima (sem parâmetros de estratégia):

- `halt_new_entries`, `halt_all_trading`
- `can_accept_new_entries`, `can_manage_open_positions`
- `heartbeat_interval_sec`, `min_ea_version`
- `exposure_profile` (rótulo comercial)
- `mt5_account` autorizada
- `autonomous_strategy_enabled`, `autonomous_strategy_capabilities` (sem parâmetros internos da estratégia)

---

## POST `/autonomous-strategy/preflight`

Autorização server-side antes de entrada gerada localmente pelo EA (estratégia caixa preta).

Body: `strategy_code`, `license_id`, `device_id`, conta MT5, `symbol`, `trade_mode`, `magic_number`, `side`, `order_type`, `requested_contracts`, `planned_management_plan`, `signal_reason`.

Resposta `allowed: true`: `strategy_execution_id`, `instruction_id`, `approved_management_plan`, `daily_financial_stop`.

Resposta `allowed: false`: `reason_code`, `detail`.

Requer `ENABLE_AUTONOMOUS_STRATEGY=true` e estratégia habilitada na licença.

---

## POST `/daily-risk/report`

Atualiza PnL diário para stop financeiro (sem expor lógica ao cliente).

Body: `license_id`, `device_id`, conta, `symbol`, `trade_date`, `realized_pnl`, `open_pnl`.

---

## POST `/heartbeat`

Registra: status EA, equity/saldo/margem, ordens pendentes, posições abertas.

```json
{
  "login": "12345",
  "server": "Broker-Server",
  "trade_mode": "REAL",
  "ea_status": "ONLINE",
  "equity": 100000,
  "balance": 100000,
  "pending_orders": [],
  "open_positions": []
}
```

Valida: token, licença utilizável, **conta MT5 autorizada**.

Não exige assinatura ativa (telemetria e gestão de posição).

---

## GET `/instructions`

Pull de instruções. Query opcional: `login`, `server`.

Com assinatura inativa: retorna `subscription_active: false` e ainda pode entregar instruções `EXIT` / `ADJUSTMENT`.

Payload de instrução (somente execução):

```json
{
  "instruction_id": "uuid",
  "purpose": "ENTRY",
  "symbol": "PETR4",
  "side": "BUY",
  "order_type": "MARKET",
  "order_price": 5650.5,
  "quantity": 100,
  "stop_loss": 28.5,
  "take_profit": 30.0,
  "expires_at": "2026-05-20T18:00:00.000Z",
  "idempotency_key": "uuid",
  "magic_number": 910001,
  "account_login": "12345",
  "account_server": "Broker-Server",
  "requires_protection_confirmation": true
}
```

Campos `magic_number`, `account_login`, `account_server`, `trade_mode`, `protection_required`, `requires_protection_confirmation`, `requested_contracts`, `source`, `operational_mode` e `bulk_batch_id` são usados no **piloto de conta real** (gate condicional aprovado no servidor). O EA Executor **deve** enviar snapshots e confirmar stop/take via `/execution-protection` — sem isso o preflight REAL bloqueia novas entradas.

- `operational_mode`: sempre `LIVE_MARKET` em dispatches admin REAL_MANUAL (Fase 14.2).
- `bulk_batch_id`: presente quando instruction originada de disparo em lote.

Regras `order_type` / `order_price` / proteção na instruction:

- `MARKET`: `order_price` ausente.
- `LIMIT` e `STOP`: `order_price` obrigatorio.
- `stop_loss_price` e `take_profit_price` obrigatorios para `REAL_MANUAL`.
- `management_plan` (opcional legado ausente; **obrigatorio** em novos dispatches REAL_MANUAL admin) contem SL inicial, takes T1/T2, breakeven e trailing stop.
- O EA nao deve converter `LIMIT/STOP` para mercado como fallback.
- O EA nao deve executar sem SL/TP validos na instruction.

Exemplo de instrução REAL (sem estratégia):

```json
{
  "instruction_id": "uuid",
  "purpose": "ENTRY",
  "symbol": "WDOM26",
  "side": "BUY",
  "order_type": "MARKET",
  "order_price": 5650.5,
  "quantity": 1,
  "stop_loss": 128000,
  "take_profit": 129000,
  "expires_at": "2026-05-27T18:00:00.000Z",
  "idempotency_key": "uuid",
  "magic_number": 910001,
  "account_login": "12345",
  "account_server": "Broker-Server",
  "trade_mode": "REAL",
  "requires_protection_confirmation": true,
  "protection_required": true,
  "requested_contracts": 1,
  "controlled_real_gate": true,
  "source": "REAL_MANUAL",
  "operational_mode": "LIVE_MARKET",
  "bulk_batch_id": "uuid-do-batch"
}
```

Para primeira ordem real manual e disparo em lote, a origem é `REAL_MANUAL` com `operational_mode: LIVE_MARKET` (nunca TEST/HOMOLOGATION).

---

## POST `/account-snapshots`

Registra snapshot operacional da conta MT5 (telemetria para preflight REAL — **não** expõe estratégia).

### Payload

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `snapshot_type` | enum | `PRE_MARKET` \| `PRE_TRADE` \| `POST_MARKET` \| `MANUAL` |
| `account_login` | string | Login MT5 |
| `account_server` | string | Servidor MT5 |
| `environment` | enum | `DEMO` \| `REAL` |
| `currency` | string? | Moeda da conta |
| `balance` | number | Saldo |
| `equity` | number | Equity |
| `margin` | number? | Margem usada |
| `free_margin` | number? | Margem livre |
| `margin_level` | number? | Nível de margem (%) |
| `open_positions` | array? | Posições abertas (agregado) |
| `pending_orders` | array? | Ordens pendentes |
| `active_magic_numbers` | number[]? | Magics ativos na conta |
| `captured_at` | datetime? | ISO 8601 UTC |

### Exemplo

```json
{
  "snapshot_type": "PRE_MARKET",
  "account_login": "12345",
  "account_server": "Broker-Server",
  "environment": "REAL",
  "currency": "BRL",
  "balance": 100000,
  "equity": 100000,
  "margin": 20000,
  "free_margin": 80000,
  "margin_level": 500,
  "open_positions": [],
  "pending_orders": [],
  "active_magic_numbers": [910001],
  "captured_at": "2026-05-27T10:00:00Z"
}
```

### Regras

| `snapshot_type` | Regra |
|-----------------|--------|
| `PRE_MARKET` | **Obrigatório** no dia (UTC) antes de qualquer operação REAL |
| `PRE_TRADE` | **Recomendado** imediatamente antes de cada entrada REAL |
| `POST_MARKET` | **Obrigatório** ao fim do pregão (rotina EA ou manual) |
| `MANUAL` | Snapshot sob demanda (auditoria) |

- Conta deve estar **autorizada** na licença (`assertMt5AccountAuthorized`).
- **Não** registrar tokens, senhas ou `Authorization` em logs de aplicação.

---

## POST `/execution-protection`

Confirma que stop e take foram posicionados após execução REAL.

### Payload

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `instruction_id` | string | Instrução correlacionada |
| `execution_id` | string? | Execução (se conhecida) |
| `account_login` | string | Login MT5 |
| `account_server` | string | Servidor |
| `symbol` | string | Ativo |
| `magic_number` | int | Magic da instância robô |
| `entry_order_ticket` | string? | Ticket da entrada |
| `entry_deal_ticket` | string? | Deal da entrada |
| `stop_loss_present` | bool | SL confirmado |
| `take_profit_present` | bool | TP confirmado |
| `stop_loss_price` | number? | Preço SL |
| `take_profit_price` | number? | Preço TP |
| `stop_order_ticket` | string? | Ticket ordem SL pendente |
| `take_order_ticket` | string? | Ticket ordem TP pendente |
| `protection_mode` | enum | `ATTACHED_SL_TP` \| `PENDING_PROTECTION_ORDERS` \| `UNKNOWN` |
| `protection_status` | enum | `PROTECTION_CONFIRMED` \| `PROTECTION_FAILED` \| `PROTECTION_PENDING` \| `NOT_REQUIRED_FOR_DEBUG` |
| `error_code` | string? | Código broker/EA |
| `error_message` | string? | Mensagem redigida no servidor |
| `reported_at` | datetime? | ISO 8601 UTC |

### Exemplo confirmado

```json
{
  "instruction_id": "uuid",
  "account_login": "12345",
  "account_server": "Broker-Server",
  "symbol": "WDOM26",
  "magic_number": 910001,
  "stop_loss_present": true,
  "take_profit_present": true,
  "stop_loss_price": 128000,
  "take_profit_price": 129000,
  "protection_mode": "ATTACHED_SL_TP",
  "protection_status": "PROTECTION_CONFIRMED",
  "reported_at": "2026-05-27T10:05:00Z"
}
```

### Regras

- Em **REAL**, `stop_loss_present=true` e `take_profit_present=true` são **obrigatórios** para `PROTECTION_CONFIRMED`.
- Se SL/TP falharem: `protection_status=PROTECTION_FAILED` + `error_code` / `error_message`.
- Em `PROTECTION_FAILED`, o EA **não** deve enviar novas ordens para o mesmo `magic_number`; a plataforma marca `protectionBlocked` e bloqueia preflight.
- Modo `PENDING_PROTECTION_ORDERS`: informar `stop_order_ticket` e `take_order_ticket` quando SL/TP forem ordens separadas.
- Debug homologação: `NOT_REQUIRED_FOR_DEBUG` apenas com `InpDebugMode=true` (sem ordem real).

---

## POST `/executions`

Reporta resultado: `FILLED`, `PARTIAL`, `REJECTED`, `EXPIRED` (não use `EXECUTED` — o status da instrução no servidor vira `EXECUTED` após `FILLED`/`PARTIAL`).

Body mínimo (exemplo DebugMode):

```json
{
  "instruction_id": "uuid",
  "status": "FILLED",
  "broker_ticket": "DEBUG",
  "fill_price": 28.5,
  "fill_quantity": 100,
  "executed_at": "2026-05-20T18:30:00Z"
}
```

`executed_at` deve ser ISO 8601 UTC (`...Z`). O EA envia esse formato; a API também aceita legado MT5 `2026.05.20 18:30:00`.

Atualiza trilha: `RECEIVED` → `SENT` → `EXECUTED` | `REJECTED`.

---

## POST `/instructions/ignore`

Marca instrução como `IGNORED`.

---

## POST `/errors`

Registra erro técnico do broker/EA (sem vazar estratégia).

---

## Regras operacionais

| Situação | Novas entradas | Gestão posição aberta |
|----------|----------------|------------------------|
| Licença + assinatura ativas | Sim | Sim |
| Assinatura vencida / em atraso | Não | Sim |
| `halt_all_trading` | Não | Não |
| Licença revogada | Não | Não |

EA offline: sem heartbeat há mais de **120s** (`EA_OFFLINE_THRESHOLD_SEC`).

---

## Rate limiting

Rotas protegidas por janela fixa (`lib/ea/rate-limit.ts`). Ao exceder o limite: **HTTP 429** com `application/problem+json` (`RATE_LIMIT_EXCEEDED`), headers `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`.

| Escopo | Rota | Chave |
|--------|------|-------|
| `activate` | `POST /activate` | IP |
| `heartbeat` | `POST /heartbeat` | IP + `X-Device-Id` |
| `instructions` | `GET /instructions` | IP + device |
| `errors` | `POST /errors` | IP + device |
| `config` | `GET /config` | IP + device |
| `executions` | `POST /executions` | IP + device |
| `ignore` | `POST /instructions/ignore` | IP + device |

Limites padrão por hora (exceto activate: 10 / 15 min). Override opcional: `EA_RATE_LIMIT_<SCOPE>_MAX` (ex.: `EA_RATE_LIMIT_CONFIG_MAX`).

**MVP:** contadores em memória por processo Node. Em **produção com várias instâncias** (Vercel/serverless, múltiplos pods), migrar o store para **Redis / KV / Upstash** com as mesmas chaves antes de escalar.

Bloqueios em rotas autenticadas geram `audit_logs` (`ea.rate_limit_exceeded`) com `license_id` quando o Bearer é válido.

---

## Auditoria

Eventos em `audit_logs`: `ea.heartbeat`, `ea.instructions_pulled`, `ea.execution_reported`, `ea.error_reported`, `ea.positions_closed`, etc.

---

## Testes

```bash
npm test
```

Cenários em `tests/ea/`: licença ativa/vencida, EA offline, sinal, ordem rejeitada/ignorada, posição aberta/encerrada.
