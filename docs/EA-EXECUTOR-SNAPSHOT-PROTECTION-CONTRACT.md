# Fase 12.3 — EA Executor: Snapshot & Protection Contract

**Status:** `EA_EXECUTOR_MQL5_UPDATED_PENDING_MT5_COMPILE`  
**Data:** 2026-05-27  
**Branch:** `staging-vps-homologacao`

---

## Objetivo

Documentar e implementar no **EA Executor MQL5** o contrato para operação **REAL controlada**: snapshots de conta (`PRE_MARKET`, `PRE_TRADE`, `POST_MARKET`), uso obrigatório de `magic_number`, validação de conta/símbolo e confirmação de stop/take via `execution-protection` — sem expor estratégia, sem liberar REAL globalmente e sem ativar dispatch automático.

---

## Endpoints usados

| Método | Path | Uso |
|--------|------|-----|
| POST | `/api/v1/ea/account-snapshots` | Telemetria de conta por fase do pregão |
| POST | `/api/v1/ea/execution-protection` | Confirmação SL/TP após entrada REAL |
| GET | `/api/v1/ea/instructions` | Pull de instruções (campos REAL estendidos) |
| POST | `/api/v1/ea/executions` | Resultado da ordem (+ contexto conta/magic) |

Detalhes em [`EA-API.md`](EA-API.md).

---

## Account snapshot

### Payload (resumo)

- `snapshot_type`: `PRE_MARKET` | `PRE_TRADE` | `POST_MARKET` | `MANUAL`
- `account_login`, `account_server`, `environment` (`DEMO` | `REAL`)
- `currency`, `balance`, `equity`, `margin`, `free_margin`, `margin_level`
- `open_positions`, `pending_orders`, `active_magic_numbers`
- `captured_at` (ISO 8601 UTC)

### Regras

| Tipo | Regra |
|------|--------|
| **PRE_MARKET** | Obrigatório no dia (UTC) antes da primeira operação REAL |
| **PRE_TRADE** | Recomendado/obrigatório no EA antes de cada entrada REAL |
| **POST_MARKET** | Enviado no fim do pregão (`InpSendPostMarketOnDeinit` ou rotina manual) |

Implementação MQL5: `MR_AT_RealTrading.mqh` — `MR_AT_SendAccountSnapshot`, `MR_AT_EnsurePreMarketSnapshot`.

---

## Instrução REAL entregue ao EA

Campos adicionais (sem lógica de estratégia):

- `trade_mode`: `REAL`
- `magic_number`, `account_login`, `account_server`
- `requires_protection_confirmation`, `protection_required`
- `requested_contracts`, `controlled_real_gate`
- `source` (ex.: `MASTER_SIGNAL`)

**Não incluídos:** filtros, horários operacionais, indicadores, parâmetros de vault.

---

## magicNumber

- Instrução REAL **deve** trazer `magic_number` (faixa validada no servidor: 910001–910999).
- EA usa `MR_AT_ResolveInstructionMagic(instr)` em `OrderSend` e relatórios.
- Ausência ou divergência → aborta e reporta `IGNORED` / erro local.
- Após `PROTECTION_FAILED`, magic é bloqueado localmente (`MR_AT_BLOCK_<magic>`) e o servidor bloqueia novas ordens (`protectionBlocked`).

---

## Validação conta / símbolo

Antes de executar REAL:

1. `account_login` / `account_server` devem coincidir com `AccountInfo*`
2. `symbol` deve existir no terminal
3. `PRE_MARKET` do dia enviado
4. `PRE_TRADE` enviado com sucesso
5. Magic não bloqueado por proteção anterior

---

## Proteção stop / take

Após entrada REAL (`ENTRY` + `FILLED`):

1. EA verifica SL/TP na posição (`ATTACHED_SL_TP`)
2. POST `/execution-protection` com:
   - `stop_loss_present` / `take_profit_present` **true** em REAL
   - `protection_status`: `PROTECTION_CONFIRMED` ou `PROTECTION_FAILED`
3. Se falhar: `error_code` / `error_message` (sem secrets), magic bloqueado, **não** enviar nova ordem para o mesmo magic

| Status | Comportamento EA | Comportamento plataforma |
|--------|------------------|---------------------------|
| `PROTECTION_CONFIRMED` | Continua operação conforme gate | Libera próximas entradas no magic |
| `PROTECTION_FAILED` | Para novas ordens do magic | `protectionBlocked` + bloqueio preflight |

Em `InpDebugMode=true`: `NOT_REQUIRED_FOR_DEBUG` (sem ordem real).

---

## Logs e redaction

- Não logar `Authorization`, `Bearer`, `device_token`, código de ativação.
- POST `/executions` loga apenas `instruction_id` + `status` (não o JSON completo).
- Erros de `OrderSend`/SL/TP reportados com `error_code` / `error_message` redigidos no servidor.

---

## Pendências

| Item | Status |
|------|--------|
| Compilação no MetaEditor / MT5 | **Pendente** — ambiente local sem compilador MQL5 |
| Teste E2E REAL em staging | **Pendente** — somente após migration DB + EA compilado na VPS |
| Migration staging remota | **Pendente** — `vercel env pull` retornou `DATABASE_URL` vazio; aplicar manualmente com secret válido |

---

## Decisão final

**`APPROVED_WITH_RESTRICTIONS`**

- Contrato documentado em `EA-API.md` e implementado no código MQL5 (revisão estática via `tests/ea/mql-contracts.test.ts`).
- REAL global, dispatch automático e estratégia caixa preta: **inalterados** (guardas mantidos).
- Próxima etapa: **Fase 12.4 — Controlled Real Pilot Dry Run** (sem ordens reais até gate operacional explícito).
