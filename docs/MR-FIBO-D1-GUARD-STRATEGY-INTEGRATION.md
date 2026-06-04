# MR Fibo D1 Guard — integração autônoma no Executor

**Nome oficial:** MR Fibo D1 Guard  
**Nome comercial:** Mercado da Riqueza Fibo D1 Guard  
**Código:** `MR_FIBO_D1_GUARD`  
**Status:** `FIBO_D1_GUARD_AUTONOMOUS_STRATEGY_ATTACHED_TO_EXECUTOR`

## Arquitetura

1. **`ea/mql5/includes/MR_Strategy_FiboD1_Guard.mqh`** — calcula níveis D1 anterior, arma compra/venda, emite `MR_StrategySignal` (sem `OrderSend`).
2. **`ea/mql5/includes/MR_AT_AutonomousStrategy.mqh`** — reporta PnL diário, chama preflight, executa somente com `allowed=true`.
3. **`MR_AutoTrade_Executor.mq5`** — `InpEnableAutonomousStrategy=false` por padrão; ciclo no `OnTimer` após heartbeat/config.

## API

- `POST /api/v1/ea/autonomous-strategy/preflight` — autorização server-side (reutiliza elegibilidade REAL_MANUAL bulk + stop financeiro diário).
- `POST /api/v1/ea/daily-risk/report` — atualiza `DailyFinancialRiskState`.
- `GET /api/v1/ea/config` — `autonomous_strategy_enabled`, `autonomous_strategy_capabilities`.

## Variáveis de ambiente

- `ENABLE_AUTONOMOUS_STRATEGY=true` — gate global no servidor (default desligado).
- Licença: `RobotInstance.autonomousStrategyEnabled` + código `MR_FIBO_D1_GUARD`.

## Caixa preta

Parâmetros Fibo, horários, stops e takes ficam hardcoded no módulo MQL5 (build interno). Cliente não configura lógica no portal.

## Admin

- `/admin/real-trading/daily-risk` — limite diário em R$.
- `/admin/real-trading/autonomous-strategy` — decisões de preflight.
- Card na licença `/admin/licenses/[licenseId]`.

## Operador antes de REAL

1. Migrar banco e seed `instrument_point_values` (WDO).
2. Configurar stop financeiro diário na licença/conta.
3. Habilitar estratégia na `RobotInstance`.
4. `ENABLE_AUTONOMOUS_STRATEGY=true` no Vercel.
5. Aprovação REAL, PRE_MARKET, device REAL, heartbeat.
6. EA com `InpEnableAutonomousStrategy=true` apenas em build/VPS controlado (não distribuir ao cliente final sem política).
