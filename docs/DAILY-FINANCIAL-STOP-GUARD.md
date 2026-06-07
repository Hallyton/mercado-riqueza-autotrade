# Daily Financial Stop Guard

**Status:** `DAILY_FINANCIAL_STOP_GUARD_IMPLEMENTED`

## Modelos

- `DailyFinancialRiskLimit` — limite por licença/conta/servidor/estratégia/símbolo.
- `DailyFinancialRiskState` — agregado diário (PnL realizado + aberto conforme flag).
- `InstrumentPointValue` — centavos por ponto por contrato (WDO/WDON26: 1000 = R$ 10/ponto).

## Política

| Condição | `reasonCode` |
|----------|----------------|
| Limite não configurado (produto exige) | `DAILY_FINANCIAL_STOP_NOT_CONFIGURED` |
| PnL total ≤ -limite | `DAILY_FINANCIAL_STOP_REACHED` |
| Perda potencial do stop > saldo restante | `DAILY_FINANCIAL_STOP_WOULD_BE_EXCEEDED` |
| Estado sem report há >20 min | `DAILY_RISK_STATE_STALE` (legado) |
| Sem state no dia | `DAILY_RISK_REPORT_MISSING` |

## Política de validade diária do DailyRisk

**Status:** `DAILY_RISK_TRADE_DATE_VALIDITY_AND_EVENT_REVALIDATION_IMPLEMENTED`

- DailyRisk zerado do pregão pode valer o **dia inteiro** se não houve operação/evento após o report.
- **Posição aberta** ou **ordens pendentes** exigem report recente (janela **180s**).
- **Execução**, **alteração admin** (stop, approval, strategy-config, pause, comando) invalidam o report e exigem reenvio.
- **EA offline** é tratado como **liveness** (`EA_OFFLINE_WITH_DAILY_RISK_OK_FOR_DAY`), não como `DAILY_RISK_REPORT_STALE`, quando o report do pregão está `OK_FOR_DAY`.
- **HEALTH_CHECK** valida vida do EA e força novo report — não substitui heartbeat.

Função central: `evaluateDailyRiskFreshnessPolicy()` em `lib/risk/daily-risk-freshness-policy.ts`.

Reason codes: `DAILY_RISK_OK_FOR_DAY`, `POSITION_RISK_REPORT_STALE`, `PENDING_ORDERS_RISK_REPORT_STALE`, `DAILY_RISK_REVALIDATION_REQUIRED_AFTER_TRADE`, `DAILY_RISK_REVALIDATION_REQUIRED_AFTER_ADMIN_CHANGE`, `EA_OFFLINE_WITH_DAILY_RISK_OK_FOR_DAY`.

**Perda potencial:** `requestedContracts × stopPoints × centsPerPoint`.

## EA

`POST /api/v1/ea/daily-risk/report` no timer autônomo (mín. 60s entre envios).

## Admin

Segunda trava em `POST /api/v1/ea/autonomous-strategy/can-trade` (Fase 15.4) e no centro operacional `/admin/real-trading/fibo-d1-guard`.

Mensagem genérica no dashboard — sem valores de limite nem lógica interna.

### Configuração operacional do stop financeiro diário

**Status:** `DAILY_RISK_ACTIVE_LICENSE_SELECTOR_IMPLEMENTED`

| Item | Detalhe |
|------|---------|
| Tela | `/admin/real-trading/daily-risk` |
| Fluxo | Admin seleciona licença **ACTIVE** com conta MT5 vinculada |
| Preenchimento | `licenseId`, login, servidor, símbolo, estratégia — readonly |
| Duplicidade | Upsert por chave `licenseId + accountLogin + accountServer + symbol + strategyCode` |
| Edição | Mesma tela — botão **Editar configuração existente** |
| Deep link | `?licenseId=` (compatível com `license_id`) pré-seleciona licença |
| Centro Fibo | Link **Stop diário** → `/admin/real-trading/daily-risk?licenseId=…` |
| Audit | `daily_risk.limit.created` / `daily_risk.limit.updated` |
| Can-trade | Stop diário verificado antes de novas entradas autônomas |

### Vínculo canônico com MR Fibo D1 Guard

**Status:** `FIBO_D1_DAILY_RISK_LINKAGE_FIXED_AND_TRACEABLE`

| Item | Detalhe |
|------|---------|
| Código canônico | `MR_FIBO_D1_GUARD` (aliases normalizados no save) |
| Aliases | `fibo-d1-guard`, `MR Fibo D1 Guard`, etc. → `MR_FIBO_D1_GUARD` |
| Centro Fibo | Diagnóstico por cliente; reason `DAILY_FINANCIAL_STOP_STRATEGY_MISMATCH` |
| Migração | `normalizeFiboDailyRiskStrategyCodes()` no load do centro + pós-upsert daily-risk |

O admin **não** deve digitar manualmente licenseId/conta/servidor — evita erro operacional.

## Admin — pré-requisito da estratégia autônoma

O card **Estratégia autônoma** em `/admin/licenses/[licenseId]` exibe blocker
`DAILY_FINANCIAL_STOP_NOT_CONFIGURED` até existir `DailyFinancialRiskLimit` habilitado.

## Admin — publicação de parâmetros (Fase 15.3)

A tela `/admin/licenses/[licenseId]/strategy-config` também bloqueia **Publicar configuração**
sem stop diário configurado (mesmo código `DAILY_FINANCIAL_STOP_NOT_CONFIGURED`).
O grupo 11 da tela linka para `/admin/real-trading/daily-risk` sem duplicar formulário.
