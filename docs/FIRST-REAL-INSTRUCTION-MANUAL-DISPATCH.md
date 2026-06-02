# First Real Instruction Manual Dispatch

**Status:** `FIRST_REAL_MANUAL_DISPATCH_FLOW_IMPLEMENTED_WITH_ORDER_TYPE`  
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

## Seguranca operacional

- `requestedContracts` maximo 1 nesta fase.
- `protectionRequired=true` e `requiresProtectionConfirmation=true`.
- `PROTECTION_FAILED` bloqueia novas ordens do mesmo magic.
- dispatch automatico permanece desativado.
- nenhum token/secret/activation code e exposto.
