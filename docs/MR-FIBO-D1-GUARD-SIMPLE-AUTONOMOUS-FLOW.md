# MR Fibo D1 Guard — Simple Autonomous Flow (v2)

**Status:** `MR_FIBO_D1_GUARD_SIMPLIFIED_AUTONOMOUS_OPERATION_IMPLEMENTED`

## Arquitetura simplificada

| Camada | Responsabilidade |
|--------|------------------|
| **Site** | Config publicada, elegibilidade, `can-trade`, stop financeiro diário, auditoria |
| **EA Executor** | Licença, heartbeat, config, guard, reportes — **sem** REAL_MANUAL/instruction para Fibo |
| **MR_Strategy_FiboD1_Guard** | Lógica completa do `EA_FIBO_D1_DOLAR_B3.mq5`: entradas limit, parciais, BE, TS, reversão, zeragem |

## Fluxo

1. Admin publica config em `/admin/licenses/[id]/strategy-config` ou monitora em `/admin/real-trading/fibo-d1-guard`.
2. EA busca `GET /api/v1/ea/config` → `strategy_config_*`.
3. A cada tick/timer, estratégia roda internamente.
4. **Antes** de nova entrada ou reversão: `POST /api/v1/ea/autonomous-strategy/can-trade`.
5. Se `allowed=true` → estratégia envia ordem e gerencia posição.
6. Se `allowed=false` → log + decisão auditada, sem ordem.

## Endpoint can-trade

- **Não** cria instruction.
- **Não** despacha REAL_MANUAL.
- Retorna `allowed`, `decision`, `reason_code`, `detail`.

## Centro operacional

`/admin/real-trading/fibo-d1-guard` — prontos, EA não pronto, bloqueados, decisões recentes.

## Limite operacional vs contratos

`MaxContracts` vem da aprovação REAL — **não** é editável na strategy-config. Se `loteTotal` exceder o limite, publicação bloqueada (`LOT_TOTAL_EXCEEDS_MAX_CONTRACTS`); rascunho pode ser salvo. Regularizar via aprovação REAL ou reduzir contratos na config.

## Caixa preta

Cliente não vê parâmetros. Admin vê contratos, stop, takes, horários.

## Preflight legado

`POST /api/v1/ea/autonomous-strategy/preflight` permanece para compatibilidade; fluxo v2 usa **can-trade**.
