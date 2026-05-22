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
  "quantity": 100,
  "stop_loss": 28.5,
  "take_profit": 30.0,
  "expires_at": "2026-05-20T18:00:00.000Z",
  "idempotency_key": "uuid"
}
```

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
