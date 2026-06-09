# MR Fibo D1 Guard - Simple Autonomous Flow

**Status:** `MR_FIBO_D1_GUARD_SIMPLE_LOCAL_AUTONOMOUS_FLOW_IMPLEMENTED`

## Fase 15.7 - fluxo autonomo local

Na Fase 15.7, o fluxo simplificado deixa de depender de `can-trade` por ordem.

O site valida a licenca uma vez por `tradeDate`. Depois da autorizacao diaria, a estrategia fica totalmente local no `MR_AutoTrade_Executor.mq5`.

## Fluxo atual

1. EA carrega credenciais locais ou ativa o device.
2. EA aplica inputs locais da Fibo D1.
3. EA consulta `GET /api/v1/ea/config` apenas para confirmar `license_status=ACTIVE` no `tradeDate`.
4. `OnTick()` calcula/recupera niveis D1, arma entradas e gerencia posicao.
5. `OnTimer()` envia apenas infraestrutura: heartbeat, snapshot, DailyRisk informacional e nova tentativa de licenca diaria quando necessario.

## O que saiu do caminho critico

Nao participa da decisao de entrada:

- `POST /api/v1/ea/autonomous-strategy/can-trade`;
- preflight remoto;
- DailyRisk remoto;
- heartbeat;
- snapshot;
- config hash;
- strategy config remota;
- RealTradingApproval;
- maxContracts do site;
- health check;
- posicao remota no site;
- comandos remotos;
- instruction/REAL_MANUAL;
- EA Mestre.

## Execucao local

O EA decide localmente:

- horario operacional;
- compra e venda por dia;
- tipo de ordem de entrada;
- stop inicial;
- parciais limit;
- breakeven;
- trailing stop;
- reversao quando habilitada;
- zeragem;
- stop financeiro diario local.

## Ponta contraria

Quando uma entrada executa, a pendente oposta pode ser cancelada por `InpCancelarPontaOpostaAposEntrada=true`.

Se a ponta oposta ainda nao operou no dia, ela pode ser rearmada depois que a posicao atual for encerrada e o horario operacional ainda estiver valido. O EA preserva as flags `operouCompraHoje` e `operouVendaHoje`, entao a ponta ja executada nao e rearmada no mesmo dia.

## Documentos relacionados

- [`MR-FIBO-D1-GUARD-LOCAL-EXECUTION.md`](MR-FIBO-D1-GUARD-LOCAL-EXECUTION.md)
- [`EA-API.md`](EA-API.md)
- [`MASTER-EA-IMPLEMENTATION-PLAN.md`](MASTER-EA-IMPLEMENTATION-PLAN.md)
