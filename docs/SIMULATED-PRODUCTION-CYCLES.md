# Registro de Ciclos — Produção Simulada Controlada

Documento da **Fase 3.2** para registrar os ciclos simulados executados em staging antes de qualquer discussão sobre produção real.

**Produção real:** não liberada.  
**Ordem real:** não liberada.  
**Dispatch automático:** proibido.  
**EA cliente:** obrigatoriamente `DebugMode=true`.

---

## Objetivo

Registrar, de forma rastreável, os ciclos simulados da produção simulada controlada definidos em [`SIMULATED-PRODUCTION-OPERATING-PLAN.md`](SIMULATED-PRODUCTION-OPERATING-PLAN.md).

Cada ciclo deve comprovar que o fluxo permanece seguro:

```text
EA Mãe / simulador
  → POST /api/master/signals (intake)
  → painel VALIDATED / NOT_DISPATCHED
  → admin revisa elegibilidade
  → admin dispara manualmente
  → Instruction MASTER_SIGNAL
  → EA cliente DebugMode=true
  → execution report
  → tracking
```

---

## Regras absolutas

- Produção real não liberada.
- Ordem real não liberada.
- EA cliente obrigatoriamente `DebugMode=true`.
- Dispatch automático proibido.
- Disparo somente manual pelo admin.
- Cada ciclo precisa ter evidência mínima.
- Falhas devem ser registradas, não escondidas.
- Secrets não podem aparecer neste documento, em prints, logs ou commits.

---

## 1. Status geral da Fase 3

| Indicador | Status |
|-----------|--------|
| Status da Fase 3 | **EM EXECUÇÃO** |
| Ciclos mínimos exigidos | 10 |
| Ciclos aprovados | 4/10 |
| Ciclos reprovados | 0 |
| Ciclos com restrição | 0 |
| Ordem real enviada | **NÃO** |
| Dispatch automático detectado | **NÃO** |
| Secrets expostos | **NÃO** |
| Rollback testado | **PENDENTE** |

---

## 2. Critérios para cada ciclo ser aprovado

Um ciclo só pode ser marcado como `APROVADO` se todos os itens aplicáveis forem verdadeiros:

- EA cliente estava em `DebugMode=true`.
- EA Mãe ou simulador enviou `MasterSignal`.
- `MasterSignal` apareceu no painel como `VALIDATED` / `NOT_DISPATCHED`.
- Admin revisou elegibilidade.
- Admin disparou manualmente.
- `Instruction` `MASTER_SIGNAL` foi criada.
- EA cliente recebeu instruction.
- Nenhuma ordem real foi enviada.
- Execution report foi recebido.
- Tracking mostrou `EXECUTED` ou o status esperado para o cenário.
- Retry/idempotência não duplicou instruction, quando aplicável.
- Evidências foram registradas.

---

## 3. Tabela principal dos 10 ciclos

