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
| Estado sem report há >20 min | `DAILY_RISK_STATE_STALE` |
| Sem state no dia | `DAILY_RISK_REPORT_MISSING` |

**Perda potencial:** `requestedContracts × stopPoints × centsPerPoint`.

## EA

`POST /api/v1/ea/daily-risk/report` no timer autônomo (mín. 60s entre envios).

## Cliente

Mensagem genérica no dashboard — sem valores de limite nem lógica interna.

## Admin — pré-requisito da estratégia autônoma

O card **Estratégia autônoma** em `/admin/licenses/[licenseId]` exibe blocker
`DAILY_FINANCIAL_STOP_NOT_CONFIGURED` até existir `DailyFinancialRiskLimit` habilitado.

## Admin — publicação de parâmetros (Fase 15.3)

A tela `/admin/licenses/[licenseId]/strategy-config` também bloqueia **Publicar configuração**
sem stop diário configurado (mesmo código `DAILY_FINANCIAL_STOP_NOT_CONFIGURED`).
O grupo 11 da tela linka para `/admin/real-trading/daily-risk` sem duplicar formulário.
