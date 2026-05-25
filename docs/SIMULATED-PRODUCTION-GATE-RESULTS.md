# Gate de Produção Simulada — Resultado

**Status final:** `APPROVED_FOR_SIMULATED_PRODUCTION`

Este documento registra a execução oficial da **Fase 2.12** em staging. A aprovação é limitada à produção simulada: **produção real não está liberada**, o EA cliente deve permanecer em `DebugMode=true`, e o dispatch de sinais mestre continua manual pelo admin.

---

## Identificação

| Campo | Valor |
|-------|-------|
| Data da execução | 2026-05-25 |
| Responsável | Operação Mercado da Riqueza / homologação assistida |
| Branch | `staging-vps-homologacao` |
| Commit base | `ee18d8c` — `docs: add simulated production gate` |
| Ambiente | `https://autotrade-staging.mercadodariqueza.com.br` |
| Conta MT5 | `52609973 @ XPMT5-DEMO` |
| EA cliente DebugMode | `true` |
| Ferramenta de intake | EA Mãe MQL5 `MR_AutoTrade_Master_Signal` |
| MasterSignalId | `master-mt5-002` |
| LicenseId | `cmpj3wby70005sx18ot5e939p` |
| InstructionId | `cmpkhy8xs003uib04p3xyj5cn` |

---

## Resultado do fluxo

| Etapa | Resultado |
|-------|-----------|
| EA Mãe → `POST /api/master/signals` | OK — intake do `MasterSignal` |
| Resultado intake | `VALIDATED` |
| Dispatch | `DISPATCHED` por ação administrativa autenticada |
| Instruction | `source: MASTER_SIGNAL`, `current_status: EXECUTED` |
| Tracking | `EXECUTED` |
| Ordem real enviada | **NÃO** |
| Dispatch automático no POST | **NÃO** |
| Retry / idempotência | OK — não duplicou instruction |
| Secrets em logs | OK — nenhum secret exposto nas evidências registradas |

### Dados auditáveis confirmados

**MasterSignal**

| Campo | Valor |
|-------|-------|
| `master_signal_id` | `master-mt5-002` |
| `received_at` | `2026-05-25T00:53:42.460Z` |
| `validated_at` | `2026-05-25T00:53:42.460Z` |
| `dispatched_at` | `2026-05-25T00:57:24.226Z` |

**Dispatch**

| Campo | Valor |
|-------|-------|
| `created_at` | `2026-05-25T00:57:23.869Z` |
| `status` | `INSTRUCTION_CREATED` |
| `instruction_id` | `cmpkhy8xs003uib04p3xyj5cn` |

**Instruction**

| Campo | Valor |
|-------|-------|
| `id` | `cmpkhy8xs003uib04p3xyj5cn` |
| `source` | `MASTER_SIGNAL` |
| `current_status` | `EXECUTED` |
| `symbol` | `WDOM26` |
| `side` | `BUY` |
| `order_type` | `MARKET` |
| `purpose` | `ENTRY` |
| `quantity` | `1` |

**AuditLog**

| Campo | Valor |
|-------|-------|
| `action` | `MASTER_SIGNAL_DISPATCH` |
| `actor_type` | `ADMIN` |
| `actor_id` | `cmpj3nfdy002dsxeoie8s2jyt` |
| `entity_type` | `master_signal` |
| `entity_id` | `master-mt5-002` |
| `adminActionId` | `cmpkhy9us0040ib04i5sbzuzf` |
| `instructionsCreated` | `1` |
| `ip_address` | Registrado |
| `created_at` | `2026-05-25T00:57:24.825Z` |

---

## Investigação da suspeita de dispatch automático

Durante o gate, o sinal `master-mt5-002` apareceu como `DISPATCHED` / `EXECUTED`, levantando a hipótese inicial de dispatch automático pelo `POST /api/master/signals`.

A investigação no Neon staging descartou essa hipótese:

- O intake ocorreu em `2026-05-25T00:53:42.460Z`.
- O dispatch foi criado em `2026-05-25T00:57:23.869Z`.
- A diferença temporal foi de aproximadamente **3 minutos e 41 segundos** entre intake e dispatch.
- O `AuditLog` registrou `MASTER_SIGNAL_DISPATCH` por `actor_type: ADMIN`.
- O `adminActionId` `cmpkhy9us0040ib04i5sbzuzf` confirma ação administrativa auditável.

**Conclusão:** `POST /api/master/signals` **não** disparou automaticamente. O dispatch foi executado por ação administrativa autenticada, preservando o fluxo seguro esperado: intake → revisão admin → dispatch manual → instruction → EA cliente em DebugMode → execution report → tracking.

---

## Restrições da aprovação

- Aprovação válida apenas para **produção simulada em staging**.
- Produção real permanece **não liberada**.
- EA cliente deve permanecer em `DebugMode=true` em homologação.
- Dispatch continua manual pelo admin; `POST /api/master/signals` permanece intake-only.
- `MASTER_EA_API_SECRET`, `DATABASE_URL`, `AUTH_SECRET` e `ADMIN_PASSWORD` devem permanecer protegidos e nunca registrados em docs, logs ou prints.

---

## Decisão

| Status | Decisão |
|--------|---------|
| `APPROVED_FOR_SIMULATED_PRODUCTION` | Aprovado para operação simulada repetível em staging, sem ordem real e sem liberação de produção real |

---

*Mercado da Riqueza AutoTrade — resultado oficial do Gate de Produção Simulada (Fase 2.12).*