| Ciclo | Data | Tipo de sinal | MasterSignalId | InstructionId | LicenseId | Side | Perfil | Resultado intake | Resultado dispatch | Resultado EA | Tracking | DebugMode | Ordem real | Status final | Observações |
|-------|------|---------------|----------------|---------------|-----------|------|--------|------------------|--------------------|--------------|----------|-----------|------------|--------------|-------------|
| 01 | 2026-05-25 | BUY válido via EA Mãe MQL5 | `cycle-01-buy-mt5-001` | `cmpl82wy8000yjp046r7w8c65` | `cmpj3wby70005sx18ot5e939p` | BUY | conservador | `VALIDATED` / `NOT_DISPATCHED` antes do disparo | Admin manual; `Instruction MASTER_SIGNAL` criada | DebugMode; execution report HTTP 200 | `EXECUTED` | true | NÃO | APROVADO | Fluxo completo validado sem ordem real |
| 02 | 2026-05-25 | SELL válido via EA Mãe MQL5 | `cycle-02-sell-mt5-001` | Ver painel/banco — tracking `EXECUTED` confirmado | `cmpj3wby70005sx18ot5e939p` | SELL | conservador | `VALIDATED` / `NOT_DISPATCHED` antes do disparo | Admin manual; dispatch `INSTRUCTION_CREATED`; `Instruction MASTER_SIGNAL` criada | DebugMode; execution report recebido | `EXECUTED` | true | NÃO | APROVADO | Fluxo SELL completo validado sem ordem real |
| 03 | 2026-05-25 | BUY válido via simulador HTTP | `cycle-03-buy-sim-001` | Ver painel/banco — tracking `EXECUTED` confirmado | `cmpj3wby70005sx18ot5e939p` | BUY | conservador | `VALIDATED` / `NOT_DISPATCHED`; POST sem dispatch automático | Admin manual; dispatch `INSTRUCTION_CREATED`; `Instruction MASTER_SIGNAL` criada | DebugMode; execution report recebido | `EXECUTED` | true | NÃO | APROVADO | Fluxo BUY via simulador validado sem ordem real |
| 04 | 2026-05-25 | Retry/idempotência do mesmo MasterSignal | `cycle-03-buy-sim-001` | Ver ciclo 03 — nenhuma nova instruction criada | `cmpj3wby70005sx18ot5e939p` | BUY | conservador | Retry idempotente do mesmo sinal | Sem novo dispatch indevido; contagem 1 → 1 | Sem execução duplicada; contagem 1 → 1 | `EXECUTED` | true | NÃO | APROVADO | Reenvio com mesma idempotency_key não duplicou dispatch/instruction/execution |
| 05 | PENDENTE | Disparo admin repetido sem duplicar instruction | PENDENTE | PENDENTE | PENDENTE | PENDENTE | conservador | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | NÃO | PENDENTE | PENDENTE |
| 06 | PENDENTE | Sinal expirado bloqueado | PENDENTE | N/A | PENDENTE | PENDENTE | conservador | PENDENTE | BLOQUEADO_ESPERADO | N/A | PENDENTE | PENDENTE | NÃO | PENDENTE | PENDENTE |
| 07 | PENDENTE | EA cliente offline antes do dispatch | PENDENTE | PENDENTE | PENDENTE | PENDENTE | conservador | PENDENTE | PENDENTE | OFFLINE_ESPERADO | PENDENTE | PENDENTE | NÃO | PENDENTE | PENDENTE |
| 08 | PENDENTE | EA cliente volta online e processa pendência | PENDENTE | PENDENTE | PENDENTE | PENDENTE | conservador | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | NÃO | PENDENTE | PENDENTE |
| 09 | PENDENTE | Sem licença elegível / profile mismatch controlado | PENDENTE | N/A | PENDENTE | PENDENTE | controlado | PENDENTE | SEM_ELEGÍVEL_ESPERADO | N/A | PENDENTE | PENDENTE | NÃO | PENDENTE | PENDENTE |
| 10 | PENDENTE | Rollback operacional testado | PENDENTE | PENDENTE | PENDENTE | PENDENTE | conservador | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | NÃO | PENDENTE | PENDENTE |

Status final permitido por ciclo:

- `PENDENTE`
- `APROVADO`
- `APROVADO_COM_RESTRIÇÃO`
- `REPROVADO`

---

## 4. Cenários planejados

| Ciclo | Cenário |
|-------|---------|
| 01 | BUY válido via EA Mãe MQL5 |
| 02 | SELL válido via EA Mãe MQL5 |
| 03 | BUY válido via simulador HTTP |
| 04 | Retry/idempotência do mesmo MasterSignal |
| 05 | Disparo admin repetido sem duplicar instruction |
| 06 | Sinal expirado bloqueado |
| 07 | EA cliente offline antes do dispatch |
| 08 | EA cliente volta online e processa pendência |
| 09 | Sem licença elegível / profile mismatch controlado |
| 10 | Rollback operacional testado |

---

## 5. Template detalhado por ciclo

### Ciclo 01 — BUY válido via EA Mãe MQL5

