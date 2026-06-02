# First Real Instruction Manual Dispatch

**Status:** `REAL_MANUAL_DISPATCH_SL_TP_FIELDS_IMPLEMENTED`  
**Branch:** `staging-vps-homologacao`

## Objetivo

Criar a primeira instruction REAL controlada **sem usar fila TEST/HOMOLOGATION**, exigindo:

- preflight `DRY_RUN` recente e `PASSED`;
- `RealTradingApproval` APPROVED;
- PRE_MARKET REAL do dia;
- EA online + device ACTIVE em tradeMode REAL;
- protection obrigatoria.

## Fluxo

1. Rodar dry-run em `/admin/real-trading/preflights`.
2. Selecionar preflight PASSED recente.
3. Preencher lado + tipo de ordem.
4. Confirmar: `AUTORIZO PRIMEIRA ORDEM REAL`.
5. Criar instruction com source `REAL_MANUAL`.

> Dry-run PASSED nao envia ordem. A criacao da instruction apenas coloca na fila para `GET /api/v1/ea/instructions`.

## Regras de origem

- `TEST` e `HOMOLOGATION`: exclusivas para testes/homologacao; bloqueadas para device REAL.
- `REAL_MANUAL`: unica origem permitida para primeira ordem real manual.
- `MASTER_SIGNAL`: fluxo futuro, sempre sujeito ao gate e preflight.

## Tipo de ordem e preco de apregoamento

- `MARKET`: sem preco de apregoamento.
- `LIMIT`: exige `orderPrice`.
- `STOP`: exige `orderPrice`.

Para ordens MARKET, nao ha preco de apregoamento. Para ordens LIMIT ou STOP, o administrador deve informar obrigatoriamente o preco ao qual a ordem sera apregoada. O EA Executor deve respeitar o tipo de ordem e nao converter ordens pendentes em execucao a mercado.

## Stop Loss e Take Profit obrigatórios

Toda instruction REAL_MANUAL deve carregar Stop Loss e Take Profit explícitos. O EA Executor não deve executar ordem real sem receber SL/TP válidos. Para ordens LIMIT ou STOP, além de SL/TP, o preço de apregoamento também é obrigatório.

Campos no admin:

- `stopLossPrice` — obrigatório
- `takeProfitPrice` — obrigatório

Persistidos em `Instruction.stopLoss` e `Instruction.takeProfit`, entregues ao EA como `stop_loss_price` e `take_profit_price` (e `stop_loss` / `take_profit` para compatibilidade).

## UI — dois blocos em /admin/real-trading/preflights

1. **Preflight dry-run** — apenas validação de gate (sem tipo de ordem/SL/TP).
2. **Criar instruction REAL manual** — liberado somente com dry-run PASSED recente (15 min).

## Encerramento sem ordem apregoada

Quando o EA recebe/processa uma `REAL_MANUAL`, mas a ordem nao e aceita/apregoada pelo broker/bolsa e nao ha posicao aberta, a tentativa deve ser encerrada como `ORDER_NOT_PLACED` / execucao `REJECTED`. Protection nao deve ficar pendente nem failed; deve ser marcada como `SKIPPED_NO_POSITION` ou `NOT_APPLICABLE`. Uma nova tentativa exige novo preflight `PASSED`.

## Encerramento por atestacao operacional

Quando o sistema nao consegue inferir automaticamente a ausencia de ordem/posicao, mas o operador verifica no MT5 que nao ha ordem pendente, posicao aberta ou exposicao de risco, o admin pode encerrar a `REAL_MANUAL` como `ORDER_NOT_PLACED` mediante atestacao manual (checkboxes obrigatorios), confirmacao textual e audit log.

- API: `POST /api/admin/real-trading/instructions/[instructionId]/close-no-order`
- UI: `/admin/real-trading/instructions/[instructionId]` — acao **Encerrar sem ordem apregoada**
- Confirmacao: `ENCERRAR INSTRUCTION SEM ORDEM APREGOADA`
- Reason code: `ORDER_NOT_PLACED_EXCHANGE_REJECTED`
- Audit: `real_trading.instruction.close_no_order`

## Anulacao por falso positivo de execucao

Quando o sistema recebe retorno de execucao preenchida, mas o operador confirma no MT5 que a ordem nao foi apregoada, nao ha ordem pendente, nao ha posicao aberta e nao ha exposicao de risco, a instruction deve ser anulada como falso positivo de execucao. O registro nao deve ser apagado fisicamente; deve ser encerrado com audit log e reasonCode `BROKER_EXECUTION_FALSE_POSITIVE`. Nova tentativa exige novo preflight `PASSED`.

- API: `POST /api/admin/real-trading/instructions/[instructionId]/void-false-execution`
- UI: `/admin/real-trading/instructions/[instructionId]` — acao **Anular falso positivo de execucao**
- Confirmacao: `ANULAR FALSO POSITIVO DE EXECUCAO`
- Instruction status: `VOIDED_FALSE_EXECUTION`
- Execution status: `VOIDED`
- Protection status: `SKIPPED_NO_POSITION` (nao `PROTECTION_FAILED` nem `PROTECTION_CONFIRMED`)
- Audit: `real_trading.instruction.void_false_execution`

## Plano de gestao avancado (REAL_MANUAL)

Toda instruction REAL_MANUAL deve incluir `managementPlan` validado server-side com:

- **SL inicial** obrigatorio (`initialStopLoss`)
- **Take 1 / Take 2** parciais (quantidade compativel com `requestedContracts`)
- **Breakeven (BE)** opcional (`TAKE1_FILLED`, `PRICE_REACHED`, `MANUAL_DISABLED`)
- **Trailing Stop (TS)** opcional (`triggerPrice`, `distance`, `step`)

Limitacao: com **1 contrato**, nao e possivel T1+T2 simultaneos (quantity 1 cada).

Compatibilidade EA:

- `stop_loss_price` recebe `initialStopLoss`
- `take_profit_price` recebe preco do Take 1 ativo (ou principal)
- Payload completo em `management_plan` (snake_case)

Eventos de gestao reportados pelo EA via `POST /api/v1/ea/management-events` (`TAKE1_ORDER_PLACED`, `BREAKEVEN_MOVED`, `TRAILING_MOVED`, etc.).

Nova tentativa apos encerramento/anulacao exige novo preflight `PASSED`.

Documento dedicado: [`docs/REAL-MANUAL-ADVANCED-PROTECTION-PLAN.md`](REAL-MANUAL-ADVANCED-PROTECTION-PLAN.md)

## Seguranca operacional

- `requestedContracts` maximo 1 nesta fase.
- `protectionRequired=true` e `requiresProtectionConfirmation=true`.
- `PROTECTION_FAILED` bloqueia novas ordens do mesmo magic.
- dispatch automatico permanece desativado.
- nenhum token/secret/activation code e exposto.
