# MR Fibo D1 Guard — integração autônoma no Executor

**Nome oficial:** MR Fibo D1 Guard  
**Nome comercial:** Mercado da Riqueza Fibo D1 Guard  
**Código:** `MR_FIBO_D1_GUARD`  
**Status:** `FIBO_D1_GUARD_AUTONOMOUS_STRATEGY_ATTACHED_TO_EXECUTOR`

> Nota Fase 15.7: esta pagina registra a integracao autonomo-remota anterior. O fluxo atual aprovado esta em [`MR-FIBO-D1-GUARD-LOCAL-EXECUTION.md`](MR-FIBO-D1-GUARD-LOCAL-EXECUTION.md): o site valida a licenca uma vez por `tradeDate` e a execucao/risco da estrategia ficam locais no `OnTick`.

## Arquitetura

1. **`ea/mql5/includes/MR_Strategy_FiboD1_Guard.mqh`** — calcula níveis D1 anterior, arma compra/venda, emite `MR_StrategySignal` (sem `OrderSend`).
2. **`ea/mql5/includes/MR_AT_AutonomousStrategy.mqh`** — reporta PnL diário, chama preflight, executa somente com `allowed=true`.
3. **`MR_AutoTrade_Executor.mq5`** — `InpEnableAutonomousStrategy=false` por padrão; ciclo no `OnTimer` após heartbeat/config.

## API

- `POST /api/v1/ea/autonomous-strategy/preflight` — autorização server-side (reutiliza elegibilidade REAL_MANUAL bulk + stop financeiro diário).
- `POST /api/v1/ea/daily-risk/report` — atualiza `DailyFinancialRiskState`.
- `GET /api/v1/ea/config` — `autonomous_strategy_enabled`, `autonomous_strategy_capabilities`, `strategy_config_version`, `strategy_config_hash`, `strategy_config` (quando publicada).

## Variáveis de ambiente

- `ENABLE_AUTONOMOUS_STRATEGY=true` — gate global no servidor (default desligado).
- Licença: `RobotInstance.autonomousStrategyEnabled` + código `MR_FIBO_D1_GUARD`.

## Caixa preta

Parâmetros Fibo, horários, stops e takes são configurados **somente no admin** (`/admin/licenses/[licenseId]/strategy-config`) e entregues ao EA via `GET /api/v1/ea/config`. Cliente não configura lógica no portal.

## Configuração admin de parâmetros (Fase 15.3)

- **Tela:** `/admin/licenses/[licenseId]/strategy-config`
- **Doc:** [`docs/MR-FIBO-D1-GUARD-ADMIN-INPUTS-CONFIG.md`](MR-FIBO-D1-GUARD-ADMIN-INPUTS-CONFIG.md)
- **Status:** `MR_FIBO_D1_GUARD_ADMIN_INPUTS_CONFIG_IMPLEMENTED`

## Admin

- `/admin/real-trading/daily-risk` — limite diário em R$.
- `/admin/real-trading/autonomous-strategy` — decisões de preflight.
- Card na licença `/admin/licenses/[licenseId]`.

## Habilitação da estratégia no RobotInstance

**Caminho admin:** `/admin/licenses/[licenseId]` → card **Estratégia autônoma**.

1. Vincular conta MT5 e provisionar/vincular `RobotInstance`.
2. Configurar stop financeiro diário (`/admin/real-trading/daily-risk`).
3. Clicar **Habilitar MR Fibo D1 Guard** e confirmar: `HABILITAR MR FIBO D1 GUARD`.
4. Audit: `license.autonomous_strategy.enable` / `license.autonomous_strategy.disable`.

**Blockers exibidos no card (sem expor lógica interna):**

- `ROBOT_INSTANCE_MISSING`
- `MT5_ACCOUNT_NOT_LINKED`
- `DAILY_FINANCIAL_STOP_NOT_CONFIGURED`
- `LICENSE_NOT_ACTIVE`
- `EXPECTED_MAGIC_MISSING`
- `EXPECTED_SYMBOL_MISSING`

Habilitar no RobotInstance **não envia ordem** — apenas permite que o EA solicite preflight autônomo quando `ENABLE_AUTONOMOUS_STRATEGY=true` e todos os gates estiverem OK.

## Operador antes de REAL

1. Migrar banco e seed `instrument_point_values` (WDO).
2. Configurar stop financeiro diário na licença/conta.
3. Habilitar estratégia no card **Estratégia autônoma** da licença.
4. `ENABLE_AUTONOMOUS_STRATEGY=true` no Vercel.
5. Aprovação REAL, PRE_MARKET, device REAL, heartbeat.
6. EA com `InpEnableAutonomousStrategy=true` apenas em build/VPS controlado (não distribuir ao cliente final sem política).