| Campo | Valor |
|-------|-------|
| Status | APROVADO |
| Data/hora | 2026-05-25 |
| Responsável | Operação Mercado da Riqueza / homologação assistida |
| Ambiente | `https://autotrade-staging.mercadodariqueza.com.br` |
| MasterSignalId | `cycle-01-buy-mt5-001` |
| InstructionId | `cmpl82wy8000yjp046r7w8c65` |
| LicenseId | `cmpj3wby70005sx18ot5e939p` |
| MT5 | `52609973 @ XPMT5-DEMO` |
| EA cliente DebugMode | `true` |
| EA Mãe / Simulador | EA Mãe MQL5 |
| Payload resumido | `WDOM26` / `BUY` / `MARKET` / `ENTRY` / `conservador` |
| Resultado intake | MasterSignal criado pelo EA Mãe MQL5; apareceu no painel como `VALIDATED` / `NOT_DISPATCHED` antes do disparo |
| Resultado preview | Admin revisou elegibilidade antes do disparo manual |
| Resultado dispatch | Admin disparou manualmente; `Instruction MASTER_SIGNAL` criada |
| Resultado EA cliente | GET `/instructions` HTTP 200; instruções parseadas: 1; instruction recebida; `DEBUG_MODE`; nenhuma ordem real; POST `/api/v1/ea/executions` HTTP 200 |
| Resultado tracking | Painel tracking confirmou `EXECUTED`; Dispatches: 1; Instructions: 1; Execuções: 1 |
| Idempotência | Não aplicável neste ciclo |
| TTL/expiração | Dentro da janela operacional do ciclo |
| Ordem real enviada | NÃO |
| Secrets expostos | NÃO |
| Evidências | MasterSignal `cycle-01-buy-mt5-001`; Instruction `cmpl82wy8000yjp046r7w8c65`; License `cmpj3wby70005sx18ot5e939p`; tracking `EXECUTED` |
| Observações | O ciclo validou o fluxo EA Mãe → intake → admin dispatch manual → Instruction MASTER_SIGNAL → EA cliente DebugMode → execution report → tracking EXECUTED |
| Decisão | APROVADO |

### Ciclo 02 — SELL válido via EA Mãe MQL5

| Campo | Valor |
|-------|-------|
| Status | APROVADO |
| Data/hora | 2026-05-25 |
| Responsável | Operação Mercado da Riqueza / homologação assistida |
| Ambiente | `https://autotrade-staging.mercadodariqueza.com.br` |
| MasterSignalId | `cycle-02-sell-mt5-001` |
| InstructionId | Ver painel/banco — tracking `EXECUTED` confirmado |
| LicenseId | `cmpj3wby70005sx18ot5e939p` |
| MT5 | `52609973 @ XPMT5-DEMO` |
| EA cliente DebugMode | `true` |
| EA Mãe / Simulador | EA Mãe MQL5 |
| Payload resumido | `WDOM26` / `SELL` / `MARKET` / `ENTRY` / `conservador` |
| Resultado intake | MasterSignal criado pelo EA Mãe MQL5; apareceu no painel como `VALIDATED` / `NOT_DISPATCHED` antes do disparo |
| Resultado preview | Admin revisou elegibilidade antes do disparo manual |
| Resultado dispatch | Admin disparou manualmente; dispatch criado com status `INSTRUCTION_CREATED`; instruction criada com `source: MASTER_SIGNAL` |
| Resultado EA cliente | EA cliente processou a instruction em `DebugMode=true`; nenhuma ordem real enviada; execution report recebido pela API |
| Resultado tracking | Painel tracking confirmou `EXECUTED`; Elegíveis: 1; Ignorados: 0; Instructions: 1; Executadas: 1; Pendentes: 0; Falhas: 0; Dispatch: `INSTRUCTION_CREATED`; Instruction: `EXECUTED`; Execution: `EXECUTED`; Source: `MASTER_SIGNAL`; Qtd: 1; MT5: `52609973 @ XPMT5-DEMO` |
| Idempotência | N/A |
| TTL/expiração | Dentro da janela operacional do ciclo |
| Ordem real enviada | NÃO |
| Secrets expostos | NÃO |
| Evidências | MasterSignal `cycle-02-sell-mt5-001`; License `cmpj3wby70005sx18ot5e939p`; tracking `EXECUTED`; InstructionId não visível nas evidências fornecidas |
| Observações | O ciclo validou o fluxo SELL via EA Mãe: EA Mãe → intake → admin dispatch manual → Instruction MASTER_SIGNAL → EA cliente DebugMode → execution report → tracking EXECUTED |
| Decisão | APROVADO |

### Ciclo 03 — BUY válido via simulador HTTP

