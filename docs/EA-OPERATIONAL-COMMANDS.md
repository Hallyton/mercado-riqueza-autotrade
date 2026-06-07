# EA Operational Commands

Contrato entre plataforma e EA Executor para comandos operacionais remotos (não são sinais de entrada).

## Poll de comandos

`GET /api/v1/ea/commands`

Resposta:

```json
{
  "ok": true,
  "commands": [
    {
      "command_id": "…",
      "command_type": "PAUSE_NEW_ENTRIES",
      "requested_at": "…",
      "expires_at": "…",
      "payload": {}
    }
  ]
}
```

## ACK

`POST /api/v1/ea/commands/{commandId}/ack`

```json
{
  "status": "ACKED",
  "ea_time": "2026-06-06T12:00:00",
  "message": "Comando recebido"
}
```

## Resultado

`POST /api/v1/ea/commands/{commandId}/result`

Sucesso:

```json
{
  "status": "EXECUTED",
  "result_code": "OK",
  "result_message": "Ordens pendentes canceladas",
  "details": { "cancelled_orders": 2 }
}
```

Falha:

```json
{
  "status": "FAILED",
  "result_code": "NO_OPEN_POSITION",
  "result_message": "Nenhuma posição aberta encontrada"
}
```

## Snapshot operacional

`POST /api/v1/ea/operation-snapshot`

Payload inclui posição, pendentes, PnL dia/mês, flags de terminal/autotrading/pausa admin.

## Config — pausa persistente

`GET /api/v1/ea/config` retorna:

```json
{
  "operation_control": {
    "paused": true,
    "reason": "Pausado via centro de operações",
    "strategy_code": "MR_FIBO_D1_GUARD"
  }
}
```

## HEALTH_CHECK (Fase 15.6)

Comando de **prova de vida** — não envia ordem, não cria instruction, não altera approval/config.

Admin: `POST /api/admin/real-trading/operations/commands` com `commandType: "HEALTH_CHECK"`.

EA executa:

1. ACK imediato
2. `POST /api/v1/ea/heartbeat` (se disponível)
3. `POST /api/v1/ea/operation-snapshot` (forçado)
4. `POST /api/v1/ea/daily-risk/report` (forçado)
5. RESULT com `result_code: "HEALTH_CHECK_OK"` ou `HEALTH_CHECK_FAILED`

Expira em **60s**. Duplicata `PENDING`/`ACKED` retorna comando existente.

Ver [`docs/EA-LIVENESS-AND-HEALTH-CHECK.md`](EA-LIVENESS-AND-HEALTH-CHECK.md).

## MQL5

Módulo: `ea/mql5/includes/MR_AT_OperationalCommands.mqh`

- `MR_AT_PollOperationalCommands()` no `OnTimer` (intervalo 15s)
- `MR_AT_SendOperationSnapshot()` (intervalo 30s)
- Handler `HEALTH_CHECK` separado de `REFRESH_STATUS`
- Flag `g_admin_paused` restaurada via config
- `InpDebugMode=true` simula cancel/close sem `OrderSend` real

## Regras de execução

| Comando | Posição aberta | Pendentes | Novas entradas |
|---------|----------------|-----------|----------------|
| PAUSE | Mantém gestão | Mantém | Bloqueia |
| CANCEL_PENDING | Mantém | Cancela | — |
| CLOSE_OPEN_POSITION | Fecha | Mantém* | — |
| FLATTEN_AND_PAUSE | Fecha | Cancela | Pausa |

*Salvo regra interna da estratégia.
