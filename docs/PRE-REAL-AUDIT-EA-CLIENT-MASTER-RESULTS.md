# Resultado da Auditoria — EA Cliente e EA Mãe

**Data:** 2026-05-26  
**Fase:** 7.8 — Auditoria de EA Cliente e EA Mãe  
**Status:** `APPROVED_WITH_RESTRICTIONS`

---

## 1. Escopo

Esta auditoria revisou contratos operacionais e documentação dos EAs antes de qualquer discussão futura de conta real:

- EA cliente `MR_AutoTrade_Executor`.
- EA Mãe `MR_AutoTrade_Master_Signal`.
- Documentação de API, simulador, Real Trading Guard, demo controlada e auditorias anteriores.
- Contratos de payload do MasterSignal, pull de instructions e execution report.
- Segurança de inputs, logs, secrets, `DebugMode`, WebRequest e bloqueio de `REAL`.

Esta fase não liberou conta real, produção real, dinheiro real ou dispatch automático.

---

## 2. Documentos e contratos avaliados

- `docs/MASTER-EA-MQL5-V1.md`
- `docs/MASTER-EA-SIGNAL-SIMULATOR.md`
- `docs/EA-API.md`
- `docs/REAL-TRADING-GUARD-FINAL-REPORT.md`
- `docs/DEMO-DEBUGMODE-FALSE-FINAL-REPORT.md`
- `docs/PRE-REAL-TECHNICAL-AUDIT-PLAN.md`
- `docs/PRE-REAL-AUDIT-EA-APIS-RESULTS.md`
- `docs/PRE-REAL-AUDIT-ROLLBACK-RECOVERY-RESULTS.md`
- `docs/MASTER-EA-IMPLEMENTATION-PLAN.md`

Arquivos MQL5 avaliados em leitura:

- `ea/mql5/MR_AutoTrade_Executor.mq5`
- `ea/mql5/MR_AutoTrade_Master_Signal.mq5`
- `ea/mql5/includes/MR_AT_*.mqh`
- `ea/mql5/includes/MR_MS_*.mqh`

---

## 3. Parâmetros auditados

### EA cliente

| Parâmetro / item | Resultado |
|------------------|-----------|
| `InpApiBaseUrl` | Base operacional configurável; operador deve apontar para staging durante homologação. |
| `InpActivationCode` | Usado apenas na ativação; logs citam o campo, não o valor bruto. |
| `InpDeviceId` | Identifica VPS/dispositivo; validado contra token pelo backend. |
| `InpDebugMode` | Default `true`; bloqueia `OrderSend` e reporta execução simulada. |
| `InpLogLevel` | Controla logs; testes estáticos cobrem ausência de token/código bruto nos logs. |
| `trade_mode` | Enviado no heartbeat; `REAL` é bloqueado pelo backend via Real Trading Guard. |
| WebRequest | Deve liberar apenas a base esperada do ambiente. |
| Magic number | Constante `MR_AT_EA_MAGIC`; usado em fechamento de posições do próprio EA. |
| Offline/online | Fluxo por timer: heartbeat, config, pull de instructions e processing. |

### EA Mãe

| Parâmetro / item | Resultado |
|------------------|-----------|
| `InpApiBaseUrl` | Default staging. |
| `InpMasterSecret` | Secret do EA Mãe em input local; não deve ser salvo/commitado. |
| `InpSendOnInit` | Default `false`, envio automático desligado. |
| `InpSendOnce` | Default `true`, trava reenvio após sucesso/idempotência. |
| `InpMasterSignalId` | Informado ou gerado automaticamente. |
| `InpSymbol`, `InpSide`, `InpOrderType`, `InpPurpose`, `InpProfile` | Compõem payload permitido de MasterSignal. |
| `InpExpiresSeconds` | Default `300`; limites MQL e API: 5–300 segundos. |

---

## 4. Segurança

Controles confirmados:

- EA cliente não possui inputs estratégicos de indicadores, horários, filtros, trailing ou parâmetros de setup.
- EA Mãe não contém `OrderSend` e não opera mercado.
- `DebugMode=true` no EA cliente bloqueia envio de ordem e reporta `FILLED` com ticket `DEBUG`.
- `DebugMode=false` foi validado apenas em conta DEMO controlada; não autoriza conta real.
- `tradeMode=REAL` permanece bloqueado pelo backend default-deny.
- EA Mãe redige `Authorization: Bearer ***REDACTED***` nos logs.
- Simulador HTTP redige o secret em dry-run.
- O backend não faz dispatch automático após `POST /api/master/signals`.
- `expires_in_seconds` é limitado a 300 pela API e pelo EA Mãe.

Restrições observadas:

- O EA cliente armazena `device_token` em arquivo comum local do MT5 para autenticação operacional. Isso é esperado para o modelo atual, mas exige proteção da VPS, usuário Windows e diretório `MQL5/Files`.
- Esta fase não recompilou nem executou os EAs no MetaTrader; a revisão MQL5 foi estática e documental.

---

## 5. Fluxos avaliados

### EA cliente

- Ativação: `POST /api/v1/ea/activate` com `activation_code`.
- Config: `GET /api/v1/ea/config`.
- Heartbeat: `POST /api/v1/ea/heartbeat` com `trade_mode`, equity, saldo e posições.
- Pull: `GET /api/v1/ea/instructions`.
- Parse de instruction: campos de execução apenas, sem estratégia.
- Execução: `OrderSend` somente quando `DebugMode=false` e flags do servidor permitem.
- Report: `POST /api/v1/ea/executions` com `FILLED`, `PARTIAL`, `REJECTED` ou `EXPIRED`.
- Retry: `SENT` sem execution permanece entregável; execution terminal é idempotente no backend.

### EA Mãe

- Envio manual por botão para `POST /api/master/signals`.
- Payload: `master_signal_id`, `source`, `symbol`, `side`, `order_type`, `purpose`, `profile`, `expires_in_seconds`, `idempotency_key`.
- Auth: `Authorization: Bearer <MASTER_EA_API_SECRET>`.
- Respostas esperadas: `201`, `200 idempotent`, `400`, `401`, `409`, `503`.
- Dispatch para clientes permanece manual no painel admin.

---

## 6. Testes executados

Foi criado o teste estático:

- `tests/ea/mql-contracts.test.ts`

Cobertura nova:

- EA cliente mantém apenas inputs operacionais permitidos.
- EA cliente não expõe campos estratégicos no struct de instruction.
- EA cliente não loga token/activation code bruto.
- `DebugMode` bloqueia `OrderSend` e reporta execução simulada.
- Pull de instructions usa contrato `/api/v1/ea/instructions`.
- EA Mãe mantém `InpSendOnInit=false`, `InpSendOnce=true` e TTL máximo 300.
- Payload MasterSignal não contém estratégia nem `OrderSend`.
- Authorization do EA Mãe é redigido em logs e não aparece no painel.

Resultado do teste focado:

```text
tests/ea/mql-contracts.test.ts
tests/master-signals/validation.test.ts
tests/master-signals/simulator.test.ts
tests/ea/executions.test.ts
tests/ea/api-protections.test.ts
55 tests passed
```

---

## 7. Achados

Achados críticos: nenhum.

Achados relevantes:

- Os arquivos MQL5 existem no repositório e foram auditados estaticamente.
- EA cliente e EA Mãe respeitam a separação de papéis: executor licenciado versus emissor manual de MasterSignal.
- EA Mãe não possui estratégia nem envio de ordem ao broker.
- O contrato EA cliente permanece sem campo de estratégia.
- O armazenamento local do `device_token` pelo EA cliente é uma restrição operacional, não um vazamento em log/backend, mas exige hardening da VPS.
- A revisão desta fase não substitui recompilação e smoke manual no MetaTrader.

---

## 8. Correções aplicadas

Não houve alteração em EA cliente ou EA Mãe.

Foi adicionada cobertura de contrato:

- `tests/ea/mql-contracts.test.ts`

---

## 9. Pendências

Pendências críticas: nenhuma.

Pendências/restrições para fase futura:

- Recompilar os EAs no MetaEditor e registrar versão/hash antes de qualquer novo gate operacional.
- Executar smoke manual controlado em staging com EA cliente em `DebugMode=true`.
- Revisar hardening da VPS/Windows/MT5 porque o `device_token` fica em arquivo comum local do terminal.
- Validar manualmente WebRequest apontando apenas para o domínio do ambiente usado.
- Se for necessária alteração MQL5 futura, abrir fase separada específica para EA, com compile e evidência visual.

---

## 10. Decisão final

**Status:** `APPROVED_WITH_RESTRICTIONS`

A etapa de auditoria dos contratos operacionais do EA cliente e do EA Mãe foi aprovada com restrições para o contexto staging/demo.

Esta decisão:

- Não libera conta real.
- Não libera produção real.
- Não libera dinheiro real.
- Não ativa dispatch automático.
- Não altera envs.
- Não altera EA cliente ou EA Mãe.
- Não substitui validação manual no MetaTrader.

---

*Mercado da Riqueza AutoTrade — auditoria dos contratos EA aprovada com restrições para staging/demo. Conta real, produção real, dinheiro real e dispatch automático permanecem bloqueados.*
