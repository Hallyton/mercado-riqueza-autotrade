# MR_AutoTrade_Executor (MQL5)

EA **executor licenciado** do Mercado da Riqueza AutoTrade — sem lógica estratégica no terminal.

## Instalação

1. Copie a pasta `mql5` para o MetaTrader 5:
   - `MR_AutoTrade_Executor.mq5` → `MQL5/Experts/MercadoDaRiqueza/`
   - `includes/*.mqh` → `MQL5/Experts/MercadoDaRiqueza/includes/`

2. Em **Ferramentas → Opções → Expert Advisors**, marque *Permitir WebRequest* e adicione:
   - `https://api.mercadodariqueza.com.br` (ou sua URL de staging)

3. Compile `MR_AutoTrade_Executor.mq5` no MetaEditor.

4. Anexe ao gráfico e informe:
   - `InpApiBaseUrl` — base da API
   - `InpActivationCode` — na primeira ativação (dashboard)
   - `InpDebugMode=true` — recomendado até homologação (não envia ordens reais)

## Módulos

| Arquivo | Responsabilidade |
|---------|------------------|
| `MR_AT_Auth.mqh` | Credenciais locais, limpeza em 401 INVALID_TOKEN |
| `MR_AT_License.mqh` | Ativação, config, API autenticada |
| `MR_AT_ApiAuth.mqh` | Protótipos GET/POST autenticados |
| `MR_AT_Heartbeat.mqh` | Telemetria (equity, posições, pendentes) |
| `MR_AT_Signal.mqh` | Pull de instruções |
| `MR_AT_Execution.mqh` | Execução MARKET + reporte |
| `MR_AT_Position.mqh` | Posições abertas |
| `MR_AT_Orders.mqh` | Ordens pendentes |
| `MR_AT_Equity.mqh` | Saldo / equity |
| `MR_AT_Error.mqh` | Erros para a API |
| `MR_AT_Http.mqh` | WebRequest HTTPS |

## API

Ver [`docs/EA-API.md`](../../docs/EA-API.md).

## Segurança

- Não há inputs de estratégia, stops editáveis, horários ou filtros.
- Token salvo em arquivo comum MT5 (`MQL5/Files/`) por conta.
- `InpDebugMode=true` bloqueia `OrderSend` e reporta execução simulada.
