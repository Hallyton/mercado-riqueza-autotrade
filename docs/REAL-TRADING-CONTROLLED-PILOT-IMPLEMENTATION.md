# Real Trading Controlled Pilot — Implementation (Fase 12.1)

**Status:** `REAL_TRADING_CONTROLLED_PILOT_IMPLEMENTED_STAGING`  
**Decisão:** `REAL_ACCOUNT_NOT_APPROVED_AUTOMATICALLY`  
**Branch:** `staging-vps-homologacao`

---

## Aviso

Implementação de **gate técnico + admin** para piloto de conta real. **Não** libera REAL globalmente. **Não** ativa dispatch automático. **Não** expõe estratégia (caixa preta).

---

## Travas obrigatórias (default deny)

| Trava | Descrição |
|-------|-----------|
| `ENABLE_REAL_TRADING` | Deve ser `true` ou `1` |
| Allowlist env | `REAL_TRADING_ALLOWED_LICENSE_IDS` |
| `RealTradingApproval` | Status `APPROVED` + `allowReal=true` |
| Conta/símbolo/magic | Devem coincidir com aprovação |
| `AccountSnapshot` PRE_MARKET | Do dia UTC, ambiente REAL |
| Margem | `freeMargin` ≥ exigido + buffer |
| EA online | Heartbeat `ONLINE` recente |
| Proteção anterior | Sem `PROTECTION_FAILED` / `protectionBlocked` |
| Stop/take | `ExecutionProtectionReport` = `PROTECTION_CONFIRMED` |
| Dispatch automático | `ENABLE_AUTO_DISPATCH` permanece desligado |

---

## Modelos Prisma

- `RealTradingApproval`
- `AccountSnapshot`
- `RealTradePreflight`
- `ExecutionProtectionReport`
- Campos em `Instruction` / `Execution`: `magicNumber`, conta, `requiresProtectionConfirmation`, `protectionBlocked`

Migration: `20260529014145_real_trading_controlled_pilot`

---

## Serviços

| Arquivo | Função |
|---------|--------|
| `lib/risk/real-trading-guard.ts` | Guard síncrono (env + allowlist) |
| `lib/risk/real-trade-preflight.ts` | `runRealTradePreflight` |
| `lib/risk/account-snapshot-service.ts` | Persistência snapshot EA |
| `lib/risk/execution-protection.ts` | Relatório SL/TP + bloqueio |
| `lib/admin/real-trading-approval.ts` | CRUD admin aprovações |

---

## API EA

- `POST /api/v1/ea/account-snapshots`
- `POST /api/v1/ea/execution-protection`
- `GET /api/v1/ea/instructions` — preflight por instrução em REAL
- `POST /api/v1/ea/executions` — exige contexto real quando aplicável

Contrato EA: [`docs/EA-API.md`](EA-API.md)

---

## Admin

- `/admin/real-trading/approvals`
- `/admin/real-trading/approvals/new`
- `/admin/real-trading/snapshots`
- `/admin/real-trading/preflights`
- `/admin/real-trading/protection`
- `POST /api/admin/real-trading/approvals`

Cliente **não** pode criar aprovação real via API pública.

---

## Códigos de bloqueio

`REAL_TRADING_APPROVAL_REQUIRED` · `REAL_TRADING_SNAPSHOT_REQUIRED` · `REAL_TRADING_MARGIN_INSUFFICIENT` · `REAL_TRADING_EXECUTOR_OFFLINE` · `REAL_TRADING_ACCOUNT_MISMATCH` · `REAL_TRADING_MAGIC_MISMATCH` · `REAL_TRADING_PROTECTION_NOT_CONFIRMED` · `REAL_TRADING_AUTO_DISPATCH_DISABLED`

---

## EA Executor (futuro)

1. Enviar `PRE_MARKET` antes do pregão  
2. Enviar `POST_MARKET` no fim  
3. Executar ordem com `magic_number` da instrução  
4. Posicionar SL/TP  
5. Reportar `/execution-protection`  
6. Não operar se proteção falhar  

MQL5 **não** alterado nesta fase.

---

*Mercado da Riqueza AutoTrade — piloto conta real controlada (12.1).*