| Campo | Valor |
|-------|-------|
| Status | APROVADO |
| Data/hora | 2026-05-25 |
| Responsável | Operação Mercado da Riqueza / homologação assistida |
| Ambiente | `https://autotrade-staging.mercadodariqueza.com.br` |
| MasterSignalId | `cycle-03-buy-sim-001` |
| InstructionId | Ver painel/banco — tracking `EXECUTED` confirmado |
| LicenseId | `cmpj3wby70005sx18ot5e939p` |
| MT5 | `52609973 @ XPMT5-DEMO` |
| EA cliente DebugMode | `true` |
| EA Mãe / Simulador | Simulador HTTP |
| Payload resumido | `WDOM26` / `BUY` / `MARKET` / `ENTRY` / `conservador` |
| Resultado intake | MasterSignal criado pelo simulador HTTP/CLI (`npm run master:signal`); apareceu no painel como `VALIDATED` / `NOT_DISPATCHED` antes do disparo; `POST /api/master/signals` continuou sem dispatch automático |
| Resultado preview | Admin revisou elegibilidade antes do disparo manual |
| Resultado dispatch | Admin disparou manualmente; dispatch criado com status `INSTRUCTION_CREATED`; instruction criada com `source: MASTER_SIGNAL` |
| Resultado EA cliente | EA cliente processou a instruction em `DebugMode=true`; nenhuma ordem real enviada; execution report recebido pela API |
| Resultado tracking | Painel tracking confirmou `EXECUTED`; Elegíveis: 1; Ignorados: 0; Instructions: 1; Executadas: 1; Pendentes: 0; Falhas: 0; Dispatch: `INSTRUCTION_CREATED`; Instruction: `EXECUTED`; Execution: `EXECUTED`; Source: `MASTER_SIGNAL`; Qtd: 1; MT5: `52609973 @ XPMT5-DEMO`; Motivo: Execução reportada pelo EA |
| Idempotência | N/A |
| TTL/expiração | Dentro da janela operacional do ciclo |
| Ordem real enviada | NÃO |
| Secrets expostos | NÃO |
| Evidências | MasterSignal `cycle-03-buy-sim-001`; License `cmpj3wby70005sx18ot5e939p`; tracking `EXECUTED`; InstructionId não visível nas evidências fornecidas |
| Observações | O ciclo validou o fluxo BUY via simulador HTTP: Simulador HTTP → intake → admin dispatch manual → Instruction MASTER_SIGNAL → EA cliente DebugMode → execution report → tracking EXECUTED |
| Decisão | APROVADO |

### Ciclo 04 — Retry/idempotência do mesmo MasterSignal

| Campo | Valor |
|-------|-------|
| Status | APROVADO |
| Data/hora | 2026-05-25 |
| Responsável | Operação Mercado da Riqueza / homologação assistida |
| Ambiente | `https://autotrade-staging.mercadodariqueza.com.br` |
| MasterSignalId | `cycle-03-buy-sim-001` |
| InstructionId | Ver ciclo 03 — nenhuma nova instruction criada |
| LicenseId | `cmpj3wby70005sx18ot5e939p` |
| MT5 | `52609973 @ XPMT5-DEMO` |
| EA cliente DebugMode | `true` |
| EA Mãe / Simulador | Simulador HTTP |
| Payload resumido | Mesmo `master_signal_id` `cycle-03-buy-sim-001` e mesma `idempotency_key` `cycle-03-buy-sim-001-key` |
| Resultado intake | Mesmo sinal reenviado via simulador HTTP/CLI; API tratou como retry/idempotente |
| Resultado preview | N/A — ciclo focado em retry/idempotência do sinal já registrado |
| Resultado dispatch | Nenhum novo dispatch indevido; Dispatches antes/depois: 1 / 1 |
| Resultado EA cliente | Nenhuma execução duplicada; Execuções antes/depois: 1 / 1 |
| Resultado tracking | Status consolidado permaneceu `EXECUTED`; Instructions antes/depois: 1 / 1 |
| Idempotência | APROVADA — mesmo `master_signal_id`/`idempotency_key` não criou nova instruction nem execution |
| TTL/expiração | N/A |
| Ordem real enviada | NÃO |
| Secrets expostos | NÃO |
| Evidências | MasterSignal `cycle-03-buy-sim-001`; idempotency_key `cycle-03-buy-sim-001-key`; Dispatches 1/1; Instructions 1/1; Execuções 1/1; tracking `EXECUTED` |
| Observações | O ciclo validou a idempotência do intake/retry do MasterSignal. Reenviar o mesmo `master_signal_id` com a mesma `idempotency_key` não duplicou instruction nem execution. O fluxo permaneceu rastreável no painel. |
| Decisão | APROVADO |

### Ciclo 05 — Disparo admin repetido sem duplicar instruction

