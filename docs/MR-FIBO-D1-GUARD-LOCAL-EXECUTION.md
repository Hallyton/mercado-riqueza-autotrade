# MR Fibo D1 Guard - Local OnTick Execution

**Status:** `MR_FIBO_D1_GUARD_LOCAL_ON_TICK_EXECUTION_IMPLEMENTED`

## Objetivo

A Fase 15.7 move a execucao operacional da `MR_FIBO_D1_GUARD` para dentro do `MR_AutoTrade_Executor.mq5`.

O site valida apenas se a licenca esta ativa para o `tradeDate` atual. Depois dessa autorizacao diaria, a estrategia roda localmente no MetaTrader:

- entradas;
- classificacao MARKET/LIMIT/STOP;
- stop inicial;
- Take 1 e Take 2 por ordens limit;
- breakeven apos Take 1;
- trailing apos Take 2;
- reversao quando habilitada;
- zeragem no fim do dia;
- stop financeiro diario local.

## Responsabilidades

| Camada | Responsabilidade na Fase 15.7 |
| --- | --- |
| Site | Ativacao do device, validacao diaria de licenca, heartbeat e telemetria opcional |
| EA Executor | Inputs locais, autorizacao diaria, OnTick local, painel, snapshots opcionais |
| Core Fibo D1 | Niveis D1, ordens, posicao, parciais, BE, trailing, zeragem e risco local |

## Licenca diaria

Estado local:

```cpp
bool     g_license_authorized_today = false;
string   g_authorized_trade_date = "";
datetime g_license_valid_until = 0;
```

Regras:

- se `g_authorized_trade_date` for igual ao `tradeDate` atual, o EA nao consulta novamente para abrir entradas;
- se o `tradeDate` mudar, a autorizacao local e invalidada;
- se o EA reiniciar no mesmo dia, ele tenta recuperar a autorizacao local persistida ou consultar o site;
- se a API cair depois da autorizacao, o EA pode continuar ate o fim do mesmo `tradeDate` quando `InpAllowContinueIfApiFailsAfterAuthorization=true`;
- sem autorizacao diaria valida, novas entradas ficam bloqueadas;
- gestao de posicao aberta continua local.

## OnTick

O `OnTick()` do executor chama a estrategia local quando `InpStrategyCode="MR_FIBO_D1_GUARD"`.

O `OnTick()` nao executa HTTP. Ele processa apenas estado local:

- tick atual por `SymbolInfoTick`/Bid/Ask;
- mudanca de dia;
- preparacao dos niveis;
- horario operacional;
- stop financeiro diario local;
- pendentes de entrada;
- posicao aberta;
- Take 1/Take 2 limit;
- breakeven;
- trailing;
- zeragem;
- painel e linhas.

## Classificacao dinamica de entrada

Tolerancia:

```cpp
double tolerancia = tick_size * InpToleranciaEntradaTicks;
```

Compra usa `Ask`:

| Condicao | Ordem |
| --- | --- |
| `abs(askAtual - nivelCompra) <= tolerancia` | `ORDER_TYPE_BUY` |
| `askAtual > nivelCompra` | `ORDER_TYPE_BUY_LIMIT` |
| `askAtual < nivelCompra` | `ORDER_TYPE_BUY_STOP` |

Venda usa `Bid`:

| Condicao | Ordem |
| --- | --- |
| `abs(bidAtual - nivelVenda) <= tolerancia` | `ORDER_TYPE_SELL` |
| `bidAtual < nivelVenda` | `ORDER_TYPE_SELL_LIMIT` |
| `bidAtual > nivelVenda` | `ORDER_TYPE_SELL_STOP` |

O EA nao converte ordem rejeitada para mercado quando o preco esta longe do nivel. Em rejeicao, ele registra retcode/descricao, limpa o estado da ponta e reclassifica em tick futuro respeitando cooldown e limite de tentativas.

## Timer

No modo Fibo local, `OnTimer()` fica fora da decisao de preco. Ele pode:

- renovar/recuperar ativacao;
- validar licenca diaria;
- enviar heartbeat;
- enviar DailyRisk/snapshot informacional;
- atualizar painel.

Ele nao puxa sinais, nao processa REAL_MANUAL, nao chama `can-trade`, nao executa gestao por tempo e nao decide entrada.

## Stop financeiro diario local

O PnL diario e calculado pelo historico do MT5 filtrado por:

- simbolo;
- `InpMagicNumber`;
- inicio do `tradeDate`.

Quando habilitado e o PnL atinge `-InpLimitePerdaDiariaReais`, o EA pode bloquear novas entradas, cancelar pendentes e fechar posicao conforme os inputs locais.

## Teste no Strategy Tester

1. Compilar `ea/mql5/MR_AutoTrade_Executor.mq5`.
2. Rodar em WDO/WIN ou contrato B3 disponivel no broker.
3. Conferir no diario:
   - `Licenca diaria autorizada`;
   - `CALCULO D1 AUDITORIA`;
   - tipo de entrada `BUY_LIMIT`, `BUY_STOP`, `SELL_LIMIT`, `SELL_STOP` ou market perto do nivel;
   - `ORDEM LIMIT TAKE 1/2 ENVIADA`;
   - BE apos Take 1;
   - trailing apos Take 2;
   - zeragem no horario configurado.
4. Confirmar que nao ha `can-trade` por ordem e que nao ha HTTP no `OnTick`.
