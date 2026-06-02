# REAL_MANUAL — Plano de gestao avancado

Plano operacional enviado ao EA Executor junto com a ordem REAL_MANUAL. Nao expoe logica estrategica ao cliente.

## Campos do plano (`managementPlan`)

```json
{
  "version": 1,
  "initialStopLoss": 4999.0,
  "takes": [
    { "label": "T1", "enabled": true, "price": 5001.0, "quantity": 1 },
    { "label": "T2", "enabled": false, "price": null, "quantity": 0 }
  ],
  "breakEven": {
    "enabled": true,
    "trigger": "TAKE1_FILLED",
    "triggerPrice": null,
    "offset": 0.0
  },
  "trailingStop": {
    "enabled": true,
    "triggerPrice": 5002.0,
    "distance": 1.0,
    "step": 0.5
  }
}
```

## Regras

- **SL inicial** obrigatorio em toda ordem real.
- **Take 1 / Take 2**: soma das quantidades ativas nao pode exceder `requestedContracts`.
- Com **1 contrato**: apenas um take ativo com `quantity=1` (nao T1+T2 simultaneos).
- **BE** opcional; `PRICE_REACHED` exige `triggerPrice`.
- **TS** opcional; exige `triggerPrice`, `distance` e `step`.
- **LIMIT/STOP** nunca convertidos para MARKET; rejeicao do broker nao gera fallback.

## Payload EA (`GET /api/v1/ea/instructions`)

- `stop_loss_price` = `initialStopLoss`
- `take_profit_price` = Take 1 ativo (compatibilidade)
- `management_plan` = plano completo em snake_case

## Eventos esperados

Reportados via `POST /api/v1/ea/management-events`:

- `ENTRY_ORDER_PLACED`, `ENTRY_FILLED`, `PENDING_ORDER_PLACED`
- `TAKE1_ORDER_PLACED`, `TAKE2_ORDER_PLACED`, `TAKE1_FILLED`, `TAKE2_FILLED`
- `BREAKEVEN_ARMED`, `BREAKEVEN_MOVED`, `BREAKEVEN_FAILED`
- `TRAILING_ARMED`, `TRAILING_MOVED`, `TRAILING_FAILED`
- `MANAGEMENT_PLAN_FAILED`, `TAKE_ORDER_REJECTED`, `ORDER_REJECTED`

## Encerramento e nova tentativa

- Encerramento sem ordem: `close-no-order` (`ORDER_NOT_PLACED_EXCHANGE_REJECTED`)
- Falso positivo de execucao: `void-false-execution` (`BROKER_EXECUTION_FALSE_POSITIVE`)
- Nova tentativa REAL_MANUAL exige novo preflight DRY_RUN **PASSED** (15 min)

## UI admin

- Criacao: `/admin/real-trading/preflights` — painel **Gestao da operacao**
- Monitoramento: `/admin/real-trading/instructions` e detalhe com secao **Plano de gestao**