| Campo | Valor |
|-------|-------|
| Status | PENDENTE |
| Data/hora | PENDENTE |
| Responsável | PENDENTE |
| Ambiente | `https://autotrade-staging.mercadodariqueza.com.br` |
| MasterSignalId | PENDENTE |
| InstructionId | PENDENTE |
| LicenseId | PENDENTE |
| MT5 | `52609973 @ XPMT5-DEMO` |
| EA cliente DebugMode | PENDENTE |
| EA Mãe / Simulador | EA Mãe MQL5 ou simulador HTTP |
| Payload resumido | Sinal elegível já disparado uma vez |
| Resultado intake | PENDENTE |
| Resultado preview | PENDENTE |
| Resultado dispatch | PENDENTE |
| Resultado EA cliente | PENDENTE |
| Resultado tracking | PENDENTE |
| Idempotência | PENDENTE |
| TTL/expiração | PENDENTE |
| Ordem real enviada | NÃO |
| Secrets expostos | NÃO |
| Evidências | PENDENTE |
| Observações | PENDENTE |
| Decisão | PENDENTE |

### Ciclo 06 — Sinal expirado bloqueado

| Campo | Valor |
|-------|-------|
| Status | PENDENTE |
| Data/hora | PENDENTE |
| Responsável | PENDENTE |
| Ambiente | `https://autotrade-staging.mercadodariqueza.com.br` |
| MasterSignalId | PENDENTE |
| InstructionId | N/A |
| LicenseId | PENDENTE |
| MT5 | `52609973 @ XPMT5-DEMO` |
| EA cliente DebugMode | PENDENTE |
| EA Mãe / Simulador | EA Mãe MQL5 ou simulador HTTP |
| Payload resumido | TTL curto; disparo após expiração |
| Resultado intake | PENDENTE |
| Resultado preview | PENDENTE |
| Resultado dispatch | BLOQUEADO_ESPERADO |
| Resultado EA cliente | N/A |
| Resultado tracking | PENDENTE |
| Idempotência | N/A |
| TTL/expiração | PENDENTE |
| Ordem real enviada | NÃO |
| Secrets expostos | NÃO |
| Evidências | PENDENTE |
| Observações | PENDENTE |
| Decisão | PENDENTE |

### Ciclo 07 — EA cliente offline antes do dispatch

| Campo | Valor |
|-------|-------|
| Status | PENDENTE |
| Data/hora | PENDENTE |
| Responsável | PENDENTE |
| Ambiente | `https://autotrade-staging.mercadodariqueza.com.br` |
| MasterSignalId | PENDENTE |
| InstructionId | PENDENTE |
| LicenseId | PENDENTE |
| MT5 | `52609973 @ XPMT5-DEMO` |
| EA cliente DebugMode | PENDENTE |
| EA Mãe / Simulador | EA Mãe MQL5 ou simulador HTTP |
| Payload resumido | Sinal válido com EA cliente offline |
| Resultado intake | PENDENTE |
| Resultado preview | PENDENTE |
| Resultado dispatch | PENDENTE |
| Resultado EA cliente | OFFLINE_ESPERADO |
| Resultado tracking | PENDENTE |
| Idempotência | N/A |
| TTL/expiração | PENDENTE |
| Ordem real enviada | NÃO |
| Secrets expostos | NÃO |
| Evidências | PENDENTE |
| Observações | PENDENTE |
| Decisão | PENDENTE |

### Ciclo 08 — EA cliente volta online e processa pendência

| Campo | Valor |
|-------|-------|
| Status | PENDENTE |
| Data/hora | PENDENTE |
| Responsável | PENDENTE |
| Ambiente | `https://autotrade-staging.mercadodariqueza.com.br` |
| MasterSignalId | PENDENTE |
| InstructionId | PENDENTE |
| LicenseId | PENDENTE |
| MT5 | `52609973 @ XPMT5-DEMO` |
| EA cliente DebugMode | PENDENTE |
| EA Mãe / Simulador | Continuação do ciclo offline/pendente |
| Payload resumido | Instruction pendente processada após reconexão |
| Resultado intake | PENDENTE |
| Resultado preview | PENDENTE |
| Resultado dispatch | PENDENTE |
| Resultado EA cliente | PENDENTE |
| Resultado tracking | PENDENTE |
| Idempotência | N/A |
| TTL/expiração | PENDENTE |
| Ordem real enviada | NÃO |
| Secrets expostos | NÃO |
| Evidências | PENDENTE |
| Observações | PENDENTE |
| Decisão | PENDENTE |

### Ciclo 09 — Sem licença elegível / profile mismatch controlado

