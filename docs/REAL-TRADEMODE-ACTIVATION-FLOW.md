# Fluxo de ativação com tradeMode REAL

**Status:** `REAL_TRADEMODE_ACTIVATION_FLOW_IMPLEMENTED`  
**Branch:** `staging-vps-homologacao`

---

## Princípio

O **tradeMode** exibido em um device **REVOKED** é **histórico** (último heartbeat daquele device). Não se edita tradeMode de device antigo.

Para operar em conta real:

1. Configurar **modo operacional esperado** da licença (admin)
2. Revogar device DEMO antigo (se ainda ativo)
3. Gerar novo código de ativação
4. Anexar EA na conta/servidor corretos com `InpTradeMode=REAL`
5. Confirmar novo device **ACTIVE** + heartbeat **REAL**

---

## Painel admin

Rota: `/admin/licenses/[licenseId]`

| Bloco | Significado |
|-------|-------------|
| Modo operacional esperado | DEMO/REAL + conta/servidor para próxima ativação |
| Último tradeMode reportado | Read-only (último heartbeat global) |
| Devices / VPS | tradeMode **reportado** por device; REVOKED = histórico |

---

## EA (MetaTrader)

Input: `InpTradeMode` = `DEMO` (default) ou `REAL`

- Para primeira conta real: alterar explicitamente para **REAL**
- Log seguro: `TradeMode configurado: REAL` (sem token/código)
- Ativação envia: `account_login`, `account_server`, `trade_mode`
- Heartbeat envia `trade_mode` conforme `InpTradeMode`

---

## Validação na ativação (API)

Erros possíveis (sem expor secrets):

| Código | Causa |
|--------|--------|
| `LICENSE_EXPECTED_ACCOUNT_MISMATCH` | Login MT5 diferente do esperado |
| `LICENSE_EXPECTED_SERVER_MISMATCH` | Servidor diferente |
| `LICENSE_EXPECTED_TRADE_MODE_MISMATCH` | EA em DEMO com licença esperando REAL |

---

## Gate operacional REAL

Mesmo com device REAL ativo, ordens reais exigem:

- `RealTradingApproval` aprovada
- Snapshot PRE_MARKET
- Preflight PASSED
- Dispatch manual
- Protection report

**Não** há liberação global de REAL neste fluxo.

---

*Mercado da Riqueza AutoTrade — modelo caixa preta.*