| Campo | Valor |
|-------|-------|
| Status | PENDENTE |
| Data/hora | PENDENTE |
| Responsável | PENDENTE |
| Ambiente | `https://autotrade-staging.mercadodariqueza.com.br` |
| MasterSignalId | PENDENTE |
| InstructionId | N/A |
| LicenseId | PENDENTE |
| MT5 | `52609973 @ XPMT5-DEMO` |
| EA cliente DebugMode | PENDENTE |
| EA Mãe / Simulador | Simulador HTTP ou EA Mãe com perfil controlado |
| Payload resumido | Profile mismatch controlado |
| Resultado intake | PENDENTE |
| Resultado preview | PENDENTE |
| Resultado dispatch | SEM_ELEGÍVEL_ESPERADO |
| Resultado EA cliente | N/A |
| Resultado tracking | PENDENTE |
| Idempotência | N/A |
| TTL/expiração | PENDENTE |
| Ordem real enviada | NÃO |
| Secrets expostos | NÃO |
| Evidências | PENDENTE |
| Observações | PENDENTE |
| Decisão | PENDENTE |

### Ciclo 10 — Rollback operacional testado

| Campo | Valor |
|-------|-------|
| Status | PENDENTE |
| Data/hora | PENDENTE |
| Responsável | PENDENTE |
| Ambiente | `https://autotrade-staging.mercadodariqueza.com.br` |
| MasterSignalId | PENDENTE |
| InstructionId | PENDENTE |
| LicenseId | PENDENTE |
| MT5 | `52609973 @ XPMT5-DEMO` |
| EA cliente DebugMode | PENDENTE |
| EA Mãe / Simulador | EA Mãe MQL5 ou simulador HTTP |
| Payload resumido | Sinal/control flow usado para acionar rollback operacional |
| Resultado intake | PENDENTE |
| Resultado preview | PENDENTE |
| Resultado dispatch | PENDENTE |
| Resultado EA cliente | PENDENTE |
| Resultado tracking | PENDENTE |
| Idempotência | N/A |
| TTL/expiração | PENDENTE |
| Ordem real enviada | NÃO |
| Secrets expostos | NÃO |
| Evidências | PENDENTE |
| Observações | PENDENTE |
| Decisão | PENDENTE |

---

## 6. Critérios de reprovação imediata

Qualquer ciclo é `REPROVADO` imediatamente se ocorrer:

- EA cliente com `DebugMode=false`.
- Ordem real enviada.
- Dispatch automático no `POST /api/master/signals`.
- Admin sem permissão disparando.
- Instruction com `source` null.
- Retry duplicando instruction indevidamente.
- Secret em log, print, commit ou chat.
- Banco local usado por engano.
- Domínio errado usado.
- Tracking não registra o fluxo.

Falhas devem ser preservadas no registro, com evidências e decisão de correção. Não remover ou reescrever uma falha para simular aprovação.

---

## 7. Resultado final da Fase 3

| Campo | Valor |
|-------|-------|
| Status final da Fase 3 | **PENDENTE** |
| Ciclos aprovados | 4/10 |
| Ciclos reprovados | 0 |
| Ciclos com restrição | 0 |
| Decisão final | PENDENTE |

Opções futuras:

- `APPROVED_FOR_CONTROLLED_BETA`
- `APPROVED_WITH_RESTRICTIONS`
- `REJECTED`

Mesmo se a Fase 3 for aprovada futuramente, produção real ainda exigirá nova fase, novo gate e aprovação explícita.

---

## Referências

| Documento | Uso |
|-----------|-----|
| [`SIMULATED-PRODUCTION-OPERATING-PLAN.md`](SIMULATED-PRODUCTION-OPERATING-PLAN.md) | Plano operacional da Fase 3.1 |
| [`SIMULATED-PRODUCTION-GATE.md`](SIMULATED-PRODUCTION-GATE.md) | Gate de produção simulada |
| [`SIMULATED-PRODUCTION-GATE-RESULTS.md`](SIMULATED-PRODUCTION-GATE-RESULTS.md) | Gate aprovado |
| [`MASTER-EA-IMPLEMENTATION-PLAN.md`](MASTER-EA-IMPLEMENTATION-PLAN.md) | Plano principal de fases |
| [`MASTER-EA-MQL5-V1.md`](MASTER-EA-MQL5-V1.md) | EA Mãe emissor manual |

---

*Mercado da Riqueza AutoTrade — registro operacional dos ciclos simulados. Produção real permanece fora de escopo.*
